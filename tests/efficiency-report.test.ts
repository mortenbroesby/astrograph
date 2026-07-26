import { describe, expect, it, afterEach } from "vitest";

import { appendEngineEvent, getEfficiencyReport, resetEfficiencyReport } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("efficiency report", () => {
  it("aggregates local MCP completion metadata without source, query, path, or session data", async () => {
    const repoRoot = await createFixtureRepo();
    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "mcp.tool.finished",
      level: "info",
      data: { toolName: "search_symbols", durationMs: 25, tokenBudgetUsed: 12, responseRepresentation: "full" },
    });
    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "mcp.tool.finished",
      level: "info",
      data: { toolName: "get_task_context", durationMs: 250, tokenBudgetUsed: 80, responseRepresentation: "reference" },
    });

    await expect(getEfficiencyReport(repoRoot)).resolves.toEqual({
      schemaVersion: 1,
      collection: "local-observability-events",
      eventCount: 2,
      operations: [{
        operationClass: "mcp",
        calls: 2,
        tokenBudgetTotal: 92,
        fullResponses: 1,
        referenceResponses: 1,
        latencyBands: { under100ms: 1, under1000ms: 1, over1000ms: 0 },
      }],
      privacy: { sourceFree: true, rawQueriesExcluded: true, sessionIdsExcluded: true },
    });
  });

  it("resets only the repository-local aggregate input after explicit invocation", async () => {
    const repoRoot = await createFixtureRepo();
    await appendEngineEvent({ repoRoot, source: "mcp", event: "mcp.tool.finished", level: "info", data: {} });
    await expect(resetEfficiencyReport(repoRoot)).resolves.toEqual({ reset: true });
    await expect(getEfficiencyReport(repoRoot)).resolves.toMatchObject({ eventCount: 0 });
  });
});
