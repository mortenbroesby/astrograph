import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, afterEach } from "vitest";

import { appendEngineEvent, getEfficiencyReport, getGlobalEfficiencyReport, resetEfficiencyReport, resolveGlobalCacheRoot } from "../src/index.ts";
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

    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "mcp.tool.response_formatted",
      level: "debug",
      data: { tokens: 10, savedTokens: 4 },
    });

    await expect(getEfficiencyReport(repoRoot)).resolves.toEqual({
      schemaVersion: 2,
      collection: "local-observability-events",
      scope: "repository",
      repositoryCount: 1,
      eventCount: 2,
      operations: [{
        operationClass: "mcp",
        calls: 2,
        tokenBudgetTotal: 92,
        deliveredTokens: 10,
        savedTokens: 4,
        unavailableSavingsSamples: 1,
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

  it("aggregates only registered global repository storage directories", async () => {
    const globalHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-events-"));
    const environment = { platform: "darwin" as const, env: { ASTROGRAPH_HOME: globalHome }, homeDir: () => globalHome };
    const reposRoot = path.join(resolveGlobalCacheRoot(environment), "repos");
    const event = { id: "event", ts: new Date().toISOString(), repoRoot: "/not-reported", source: "mcp", event: "mcp.tool.response_formatted", level: "debug", data: { tokens: 9, savedTokens: 3 } };
    const storageDir = path.join(reposRoot, "a".repeat(64));
    await mkdir(storageDir, { recursive: true });
    await writeFile(path.join(storageDir, "events.jsonl"), `${JSON.stringify(event)}\n`);
    await expect(getGlobalEfficiencyReport(environment)).resolves.toMatchObject({
      schemaVersion: 2,
      scope: "global",
      repositoryCount: 1,
      eventCount: 0,
      operations: [expect.objectContaining({ deliveredTokens: 9, savedTokens: 3 })],
    });
    await rm(globalHome, { recursive: true, force: true });
  });
});
