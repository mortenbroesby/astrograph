import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, afterEach } from "vitest";

import { appendEngineEvent, getGlobalReport, getReport, resetReport, resolveGlobalCacheRoot } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("Astrograph report", () => {
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
      data: { tokens: 10, savedTokens: 4, responseRepresentation: "full" },
    });
    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "mcp.tool.response_formatted",
      level: "debug",
      data: { tokens: 8, savedTokens: 99, responseRepresentation: "reference" },
    });

    const report = await getReport(repoRoot);
    expect(JSON.stringify(report)).not.toContain(repoRoot);
    expect(JSON.stringify(report)).not.toContain("search_symbols");
    expect(report).toEqual({
      schemaVersion: 2,
      collection: "local-observability-events",
      scope: "repository",
      repositoryCount: 1,
      eventCount: 2,
      operations: [{
        operationClass: "mcp",
        calls: 2,
        tokenBudgetTotal: 92,
        deliveredTokens: 18,
        savedTokens: 4,
        unavailableSavingsSamples: 1,
        fullResponses: 1,
        referenceResponses: 1,
        latencyBands: { under100ms: 1, under1000ms: 1, over1000ms: 0 },
      }, {
        operationClass: "cli",
        calls: 0,
        tokenBudgetTotal: 0,
        deliveredTokens: 0,
        savedTokens: 0,
        unavailableSavingsSamples: 0,
        fullResponses: 0,
        referenceResponses: 0,
        latencyBands: { under100ms: 0, under1000ms: 0, over1000ms: 0 },
      }],
      resultSelectionSavings: {
        samples: 0,
        baselineTokens: 0,
        returnedTokens: 0,
        savedTokens: 0,
        savedPercent: 0,
      },
      privacy: { sourceFree: true, rawQueriesExcluded: true, sessionIdsExcluded: true },
    });
  });

  it("resets only the repository-local aggregate input after explicit invocation", async () => {
    const repoRoot = await createFixtureRepo();
    await appendEngineEvent({ repoRoot, source: "mcp", event: "mcp.tool.finished", level: "info", data: {} });
    await expect(resetReport(repoRoot)).resolves.toEqual({ reset: true });
    await expect(getReport(repoRoot)).resolves.toMatchObject({ eventCount: 0 });
  });

  it("aggregates comparable result-selection savings from CLI and MCP calls", async () => {
    const repoRoot = await createFixtureRepo();
    await appendEngineEvent({ repoRoot, source: "mcp", event: "mcp.tool.finished", level: "info", data: {} });
    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "mcp.tool.response_formatted",
      level: "debug",
      data: {
        tokens: 10,
        savedTokens: 2,
        selectionBaselineTokens: 100,
        selectionReturnedTokens: 60,
        selectionSavedTokens: 40,
      },
    });
    await appendEngineEvent({ repoRoot, source: "cli", event: "cli.command.finished", level: "info", data: {} });
    await appendEngineEvent({
      repoRoot,
      source: "cli",
      event: "cli.command.response_formatted",
      level: "debug",
      data: {
        tokens: 20,
        selectionBaselineTokens: 50,
        selectionReturnedTokens: 30,
        selectionSavedTokens: 20,
      },
    });

    await expect(getReport(repoRoot)).resolves.toMatchObject({
      operations: [
        expect.objectContaining({ operationClass: "mcp", calls: 1, deliveredTokens: 10, savedTokens: 2 }),
        expect.objectContaining({ operationClass: "cli", calls: 1, deliveredTokens: 20, savedTokens: 0 }),
      ],
      resultSelectionSavings: {
        samples: 2,
        baselineTokens: 150,
        returnedTokens: 90,
        savedTokens: 60,
        savedPercent: 40,
      },
    });
  });

  it("aggregates only registered global repository storage directories", async () => {
    const globalHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-events-"));
    const environment = { platform: "darwin" as const, env: { ASTROGRAPH_HOME: globalHome }, homeDir: () => globalHome };
    const reposRoot = path.join(resolveGlobalCacheRoot(environment), "repos");
    const event = { id: "event", ts: new Date().toISOString(), repoRoot: "/not-reported", source: "mcp", event: "mcp.tool.response_formatted", level: "debug", data: { tokens: 9, savedTokens: 3 } };
    const storageDir = path.join(reposRoot, "a".repeat(64));
    await mkdir(storageDir, { recursive: true });
    await writeFile(path.join(storageDir, "events.jsonl"), `${JSON.stringify(event)}\n`);
    await expect(getGlobalReport(environment)).resolves.toMatchObject({
      schemaVersion: 2,
      scope: "global",
      repositoryCount: 1,
      eventCount: 0,
      operations: expect.arrayContaining([expect.objectContaining({ deliveredTokens: 9, savedTokens: 3 })]),
    });
    await rm(globalHome, { recursive: true, force: true });
  });
});
