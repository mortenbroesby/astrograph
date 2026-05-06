import path from "node:path";
import { writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  diagnostics,
  getContextBundle,
  getDependencyGraph,
  findFiles,
  getFileSummary,
  getProjectStatus,
  getFileTree,
  getRepoOutline,
  indexFolder,
  queryCode,
  getRankedContext,
  searchText,
} from "../src/index.ts";
import { serializeToolResult } from "../src/serialization.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("machine result serialization", () => {
  it("preserves optimized exploration and status payloads", async () => {
    const repoRoot = await createFixtureRepo();
    await writeFile(path.join(repoRoot, "README.md"), "# Fixture Repo\n\n## Start Here\n");
    await writeFile(path.join(repoRoot, "config.yaml"), "name: fixture\nmode: test\n");
    await indexFolder({ repoRoot });

    const diagnosticsResult = await diagnostics({ repoRoot });
    const findFilesResult = await findFiles({ repoRoot, query: "strings" });
    const searchTextResult = await searchText({ repoRoot, query: "Hello", limit: 1 });
    const fileSummaryResult = await getFileSummary({
      repoRoot,
      filePath: "README.md",
    });
    const yamlSummaryResult = await getFileSummary({
      repoRoot,
      filePath: "config.yaml",
    });
    const projectStatusResult = await getProjectStatus({ repoRoot });
    const repoOutline = await getRepoOutline({ repoRoot });
    const fileTree = await getFileTree({ repoRoot });

    expect(JSON.parse(serializeToolResult("diagnostics", diagnosticsResult))).toEqual(
      diagnosticsResult,
    );
    expect(JSON.parse(serializeToolResult("find_files", findFilesResult))).toEqual(
      findFilesResult,
    );
    expect(JSON.parse(serializeToolResult("search_text", searchTextResult))).toEqual(
      searchTextResult,
    );
    expect(JSON.parse(serializeToolResult("get_file_summary", fileSummaryResult))).toEqual(
      fileSummaryResult,
    );
    expect(JSON.parse(serializeToolResult("get_file_summary", yamlSummaryResult))).toEqual(
      yamlSummaryResult,
    );
    expect(JSON.parse(serializeToolResult("get_project_status", projectStatusResult))).toEqual(
      projectStatusResult,
    );
    expect(JSON.parse(serializeToolResult("get_repo_outline", repoOutline))).toEqual(
      repoOutline,
    );
    expect(JSON.parse(serializeToolResult("get_file_tree", fileTree))).toEqual(fileTree);
  }, 15_000);

  it("falls back to native JSON for unsupported tool payloads", () => {
    const payload = {
      intent: "discover",
      symbolMatches: [{ id: "symbol-1" }],
    };

    expect(serializeToolResult("query_code", payload)).toBe(JSON.stringify(payload));
  });

  it("produces deterministic compact serialization for broad retrieval payloads", async () => {
    const repoRoot = await createFixtureRepo();
    await indexFolder({ repoRoot });

    const bundle = await getContextBundle({
      repoRoot,
      query: "Greeter greet Hello",
      includeDependencies: true,
      relationDepth: 1,
      tokenBudget: 400,
    });
    const ranked = await getRankedContext({
      repoRoot,
      query: "Greeter greet Hello",
      includeDependencies: true,
      relationDepth: 1,
      tokenBudget: 400,
    });
    const graph = await getDependencyGraph({
      repoRoot,
      filePath: "src/math.ts",
      direction: "dependencies",
      relationDepth: 1,
    });
    const discover = await queryCode({
      repoRoot,
      intent: "discover",
      query: "Greeter",
      includeTextMatches: true,
      includeDependencies: true,
      relationDepth: 1,
    });

    const compactBundle = JSON.parse(
      serializeToolResult("get_context_bundle", bundle, { detailLevel: "compact" }),
    );
    expect(compactBundle).toMatchObject({
      itemCount: expect.any(Number),
      items: expect.arrayContaining([
        expect.objectContaining({
          symbol: expect.objectContaining({
            name: expect.any(String),
            filePath: expect.any(String),
          }),
        }),
      ]),
    });
    expect(compactBundle.items[0].source).toBeUndefined();

    const compactRanked = JSON.parse(
      serializeToolResult("get_ranked_context", ranked, { detailLevel: "compact" }),
    );
    expect(compactRanked).toMatchObject({
      candidateCount: expect.any(Number),
      bundle: expect.objectContaining({
        itemCount: expect.any(Number),
      }),
    });
    expect(compactRanked.bundle.items[0].source).toBeUndefined();

    const compactGraph = JSON.parse(
      serializeToolResult("get_dependency_graph", graph, { detailLevel: "compact" }),
    );
    expect(compactGraph).toMatchObject({
      nodeCount: expect.any(Number),
      edgeCount: expect.any(Number),
      nodes: expect.arrayContaining([expect.any(String)]),
    });

    const compactDiscover = JSON.parse(
      serializeToolResult("query_code", discover, { detailLevel: "compact" }),
    );
    expect(compactDiscover).toMatchObject({
      intent: "discover",
      symbolMatchCount: expect.any(Number),
      graphMatchCount: expect.any(Number),
    });
  }, 15_000);

  it("can still produce CLI-compatible pretty JSON when requested", async () => {
    const repoRoot = await createFixtureRepo();
    await indexFolder({ repoRoot });

    const diagnosticsResult = await diagnostics({ repoRoot });

    expect(serializeToolResult("diagnostics", diagnosticsResult, { pretty: true })).toBe(
      JSON.stringify(diagnosticsResult, null, 2),
    );
  }, 15_000);
});
