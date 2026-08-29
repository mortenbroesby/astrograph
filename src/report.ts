import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_OBSERVABILITY_RETENTION_DAYS,
  loadGlobalEngineConfig,
  loadRepoEngineConfig,
  resolveEnginePaths,
  resolveGlobalCacheRoot,
} from "./config.ts";
import { readEngineEventsFile, readRecentEngineEvents } from "./event-sink.ts";
import type { EngineEventEnvelope, StoragePathEnvironment } from "./types.ts";

export interface AstrographReport {
  schemaVersion: 3;
  collection: "local-observability-events";
  scope: "repository" | "global";
  repositoryCount: number;
  eventCount: number;
  eventWindow: {
    firstEventAt: string | null;
    lastEventAt: string | null;
  };
  operations: Array<{
    operationClass: "mcp" | "cli";
    calls: number;
    successfulCalls: number;
    failedCalls: number;
    durationMsTotal: number;
    averageDurationMs: number;
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
  const failed = events.filter((event) => event.event === `${prefix}.failed`);
  const attempts = [...completed, ...failed];
  const formatted = events.filter((event) => event.event === `${prefix}.response_formatted`);
  const latencyBands = { under100ms: 0, under1000ms: 0, over1000ms: 0 };
  let tokenBudgetTotal = 0;
  let referenceResponses = 0;
  let durationMsTotal = 0;
  for (const event of attempts) {
    const durationMs = numberValue(event.data.durationMs);
    if (durationMs < 100) latencyBands.under100ms += 1;
    else if (durationMs < 1_000) latencyBands.under1000ms += 1;
    else latencyBands.over1000ms += 1;
    durationMsTotal += durationMs;
  }
  for (const event of completed) {
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
    calls: attempts.length,
    successfulCalls: completed.length,
    failedCalls: failed.length,
    durationMsTotal,
    averageDurationMs: attempts.length === 0 ? 0 : Math.round(durationMsTotal / attempts.length),
    tokenBudgetTotal,
    deliveredTokens,
    savedTokens,
    unavailableSavingsSamples: formattedReferences.length + Math.max(0, completed.length - formatted.length),
    fullResponses: completed.length - referenceResponses,
    referenceResponses,
    latencyBands,
  };
}

function eventWindow(events: EngineEventEnvelope[]): AstrographReport["eventWindow"] {
  const timestamps = events
    .map((event) => event.ts)
    .filter((timestamp): timestamp is string => typeof timestamp === "string" && Number.isFinite(Date.parse(timestamp)))
    .sort();
  return {
    firstEventAt: timestamps[0] ?? null,
    lastEventAt: timestamps.at(-1) ?? null,
  };
}

function retainedEvents(events: EngineEventEnvelope[], retentionDays: number): EngineEventEnvelope[] {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1_000;
  return events.filter((event) => typeof event.ts === "string" && Date.parse(event.ts) >= cutoff);
}

function reportableEvents(events: EngineEventEnvelope[]): EngineEventEnvelope[] {
  return events.filter((event) =>
    event.event === "mcp.tool.finished"
    || event.event === "mcp.tool.failed"
    || event.event === "mcp.tool.response_formatted"
    || event.event === "cli.command.finished"
    || event.event === "cli.command.failed"
    || event.event === "cli.command.response_formatted");
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
    schemaVersion: 3,
    collection: "local-observability-events",
    scope,
    repositoryCount,
    eventCount: operations.reduce((total, operation) => total + operation.calls, 0),
    eventWindow: eventWindow(events),
    operations,
    resultSelectionSavings: selectionSavings(formatted),
    privacy: { sourceFree: true, rawQueriesExcluded: true, sessionIdsExcluded: true },
  };
}

export async function getReport(repoRoot: string): Promise<AstrographReport> {
  const config = await loadRepoEngineConfig(repoRoot);
  const events = await readRecentEngineEvents({ repoRoot: config.repoRoot, limit: 10_000 });
  return buildReport(reportableEvents(retainedEvents(events, config.observability.retentionDays)), "repository", 1);
}

export async function getGlobalReport(environment: StoragePathEnvironment = {}): Promise<AstrographReport> {
  const reposRoot = path.join(resolveGlobalCacheRoot(environment), "repos");
  const globalConfig = await loadGlobalEngineConfig(environment);
  const retentionDays = globalConfig.data.observability?.retentionDays ?? DEFAULT_OBSERVABILITY_RETENTION_DAYS;
  const entries = await readdir(reposRoot, { withFileTypes: true }).catch(() => []);
  const eventGroups = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name))
    .map((entry) => readEngineEventsFile(path.join(reposRoot, entry.name, "events.jsonl"), 10_000)));
  const retainedGroups = eventGroups
    .map((events) => reportableEvents(retainedEvents(events, retentionDays)))
    .filter((events) => events.length > 0);
  return buildReport(retainedGroups.flat(), "global", retainedGroups.length);
}

export async function resetReport(repoRoot: string): Promise<{ reset: true }> {
  const config = await loadRepoEngineConfig(repoRoot);
  const paths = resolveEnginePaths(config.repoRoot, { storageLocation: config.storageLocation });
  await mkdir(paths.storageDir, { recursive: true });
  await writeFile(paths.eventsPath, "", "utf8");
  return { reset: true };
}
