import path from "node:path";
import { execFile } from "node:child_process";
import { realpath, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it as baseIt } from "vitest";

import { handleCli } from "../src/cli.ts";
import { MCP_SERVER_NAME, MCP_TOOL_DEFINITIONS } from "../src/mcp-contract.ts";
import { dispatchTool } from "../src/mcp.ts";
import {
  ASTROGRAPH_PACKAGE_VERSION,
  indexFolder,
  readRecentEngineEvents,
} from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const it = (name: string, fn: (...args: never[]) => unknown, timeout = 30_000) =>
  baseIt(name, fn as never, timeout);

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5_000,
): Promise<void> {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    await delay(25);
  }
}

function asTextResultForTest(value: unknown) {
  return JSON.stringify(value, null, 2);
}

type McpToolTextResult = { type: string; text: string };
function parseMcpToolResult(value: { content: McpToolTextResult[] } | McpToolTextResult): any {
  const text = "content" in value ? value.content[0].text : value.text;
  return JSON.parse(text as string);
}

async function withMcpClient<T>(
  run: (context: {
    client: Client;
    stderr: () => string;
  }) => Promise<T>,
) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(packageRoot, "scripts", "ai-context-engine.mjs"), "mcp"],
    cwd: packageRoot,
    stderr: "pipe",
    env: {
      ...process.env,
      ASTROGRAPH_USE_SOURCE: "1",
    },
  });
  let stderr = "";
  const stderrStream = transport.stderr as
    | (NodeJS.ReadableStream & { setEncoding?: (encoding: BufferEncoding) => void })
    | null;
  stderrStream?.setEncoding?.("utf8");
  stderrStream?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const client = new Client({
    name: "vitest",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);
    return await run({
      client,
      stderr: () => stderr,
    });
  } finally {
    await client.close();
  }
}

afterEach(async () => {
  await cleanupFixtureRepos();
}, 30_000);

