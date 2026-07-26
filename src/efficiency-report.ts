import { mkdir, writeFile } from "node:fs/promises";

import { loadRepoEngineConfig, resolveEnginePaths } from "./config.ts";
import { readRecentEngineEvents } from "./event-sink.ts";

export interface EfficiencyReport {
  schemaVersion: 1;
  collection: "local-observability-events";
  eventCount: number;
  operations: Array<{
    operationClass: "mcp";
    calls: number;
    tokenBudgetTotal: number;
    fullResponses: number;
    referenceResponses: number;
    latencyBands: Record<"under100ms" | "under1000ms" | "over1000ms", number>;
  }>;
  privacy: {
    sourceFree: true;
    rawQueriesExcluded: true;
    sessionIdsExcluded: true;
  };
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getEfficiencyReport(repoRoot: string): Promise<EfficiencyReport> {
  const events = await readRecentEngineEvents({ repoRoot, limit: 10_000 });
  const completed = events.filter((event) => event.event === "mcp.tool.finished");
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
  return {
    schemaVersion: 1,
    collection: "local-observability-events",
    eventCount: completed.length,
    operations: [{
      operationClass: "mcp",
      calls: completed.length,
      tokenBudgetTotal,
      fullResponses: completed.length - referenceResponses,
      referenceResponses,
      latencyBands,
    }],
    privacy: { sourceFree: true, rawQueriesExcluded: true, sessionIdsExcluded: true },
  };
}

export async function resetEfficiencyReport(repoRoot: string): Promise<{ reset: true }> {
  const config = await loadRepoEngineConfig(repoRoot);
  const paths = resolveEnginePaths(config.repoRoot, { storageLocation: config.storageLocation });
  await mkdir(paths.storageDir, { recursive: true });
  await writeFile(paths.eventsPath, "", "utf8");
  return { reset: true };
}
