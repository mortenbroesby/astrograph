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
    operationClass: "mcp" | "cli";
    calls: number;
    tokenBudgetTotal: number;
    deliveredTokens: number;
    savedTokens: number;
    unavailableSavingsSamples: number;
    fullResponses: number;
    referenceResponses: number;
    latencyBands: Record<"under100ms" | "under1000ms" | "over1000ms", number>;
  }>;
  resultSelectionSavings: {
    samples: number;
    baselineTokens: number;
    returnedTokens: number;
    savedTokens: number;
    savedPercent: number;
  };
  privacy: {
    sourceFree: true;
    rawQueriesExcluded: true;
    sessionIdsExcluded: true;
  };
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function operationReport(
  events: EngineEventEnvelope[],
  operationClass: "mcp" | "cli",
): AstrographReport["operations"][number] {
  const prefix = operationClass === "mcp" ? "mcp.tool" : "cli.command";
  const completed = events.filter((event) => event.event === `${prefix}.finished`);
  const formatted = events.filter((event) => event.event === `${prefix}.response_formatted`);
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
  return {
    operationClass,
    calls: completed.length,
    tokenBudgetTotal,
    deliveredTokens,
    savedTokens,
    unavailableSavingsSamples: formattedReferences.length + Math.max(0, completed.length - formatted.length),
    fullResponses: completed.length - referenceResponses,
    referenceResponses,
    latencyBands,
  };
}

function selectionSavings(events: EngineEventEnvelope[]): AstrographReport["resultSelectionSavings"] {
  let samples = 0;
  let baselineTokens = 0;
  let returnedTokens = 0;
  let savedTokens = 0;
  for (const event of events) {
    const baseline = numberValue(event.data.selectionBaselineTokens);
    const returned = numberValue(event.data.selectionReturnedTokens);
    const saved = numberValue(event.data.selectionSavedTokens);
    if (baseline === 0 || baseline - returned !== saved) continue;
    samples += 1;
    baselineTokens += baseline;
    returnedTokens += returned;
    savedTokens += saved;
  }
  return {
    samples,
    baselineTokens,
    returnedTokens,
    savedTokens,
    savedPercent: baselineTokens === 0 ? 0 : Math.round((savedTokens / baselineTokens) * 100),
  };
}

function buildReport(events: EngineEventEnvelope[], scope: AstrographReport["scope"], repositoryCount: number): AstrographReport {
  const operations = [operationReport(events, "mcp"), operationReport(events, "cli")];
  const formatted = events.filter((event) => event.event === "mcp.tool.response_formatted" || event.event === "cli.command.response_formatted");
  return {
    schemaVersion: 2,
    collection: "local-observability-events",
    scope,
    repositoryCount,
    eventCount: operations.reduce((total, operation) => total + operation.calls, 0),
    operations,
    resultSelectionSavings: selectionSavings(formatted),
    privacy: { sourceFree: true, rawQueriesExcluded: true, sessionIdsExcluded: true },
  };
}

export async function getReport(repoRoot: string): Promise<AstrographReport> {
  return buildReport(await readRecentEngineEvents({ repoRoot, limit: 10_000 }), "repository", 1);
}

export async function getGlobalReport(environment: StoragePathEnvironment = {}): Promise<AstrographReport> {
  const reposRoot = path.join(resolveGlobalCacheRoot(environment), "repos");
  const entries = await readdir(reposRoot, { withFileTypes: true }).catch(() => []);
  const eventGroups = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name))
    .map((entry) => readEngineEventsFile(path.join(reposRoot, entry.name, "events.jsonl"), 10_000)));
  return buildReport(eventGroups.flat(), "global", eventGroups.length);
}

export async function resetReport(repoRoot: string): Promise<{ reset: true }> {
  const config = await loadRepoEngineConfig(repoRoot);
  const paths = resolveEnginePaths(config.repoRoot, { storageLocation: config.storageLocation });
  await mkdir(paths.storageDir, { recursive: true });
  await writeFile(paths.eventsPath, "", "utf8");
  return { reset: true };
}