describe("ai-context-engine interfaces", () => {
  it("serves JSON CLI commands over the library surface", async () => {
    const repoRoot = await createFixtureRepo();

    const initStdout = await handleCli(["init", "--repo", repoRoot]);
    expect(JSON.parse(initStdout)).toMatchObject({
      staleStatus: "unknown",
      readiness: {
        stage: "not-ready",
        discoveryReady: false,
        deepRetrievalReady: false,
        deepening: false,
      },
      watch: {
        status: "idle",
        lastEvent: null,
      },
    });

    await handleCli(["index-folder", "--repo", repoRoot]);
    const stdout = await handleCli(["get-repo-outline", "--repo", repoRoot]);

    expect(JSON.parse(stdout)).toMatchObject({
      totalFiles: 2,
      totalSymbols: 5,
    });

    const diagnosticsStdout = await handleCli(["diagnostics", "--repo", repoRoot]);
    expect(JSON.parse(diagnosticsStdout)).toMatchObject({
      staleStatus: "fresh",
      freshnessMode: "metadata",
      freshnessScanned: false,
      indexedFiles: 2,
      currentFiles: 2,
      readiness: {
        stage: "deep-retrieval-ready",
        discoveryReady: true,
        deepRetrievalReady: true,
        deepening: false,
        discoveredFiles: 2,
        deepIndexedFiles: 2,
        pendingDeepIndexedFiles: 0,
      },
      languageRegistry: {
        byLanguage: expect.arrayContaining([
          expect.objectContaining({
            language: "ts",
            extensions: [".ts"],
            tiers: ["discovery", "structured", "graph"],
            summaryStrategies: ["doc-comments-first", "signature-only"],
          }),
          expect.objectContaining({
            language: "js",
            extensions: [".js", ".cjs", ".mjs"],
            tiers: ["discovery", "structured", "graph"],
            summaryStrategies: ["doc-comments-first", "signature-only"],
          }),
        ]),
        byFallbackExtension: expect.arrayContaining([
          expect.objectContaining({
            extension: ".md",
            tiers: ["discovery"],
            summarySource: "markdown-headings",
          }),
        ]),
      },
    });

    const filteredStdout = await handleCli([
      "search-symbols",
      "--repo",
      repoRoot,
      "--query",
      "Greeter",
      "--kind",
      "class",
      "--limit",
      "1",
    ]);
    expect(JSON.parse(filteredStdout)).toHaveLength(1);
    expect(JSON.parse(filteredStdout)[0]).toMatchObject({
      name: "Greeter",
      kind: "class",
    });
    const filteredTextStdout = await handleCli([
      "search-text",
      "--repo",
      repoRoot,
      "--query",
      "Hello",
      "--file-pattern",
      "src/*.ts",
    ]);
    expect(JSON.parse(filteredTextStdout)[0]).toMatchObject({
      filePath: "src/strings.ts",
    });
    const queryCodeDiscoverStdout = await handleCli([
      "query-code",
      "--repo",
      repoRoot,
      "--query",
      "Greeter",
      "--kind",
      "class",
      "--limit",
      "1",
      "--include-text",
    ]);
    expect(JSON.parse(queryCodeDiscoverStdout)).toMatchObject({
      intent: "discover",
      query: "Greeter",
    });
    expect(JSON.parse(queryCodeDiscoverStdout).symbolMatches[0]).toMatchObject({
      name: "Greeter",
      kind: "class",
    });
    expect(JSON.parse(queryCodeDiscoverStdout).textMatches[0]).toMatchObject({
      filePath: "src/strings.ts",
    });
    const greeterId = JSON.parse(filteredStdout)[0].id as string;

    const greetStdout = await handleCli([
      "search-symbols",
      "--repo",
      repoRoot,
      "--query",
      "greet",
      "--kind",
      "method",
      "--limit",
      "1",
    ]);
    const greetId = JSON.parse(greetStdout)[0].id as string;

    const rankedContextStdout = await handleCli([
      "get-ranked-context",
      "--repo",
      repoRoot,
      "--query",
      "Greeter",
      "--budget",
      "120",
    ]);
    expect(JSON.parse(rankedContextStdout)).toMatchObject({
      query: "Greeter",
      bundle: {
        tokenBudget: 120,
      },
    });
    expect(JSON.parse(rankedContextStdout).candidates[0]).toMatchObject({
      symbol: {
        name: "Greeter",
      },
      selected: true,
    });
    const queryCodeAssembleStdout = await handleCli([
      "query-code",
      "--repo",
      repoRoot,
      "--query",
      "Greeter",
      "--budget",
      "120",
      "--include-ranked",
    ]);
    expect(JSON.parse(queryCodeAssembleStdout)).toMatchObject({
      intent: "assemble",
      bundle: {
        tokenBudget: 120,
      },
      ranked: {
        query: "Greeter",
      },
    });

    const symbolSourceStdout = await handleCli([
      "get-symbol-source",
      "--repo",
      repoRoot,
      "--symbols",
      `${greeterId},${greetId}`,
      "--context-lines",
      "1",
    ]);
    expect(JSON.parse(symbolSourceStdout)).toMatchObject({
      requestedContextLines: 1,
    });
    expect(JSON.parse(symbolSourceStdout).items).toHaveLength(2);
    const queryCodeSourceStdout = await handleCli([
      "query-code",
      "--repo",
      repoRoot,
      "--symbols",
      `${greeterId},${greetId}`,
      "--context-lines",
      "1",
      "--verify",
    ]);
    expect(JSON.parse(queryCodeSourceStdout)).toMatchObject({
      intent: "source",
      symbolSource: {
        requestedContextLines: 1,
      },
    });
    expect(JSON.parse(queryCodeSourceStdout).symbolSource.items).toHaveLength(2);

    const signatureOnlyStdout = await handleCli([
      "index-folder",
      "--repo",
      repoRoot,
      "--summary-strategy",
      "signature-only",
    ]);
    expect(JSON.parse(signatureOnlyStdout)).toMatchObject({
      staleStatus: "fresh",
    });

    const watchPromise = handleCli([
      "watch",
      "--repo",
      repoRoot,
      "--debounce-ms",
      "50",
      "--summary-strategy",
      "signature-only",
      "--timeout-ms",
      "250",
    ]);

    await delay(75);
    await writeFile(
      path.join(repoRoot, "src", "math.ts"),
      `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function circumference(radius: number): string {
  return formatLabel(2 * PI * radius);
}
`,
    );

    const watchStdout = await watchPromise;
    expect(JSON.parse(watchStdout)).toMatchObject({
      debounceMs: 50,
      stopReason: "timeout",
    });
    expect(JSON.parse(watchStdout).reindexCount).toBeGreaterThanOrEqual(0);
    expect(JSON.parse(watchStdout).initialSummary).toMatchObject({
      staleStatus: "fresh",
    });
    expect(JSON.parse(watchStdout).lastSummary).toMatchObject({
      staleStatus: "fresh",
    });

    const signatureDiagnosticsStdout = await handleCli([
      "diagnostics",
      "--repo",
      repoRoot,
    ]);
    const signatureDiagnostics = JSON.parse(signatureDiagnosticsStdout);
    expect(signatureDiagnostics).toMatchObject({
      summarySources: {
        signature: 5,
      },
      watch: {
        status: "idle",
        lastChangedPaths: [],
      },
    });
    expect(["signature-only", "doc-comments-first"]).toContain(
      signatureDiagnostics.summaryStrategy,
    );
    if (signatureDiagnostics.watch.lastSummary) {
      expect(signatureDiagnostics.watch.lastSummary).toMatchObject({
        staleStatus: "fresh",
      });
    }
    if (signatureDiagnostics.watch.debounceMs !== null) {
      expect(signatureDiagnostics.watch.debounceMs).toBeGreaterThan(0);
    }
    if (signatureDiagnostics.watch.pollMs !== null) {
      expect(signatureDiagnostics.watch.pollMs).toBeGreaterThan(0);
    }
    if (signatureDiagnostics.watch.lastEvent !== null) {
      expect(["ready", "reindex", "error", "close"]).toContain(
        signatureDiagnostics.watch.lastEvent,
      );
    }
    expect(signatureDiagnostics.watch.reindexCount).toBeGreaterThanOrEqual(0);
  }, 35_000);

  it("treats a subdirectory CLI repo path as the enclosing git worktree root", async () => {
    const repoRoot = await createFixtureRepo();
    const canonicalRepoRoot = await realpath(repoRoot);
    const nestedRepoRoot = path.join(repoRoot, "src");

    const summaryStdout = await handleCli([
      "index-folder",
      "--repo",
      nestedRepoRoot,
    ]);
    expect(JSON.parse(summaryStdout)).toMatchObject({
      indexedFiles: 2,
      indexedSymbols: 5,
      staleStatus: "fresh",
    });

    const diagnosticsStdout = await handleCli([
      "diagnostics",
      "--repo",
      nestedRepoRoot,
    ]);
    expect(JSON.parse(diagnosticsStdout)).toMatchObject({
      storageDir: path.join(canonicalRepoRoot, ".astrograph"),
      databasePath: path.join(canonicalRepoRoot, ".astrograph", "index.sqlite"),
      storageVersion: 1,
      schemaVersion: 4,
      indexedFiles: 2,
      currentFiles: 2,
      readiness: {
        stage: "deep-retrieval-ready",
        discoveredFiles: 2,
      },
    });
  }, 15_000);

  it("exposes spec-aligned MCP tools", async () => {
    const repoRoot = await createFixtureRepo();
    await writeFile(path.join(repoRoot, "README.md"), "# Fixture Repo\n\n## Start Here\n");
    await withMcpClient(async ({ client, stderr }) => {
      const toolsResult = await client.listTools();
      const indexResult = await client.callTool({
        name: "index_folder",
        arguments: {
          repoRoot,
          summaryStrategy: "signature-only",
        },
      });
      const discoverResult = await client.callTool({
        name: "search_symbols",
        arguments: {
          repoRoot,
          query: "Greeter",
          kind: "class",
          limit: 1,
        },
      });
      const filteredSearchResult = await client.callTool({
        name: "search_symbols",
        arguments: {
          repoRoot,
          query: "Greeter",
          language: "ts",
          filePattern: "src/*.ts",
          limit: 5,
        },
      });
      const greetResult = await client.callTool({
        name: "search_symbols",
        arguments: {
          repoRoot,
          query: "greet",
          kind: "method",
          limit: 1,
        },
      });
      const findFilesResult = await client.callTool({
        name: "find_files",
        arguments: {
          repoRoot,
          query: "README",
        },
      });
      const searchTextResult = await client.callTool({
        name: "search_text",
        arguments: {
          repoRoot,
          query: "Hello",
          limit: 1,
        },
      });
      const fileSummaryResult = await client.callTool({
        name: "get_file_summary",
        arguments: {
          repoRoot,
          filePath: "README.md",
        },
      });
      const projectStatusResult = await client.callTool({
        name: "get_project_status",
        arguments: {
          repoRoot,
        },
      });
      const bundleResult = await client.callTool({
        name: "get_ranked_context",
        arguments: {
          repoRoot,
          query: "Greeter",
          tokenBudget: 120,
        },
      });

      expect(stderr()).toBe("");
      expect(indexResult.isError).not.toBe(true);

      const tools = (toolsResult as {
        tools: Array<{ name: string; annotations?: { toolVersion?: string } }>;
      }).tools;

      expect(tools.map((tool) => tool.name)).toEqual(
        MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
      );
      expect(tools.map((tool) => tool.name)).not.toContain("query_code");
      expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
        "search_symbols",
        "get_symbol_source",
        "get_context_bundle",
        "get_ranked_context",
      ]));
      expect(MCP_TOOL_DEFINITIONS.every((tool) => tool.toolVersion === "1")).toBe(true);

      const discoverPayload = parseMcpToolResult(
        discoverResult as {
        content: Array<{ type: string; text: string }>;
        },
      );
      expect(discoverPayload).toMatchObject({
        ok: true,
        meta: {
          toolVersion: "1",
          dataFreshness: expect.stringMatching(/^(fresh|stale|unknown)$/),
          tokenBudgetUsed: expect.any(Number),
        },
        data: expect.arrayContaining([
          expect.objectContaining({
            name: "Greeter",
            kind: "class",
            filePath: "src/strings.ts",
            summarySource: "signature",
          }),
        ]),
      });
      expect(discoverPayload.data).toHaveLength(1);
      expect(discoverPayload.data).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            textMatches: expect.anything(),
          }),
        ]),
      );

      const filteredSearchPayload = parseMcpToolResult(
        filteredSearchResult as {
          content: Array<{ type: string; text: string }>;
        },
      );
      expect(filteredSearchPayload).toMatchObject({
        ok: true,
        meta: {
          toolVersion: "1",
          dataFreshness: expect.stringMatching(/^(fresh|stale|unknown)$/),
          tokenBudgetUsed: expect.any(Number),
        },
      });
      const filteredDiscover = filteredSearchPayload.data;
      expect(filteredDiscover.every((entry: { filePath: string }) =>
        entry.filePath.endsWith(".ts"),
      )).toBe(true);
      const greeterToolId = discoverPayload.data[0].id as string;

      const greetPayload = parseMcpToolResult(
        greetResult as {
          content: Array<{ type: string; text: string }>;
        },
      );
      const greetToolId = greetPayload.data[0].id as string;

      const findFilesPayload = parseMcpToolResult(
        findFilesResult as {
          content: Array<{ type: string; text: string }>;
        },
      );
      expect(findFilesPayload.data[0]).toMatchObject({
        filePath: "README.md",
        supportTier: "discovery",
      });

      const searchTextPayload = parseMcpToolResult(
        searchTextResult as {
          content: Array<{ type: string; text: string }>;
        },
      );
      expect(searchTextPayload.data).toHaveLength(1);
      expect(searchTextPayload.data[0]).toMatchObject({
        filePath: "src/strings.ts",
      });

      const fileSummaryPayload = parseMcpToolResult(
        fileSummaryResult as {
          content: Array<{ type: string; text: string }>;
        },
      );
      expect(fileSummaryPayload.data).toMatchObject({
        filePath: "README.md",
        summarySource: "markdown-headings",
        supportTier: "discovery",
        support: {
          activeTier: "discovery",
          availableTiers: ["discovery"],
          reason: "fallback-extension",
        },
      });

      const projectStatusPayload = parseMcpToolResult(
        projectStatusResult as {
          content: Array<{ type: string; text: string }>;
        },
      );
      expect(projectStatusPayload.data).toMatchObject({
        readiness: {
          stage: "deep-retrieval-ready",
          discoveryReady: true,
          deepRetrievalReady: true,
          deepening: false,
          discoveredFiles: 2,
          deepIndexedFiles: 2,
          pendingDeepIndexedFiles: 0,
        },
        freshness: {
          staleStatus: "fresh",
        },
        supportTiers: {
          discovery: {
            summarySources: expect.arrayContaining(["markdown-headings", "json-top-level-keys"]),
          },
          byLanguage: expect.arrayContaining([
            {
              language: "ts",
              extensions: [".ts"],
              tiers: ["discovery", "structured", "graph"],
              summaryStrategies: ["doc-comments-first", "signature-only"],
              toolAvailability: expect.objectContaining({
                graph: expect.arrayContaining([
                  "search_symbols",
                  "get_symbol_source",
                  "get_context_bundle",
                  "get_ranked_context",
                ]),
              }),
            },
            {
              language: "js",
              extensions: [".js", ".cjs", ".mjs"],
              tiers: ["discovery", "structured", "graph"],
              summaryStrategies: ["doc-comments-first", "signature-only"],
              toolAvailability: expect.objectContaining({
                graph: expect.arrayContaining([
                  "search_symbols",
                  "get_symbol_source",
                  "get_context_bundle",
                  "get_ranked_context",
                ]),
              }),
            },
          ]),
          byFallbackExtension: expect.arrayContaining([
            {
              extension: ".md",
              tiers: ["discovery"],
              summarySource: "markdown-headings",
              toolAvailability: expect.objectContaining({
                discovery: expect.arrayContaining(["get_file_summary"]),
              }),
            },
          ]),
        },
      });

      const bundlePayload = parseMcpToolResult(
        bundleResult as { content: Array<{ type: string; text: string }> },
      );
      expect(bundlePayload).toMatchObject({
        ok: true,
        meta: {
          toolVersion: "1",
          dataFreshness: expect.stringMatching(/^(fresh|stale|unknown)$/),
          tokenBudgetUsed: expect.any(Number),
        },
        data: {
          query: "Greeter",
          bundle: {
            tokenBudget: 120,
          },
        },
      });
      expect(bundlePayload.data.candidates[0]).toMatchObject({
        symbol: {
          name: "Greeter",
        },
        selected: true,
      });

      const symbolSourceResponse = await dispatchTool("get_symbol_source", {
        repoRoot,
        symbolIds: [greeterToolId, greetToolId],
        contextLines: 1,
      });

      const symbolSourceContent = asTextResultForTest(symbolSourceResponse);
      const parsedSymbolSource = JSON.parse(symbolSourceContent);
      expect(parsedSymbolSource).toMatchObject({
        ok: true,
        data: {
          requestedContextLines: 1,
        },
        meta: {
          toolVersion: "1",
          dataFreshness: expect.stringMatching(/^(fresh|stale|unknown)$/),
          tokenBudgetUsed: expect.any(Number),
        },
      });
      expect(parsedSymbolSource.data.items).toHaveLength(2);

      const searchSymbolsResponse = await dispatchTool("search_symbols", {
        repoRoot,
        query: "Greeter",
      });

      const searchSymbolsContent = asTextResultForTest(searchSymbolsResponse);
      const parsedSearchSymbols = JSON.parse(searchSymbolsContent);
      expect(parsedSearchSymbols).toMatchObject({
        ok: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: "Greeter",
          }),
        ]),
        meta: {
          toolVersion: "1",
          dataFreshness: expect.stringMatching(/^(fresh|stale|unknown)$/),
          tokenBudgetUsed: expect.any(Number),
        },
      });
      let latestDiscoverEvent:
        | Awaited<ReturnType<typeof readRecentEngineEvents>>[number]
        | undefined;
      await waitFor(async () => {
        const recentEvents = await readRecentEngineEvents({ repoRoot, limit: 40 });
        latestDiscoverEvent = [...recentEvents].reverse().find((event) =>
          event.event === "mcp.tool.finished"
          && event.source === "mcp"
          && event.data?.toolName === "search_symbols"
          && typeof event.data?.tokenEstimate === "object",
        );
        return latestDiscoverEvent !== undefined;
      });
      expect(latestDiscoverEvent?.data?.tokenEstimate).toMatchObject({
        baselineTokens: expect.any(Number),
        returnedTokens: expect.any(Number),
        savedTokens: expect.any(Number),
        savedPercent: expect.any(Number),
        tokenizer: "tokenx",
        sampleEvery: 10,
        sampleOrdinal: expect.any(Number),
      });
      expect(["heuristic", "exact"]).toContain(
        (
          latestDiscoverEvent?.data?.tokenEstimate as { mode?: string } | undefined
        )?.mode,
      );
      expect(
        (
          latestDiscoverEvent?.data?.tokenEstimate as { savedPercent?: number } | undefined
        )?.savedPercent ?? 0,
      ).toBeGreaterThanOrEqual(0);

      const contextBundleResponse = await dispatchTool("get_context_bundle", {
        repoRoot,
        query: "Greeter",
        tokenBudget: 120,
      });

      const contextBundleContent = asTextResultForTest(contextBundleResponse);
      expect(JSON.parse(contextBundleContent)).toMatchObject({
        ok: true,
        data: {
          query: "Greeter",
          tokenBudget: 120,
        },
        meta: {
          toolVersion: "1",
          tokenBudgetUsed: expect.any(Number),
          dataFreshness: expect.stringMatching(/^(fresh|stale|unknown)$/),
        },
      });

      await expect(
        dispatchTool("query_code", {
          repoRoot,
          query: "Greeter",
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: {
          code: "tool_not_found",
          message: expect.stringContaining("query_code"),
        },
      });

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await dispatchTool("get_repo_outline", { repoRoot });
      }
      let sampledRepoOutlineEvent:
        | Awaited<ReturnType<typeof readRecentEngineEvents>>[number]
        | undefined;
      await waitFor(async () => {
        const sampledEvents = await readRecentEngineEvents({ repoRoot, limit: 40 });
        sampledRepoOutlineEvent = [...sampledEvents].reverse().find((event) =>
          event.event === "mcp.tool.finished"
          && event.source === "mcp"
          && event.data?.toolName === "get_repo_outline"
          && typeof event.data?.tokenEstimate === "object"
          && typeof (event.data.tokenEstimate as { sampledExact?: unknown }).sampledExact === "object",
        );
        return sampledRepoOutlineEvent !== undefined;
      });
      expect(sampledRepoOutlineEvent?.data?.tokenEstimate).toMatchObject({
        mode: "heuristic",
        tokenizer: "cl100k_base",
        sampleEvery: 10,
        sampleOrdinal: expect.any(Number),
        sampledExact: {
          tokenizer: "cl100k_base",
          baselineTokens: expect.any(Number),
          returnedTokens: expect.any(Number),
          savedTokens: expect.any(Number),
          savedPercent: expect.any(Number),
        },
      });
    });
  }, 20_000);

  it("boots the SDK-backed MCP stdio server and handles initialize, tools/list, and tools/call", async () => {
    const repoRoot = await createFixtureRepo();
    const canonicalRepoRoot = await realpath(repoRoot);
    await withMcpClient(async ({ client, stderr }) => {
      expect(client.getServerVersion()).toMatchObject({
        name: MCP_SERVER_NAME,
        version: ASTROGRAPH_PACKAGE_VERSION,
      });

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
      );

      const diagnostics = await client.callTool({
        name: "diagnostics",
        arguments: {
          repoRoot,
        },
      });
      const diagnosticsContent = (
        diagnostics as {
          content: Array<{ type: string; text: string }>;
        }
      ).content[0];
      const diagnosticsPayload = parseMcpToolResult(diagnosticsContent as McpToolTextResult);

      expect(stderr()).toBe("");
      expect(diagnosticsPayload).toMatchObject({
        ok: true,
        data: {
          engineVersion: ASTROGRAPH_PACKAGE_VERSION,
          storageDir: path.join(canonicalRepoRoot, ".astrograph"),
          storageVersion: 1,
          schemaVersion: 4,
          readiness: {
            stage: "not-ready",
          },
        },
        meta: {
          toolVersion: "1",
          dataFreshness: expect.stringMatching(/^(fresh|stale|unknown)$/),
        },
      });
    });
  }, 15000);

  it("rejects unsupported summary strategies at runtime boundaries", async () => {
    const repoRoot = await createFixtureRepo();

    await expect(
      indexFolder({
        repoRoot,
        summaryStrategy: "bogus" as "signature-only",
      }),
    ).rejects.toThrow(/unsupported summaryStrategy/i);

    await expect(
      handleCli([
        "index-folder",
        "--repo",
        repoRoot,
        "--summary-strategy",
        "bogus",
      ]),
    ).rejects.toThrow(/unsupported --summary-strategy/i);

    await expect(
      dispatchTool("index_folder", {
        repoRoot,
        summaryStrategy: "bogus",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
      meta: {
        toolVersion: "1",
        tokenBudgetUsed: null,
        dataFreshness: "unknown",
      },
    });
  }, 30_000);

  it("rejects malformed CLI arguments instead of silently coercing them", async () => {
    const repoRoot = await createFixtureRepo();

    await expect(
      handleCli([
        "search-symbols",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--kind",
        "bogus",
      ]),
    ).rejects.toThrow(/unsupported --kind/i);

    await expect(
      handleCli([
        "watch",
        "--repo",
        repoRoot,
        "--debounce-ms",
        "nope",
        "--timeout-ms",
        "50",
      ]),
    ).rejects.toThrow(/invalid numeric argument --debounce-ms/i);

    await expect(
      handleCli([
        "search-symbols",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--limit",
      ]),
    ).rejects.toThrow(/missing value for argument --limit/i);

    await expect(
      handleCli([
        "search-symbols",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--limit",
        "0",
      ]),
    ).rejects.toThrow(/limit must be positive/i);

    await expect(
      handleCli([
        "get-ranked-context",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--budget",
        "0",
      ]),
    ).rejects.toThrow(/tokenBudget must be positive/i);

    await expect(
      handleCli([
        "get-symbol-source",
        "--repo",
        repoRoot,
        "--symbol",
        "fake-symbol",
        "--context-lines",
        "-1",
      ]),
    ).rejects.toThrow(/contextLines must be non-negative/i);

    await expect(
      handleCli([
        "query-code",
        "--repo",
        repoRoot,
        "--intent",
        "assemble",
        "--query",
        "   ",
        "--symbols",
        "   ",
      ]),
    ).rejects.toThrow(/query_code assemble intent requires a non-empty query or symbolIds/i);

    await expect(
      handleCli([
        "get-context-bundle",
        "--repo",
        repoRoot,
        "--query",
        "   ",
        "--symbols",
        "   ",
      ]),
    ).rejects.toThrow(/getContextBundle requires a non-empty query or symbolIds/i);
  });

  it("accepts --include-references as a bare CLI boolean flag", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "math.ts"),
      `export function sharedUtility(): string {
  return "shared";
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "strings.ts"),
      `import { sharedUtility } from "./math.js";

export function formatLabel(value: number): string {
  return \`Area: \${value.toFixed(2)} \${sharedUtility()}\`;
}

export class Greeter {
  greet(name: string): string {
    return "Hello " + name;
  }
}
`,
    );

    await indexFolder({ repoRoot });

    const discoverResult = JSON.parse(
      await handleCli([
        "query-code",
        "--repo",
        repoRoot,
        "--query",
        "sharedUtility",
        "--include-references",
      ]),
    );

    expect(discoverResult).toMatchObject({
      intent: "discover",
      query: "sharedUtility",
    });
    expect(discoverResult.symbolMatches).toHaveLength(2);
    expect(discoverResult.symbolMatches.map((entry: { filePath: string }) => entry.filePath)).toEqual([
      "src/math.ts",
      "src/strings.ts",
    ]);
  }, 15_000);

  it("rejects malformed MCP arguments instead of treating them as empty filters", async () => {
    const repoRoot = await createFixtureRepo();

    await expect(
      dispatchTool("search_symbols", {
        repoRoot,
        query: "Greeter",
        kind: "bogus",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
    });

    await expect(
      dispatchTool("get_ranked_context", {
        repoRoot,
        query: "Greeter",
        tokenBudget: "oops",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
    });

    await expect(
      dispatchTool("search_symbols", {
        repoRoot,
        query: "Greeter",
        limit: 0,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
    });

    await expect(
      dispatchTool("get_symbol_source", {
        repoRoot,
        symbolId: "fake-symbol",
        contextLines: -1,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
    });

    await expect(
      dispatchTool("get_context_bundle", {
        repoRoot,
        query: "   ",
        symbolIds: ["   "],
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
    });

    await expect(
      dispatchTool("get_context_bundle", {
        repoRoot,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
    });
  });

  it("exposes a workspace bin wrapper for cli commands", async () => {
    const repoRoot = await createFixtureRepo();
    const binPath = path.join(packageRoot, "scripts", "ai-context-engine.mjs");

    const { stdout } = await execFileAsync(process.execPath, [
      binPath,
      "cli",
      "diagnostics",
      "--repo",
      repoRoot,
    ]);

    expect(JSON.parse(stdout)).toMatchObject({
      storageMode: "wal",
      storageBackend: "sqlite",
    });
  }, 15_000);
});
