import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadRepoEngineConfig, resolveEnginePaths, resolveGlobalCacheRoot } from "./config.ts";
import { readEngineEventsFile, readRecentEngineEvents } from "./event-sink.ts";
import type { EngineEventEnvelope, StoragePathEnvironment } from "./types.ts";

export interface AstrographReport {
  schemaVersion: 2;
  collection: "local-observability-events";
  scope: "repository" | "global";
  repositoryCount: number;
  eventCount: number;
  operations: Array<{
    operationClass: "mcp";
    calls: number;
    tokenBudgetTotal: number;
    deliveredTokens: number;
    savedTokens: number;
    unavailableSavingsSamples: number;
    fullResponses: number;
    referenceResponses: number;
    latencyBands: Record<"under100ms" | "under1000ms" | "over1000ms", number>;
  }>;
  privacy: {
    sourceFree: true;
    rawQueriesExcluded: true;
    sessionIdsExcluded: true;
  };
  verbose?: {
    failedOperations: number;
    incompleteOperations: number;
    recentOperations: Array<{
      outcome: "started" | "finished" | "failed";
      toolName?: string;
      durationMs?: number;
    }>;
    indexProfiles: Array<{
      outcome: "success" | "failure";
      phase: string;
      durationMs: number;
      discoveryMs: number;
      analysisMs: number;
      persistenceMs: number;
      finalizationMs: number;
      discoveredFiles: number;
      indexedFiles: number;
      indexedSymbols: number;
      reusedFiles: number;
      parsedFiles: number;
      removedFiles: number;
      fileProcessingConcurrency: number;
      workerPoolEnabled: boolean;
      workerPoolMaxWorkers: number;
    }>;
  };
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function profilePhase(value: unknown): string {
  return value === "discovery" || value === "analysis" || value === "persistence"
    || value === "finalization" || value === "complete"
    ? value
    : "unknown";
}

function buildReport(
  events: EngineEventEnvelope[],
  scope: AstrographReport["scope"],
  repositoryCount: number,
  verbose = false,
): AstrographReport {
  const completed = events.filter((event) => event.event === "mcp.tool.finished");
  const formatted = events.filter((event) => event.event === "mcp.tool.response_formatted");
  const latencyBands = { under100ms: 0, under1000ms: 0, over1000ms: 0 };
  let tokenBudgetTotal = 0;
  let referenceResponses = 0;
  for (const event of completed) {
    const durationMs = numberValue(event.data.durationMs);
    if (durationMs < 100) latencyBands.under100ms += 1;
    else if (durationMs < 1_000) latencyBands.under1000ms += 1;
    else latencyBands.over1000ms += 1;
    tokenBudgetTotal += numberValue(event.data.tokenBudgetUsed);
    if (event.data.responseRepresentation === "reference") referenceResponses += 1;
  }
  const deliveredTokens = formatted.reduce((total, event) => total + numberValue(event.data.tokens), 0);
  const formattedReferences = formatted.filter((event) => event.data.responseRepresentation === "reference");
  const savedTokens = formatted
    .filter((event) => event.data.responseRepresentation !== "reference")
    .reduce((total, event) => total + numberValue(event.data.savedTokens), 0);
  const report: AstrographReport = {
    schemaVersion: 2,
    collection: "local-observability-events",
    scope,
    repositoryCount,
    eventCount: completed.length,
    operations: [{
      operationClass: "mcp",
      calls: completed.length,
      tokenBudgetTotal,
      deliveredTokens,
      savedTokens,
      unavailableSavingsSamples: formattedReferences.length + Math.max(0, completed.length - formatted.length),
      fullResponses: completed.length - referenceResponses,
      referenceResponses,
      latencyBands,
    }],
    privacy: { sourceFree: true, rawQueriesExcluded: true, sessionIdsExcluded: true },
  };
  if (!verbose) return report;

  const operationEvents = events.filter((event) =>
    event.event === "mcp.tool.started"
    || event.event === "mcp.tool.finished"
    || event.event === "mcp.tool.failed");
  const terminalCorrelations = new Set(operationEvents
    .filter((event) => event.event !== "mcp.tool.started")
    .map((event) => event.correlationId)
    .filter((correlationId): correlationId is string => typeof correlationId === "string"));
  const profiles = events.filter((event) => event.event === "index.profile").slice(-20);
  report.verbose = {
    failedOperations: operationEvents.filter((event) => event.event === "mcp.tool.failed").length,
    incompleteOperations: operationEvents.filter((event) =>
      event.event === "mcp.tool.started"
      && (!event.correlationId || !terminalCorrelations.has(event.correlationId))).length,
    recentOperations: operationEvents.slice(-20).map((event) => {
      const toolName = typeof event.data.toolName === "string" ? event.data.toolName : undefined;
      const durationMs = typeof event.data.durationMs === "number" ? event.data.durationMs : undefined;
      return {
        outcome: event.event.slice("mcp.tool.".length) as "started" | "finished" | "failed",
        ...(toolName === undefined ? {} : { toolName }),
        ...(durationMs === undefined ? {} : { durationMs }),
      };
    }),
    indexProfiles: profiles.map((event) => ({
      outcome: event.data.outcome === "failure" ? "failure" : "success",
      phase: profilePhase(event.data.phase),
      durationMs: numberValue(event.data.durationMs),
      discoveryMs: numberValue(event.data.discoveryMs),
      analysisMs: numberValue(event.data.analysisMs),
      persistenceMs: numberValue(event.data.persistenceMs),
      finalizationMs: numberValue(event.data.finalizationMs),
      discoveredFiles: numberValue(event.data.discoveredFiles),
      indexedFiles: numberValue(event.data.indexedFiles),
      indexedSymbols: numberValue(event.data.indexedSymbols),
      reusedFiles: numberValue(event.data.reusedFiles),
      parsedFiles: numberValue(event.data.parsedFiles),
      removedFiles: numberValue(event.data.removedFiles),
      fileProcessingConcurrency: numberValue(event.data.fileProcessingConcurrency),
      workerPoolEnabled: booleanValue(event.data.workerPoolEnabled),
      workerPoolMaxWorkers: numberValue(event.data.workerPoolMaxWorkers),
    })),
  };
  return report;
}

export async function getReport(repoRoot: string, options: { verbose?: boolean } = {}): Promise<AstrographReport> {
  return buildReport(await readRecentEngineEvents({ repoRoot, limit: 10_000 }), "repository", 1, options.verbose);
}

export async function getGlobalReport(
  environment: StoragePathEnvironment = {},
  options: { verbose?: boolean } = {},
): Promise<AstrographReport> {
  const reposRoot = path.join(resolveGlobalCacheRoot(environment), "repos");
  const entries = await readdir(reposRoot, { withFileTypes: true }).catch(() => []);
  const eventGroups = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name))
    .map((entry) => readEngineEventsFile(path.join(reposRoot, entry.name, "events.jsonl"), 10_000)));
  return buildReport(eventGroups.flat(), "global", eventGroups.length, options.verbose);
}

export async function resetReport(repoRoot: string): Promise<{ reset: true }> {
  const config = await loadRepoEngineConfig(repoRoot);
  const paths = resolveEnginePaths(config.repoRoot, { storageLocation: config.storageLocation });
  await mkdir(paths.storageDir, { recursive: true });
  await writeFile(paths.eventsPath, "", "utf8");
  return { reset: true };
}
