import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  diagnostics,
  findFiles,
  getFileSummary,
  getProjectStatus,
  getFileTree,
  getRepoOutline,
  indexFolder,
  searchSymbolsResult,
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
    await mkdir(path.join(repoRoot, "docs", "nested"), { recursive: true });
    await writeFile(path.join(repoRoot, "docs", "nested", "GUIDE.MD"), "# Guide\n\n## Details\n");
    await writeFile(path.join(repoRoot, "docs", "nested", "settings.YML"), "enabled: true\nmode: test\n");
    await writeFile(path.join(repoRoot, "docs", "nested", "notes.TXT"), "First note\n\nSecond note\n");
    await indexFolder({ repoRoot });

    const diagnosticsResult = await diagnostics({ repoRoot });
    const findFilesResult = await findFiles({ repoRoot, query: "strings" });
    const searchTextResult = await searchText({ repoRoot, query: "Hello", limit: 1 });
    const searchSymbolsResultValue = await searchSymbolsResult({ repoRoot, query: "Greeter" });
    const fileSummaryResult = await getFileSummary({
      repoRoot,
      filePath: "README.md",
    });
    const yamlSummaryResult = await getFileSummary({
      repoRoot,
      filePath: "config.yaml",
    });
    const markdownSummaryResult = await getFileSummary({
      repoRoot,
      filePath: "docs/nested/GUIDE.MD",
    });
    const ymlSummaryResult = await getFileSummary({
      repoRoot,
      filePath: "docs/nested/settings.YML",
    });
    const textSummaryResult = await getFileSummary({
      repoRoot,
      filePath: "docs/nested/notes.TXT",
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
    expect(JSON.parse(serializeToolResult("search_symbols", searchSymbolsResultValue))).toEqual(
      searchSymbolsResultValue,
    );
    expect(JSON.parse(serializeToolResult("get_file_summary", fileSummaryResult))).toEqual(
      fileSummaryResult,
    );
    expect(JSON.parse(serializeToolResult("get_file_summary", yamlSummaryResult))).toEqual(
      yamlSummaryResult,
    );
    expect(markdownSummaryResult).toMatchObject({
      supportTier: "discovery",
      summarySource: "markdown-headings",
      support: { reason: "fallback-extension" },
    });
    expect(ymlSummaryResult).toMatchObject({
      supportTier: "discovery",
      summarySource: "yaml-top-level-keys",
      support: { reason: "fallback-extension" },
    });
    expect(textSummaryResult).toMatchObject({
      supportTier: "discovery",
      summarySource: "text-lines",
      support: { reason: "fallback-extension" },
    });
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

  it("can still produce CLI-compatible pretty JSON when requested", async () => {
    const repoRoot = await createFixtureRepo();
    await indexFolder({ repoRoot });

    const diagnosticsResult = await diagnostics({ repoRoot });

    expect(serializeToolResult("diagnostics", diagnosticsResult, { pretty: true })).toBe(
      JSON.stringify(diagnosticsResult, null, 2),
    );
  }, 15_000);
});
