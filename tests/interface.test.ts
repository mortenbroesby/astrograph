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
        name: "query_code",
        arguments: {
          repoRoot,
          intent: "discover",
          query: "Greeter",
          kind: "class",
          includeTextMatches: true,
          limit: 1,
        },
      });
      const filteredSearchResult = await client.callTool({
        name: "query_code",
        arguments: {
          repoRoot,
          intent: "discover",
          query: "Greeter",
          language: "ts",
          filePattern: "src/*.ts",
          limit: 5,
        },
      });
      const greetResult = await client.callTool({
        name: "query_code",
        arguments: {
          repoRoot,
          intent: "discover",
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
        name: "query_code",
        arguments: {
          repoRoot,
          intent: "assemble",
          query: "Greeter",
          tokenBudget: 120,
          includeRankedCandidates: true,
        },
      });

      expect(stderr()).toBe("");
      expect(indexResult.isError).not.toBe(true);

      const tools = (toolsResult as {
        tools: Array<{ name: string }>;
      }).tools;

      expect(tools.map((tool) => tool.name)).toEqual(
        MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
      );

      const content = (
        discoverResult as {
        content: Array<{ type: string; text: string }>;
        }).content[0];
      expect(content.type).toBe("text");
      expect(JSON.parse(content.text)).toMatchObject({
        intent: "discover",
        query: "Greeter",
      });
      expect(JSON.parse(content.text).symbolMatches).toHaveLength(1);
      expect(JSON.parse(content.text).symbolMatches[0]).toMatchObject({
        name: "Greeter",
        kind: "class",
        filePath: "src/strings.ts",
        summarySource: "signature",
      });
      expect(JSON.parse(content.text).textMatches.length).toBeGreaterThan(0);

      const filteredSearchContent = (
        filteredSearchResult as {
        content: Array<{ type: string; text: string }>;
        }).content[0];
      const filteredDiscover = JSON.parse(filteredSearchContent.text);
      expect(filteredDiscover.symbolMatches.every((entry: { filePath: string }) =>
        entry.filePath.endsWith(".ts"),
      )).toBe(true);
      const greeterToolId = JSON.parse(content.text).symbolMatches[0].id as string;

      const greetContent = (
        greetResult as {
        content: Array<{ type: string; text: string }>;
        }).content[0];
      const greetToolId = JSON.parse(greetContent.text).symbolMatches[0].id as string;

      const findFilesContent = (
        findFilesResult as {
          content: Array<{ type: string; text: string }>;
        }
      ).content[0];
      expect(JSON.parse(findFilesContent.text)[0]).toMatchObject({
        filePath: "README.md",
        supportTier: "discovery",
      });

      const searchTextContent = (
        searchTextResult as {
          content: Array<{ type: string; text: string }>;
        }
      ).content[0];
      expect(JSON.parse(searchTextContent.text)).toHaveLength(1);
      expect(JSON.parse(searchTextContent.text)[0]).toMatchObject({
        filePath: "src/strings.ts",
      });

      const fileSummaryContent = (
        fileSummaryResult as {
          content: Array<{ type: string; text: string }>;
        }
      ).content[0];
      expect(JSON.parse(fileSummaryContent.text)).toMatchObject({
        filePath: "README.md",
        summarySource: "markdown-headings",
        supportTier: "discovery",
        support: {
          activeTier: "discovery",
          availableTiers: ["discovery"],
          reason: "fallback-extension",
        },
      });

      const projectStatusContent = (
        projectStatusResult as {
          content: Array<{ type: string; text: string }>;
        }
      ).content[0];
      expect(JSON.parse(projectStatusContent.text)).toMatchObject({
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
                graph: expect.arrayContaining(["query_code"]),
              }),
            },
            {
              language: "js",
              extensions: [".js", ".cjs", ".mjs"],
              tiers: ["discovery", "structured", "graph"],
              summaryStrategies: ["doc-comments-first", "signature-only"],
              toolAvailability: expect.objectContaining({
                graph: expect.arrayContaining(["query_code"]),
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

      const bundleContent = (
        bundleResult as {
        content: Array<{ type: string; text: string }>;
        }).content[0];
      expect(bundleContent.type).toBe("text");
      expect(JSON.parse(bundleContent.text)).toMatchObject({
        intent: "assemble",
        bundle: {
          query: "Greeter",
          tokenBudget: 120,
        },
      });
      expect(JSON.parse(bundleContent.text).bundle.items[0]).toMatchObject({
        symbol: {
          name: "Greeter",
        },
      });
      expect(JSON.parse(bundleContent.text).ranked).toMatchObject({
        query: "Greeter",
        bundle: {
          tokenBudget: 120,
        },
      });
      expect(JSON.parse(bundleContent.text).ranked.candidates[0]).toMatchObject({
        symbol: {
          name: "Greeter",
        },
        selected: true,
      });

      const symbolSourceResponse = await dispatchTool("query_code", {
        repoRoot,
        intent: "source",
        symbolIds: [greeterToolId, greetToolId],
        contextLines: 1,
      });

      const symbolSourceContent = asTextResultForTest(symbolSourceResponse);
      expect(JSON.parse(symbolSourceContent)).toMatchObject({
        intent: "source",
        symbolSource: {
          requestedContextLines: 1,
        },
      });
      expect(JSON.parse(symbolSourceContent).symbolSource.items).toHaveLength(2);

      const queryCodeResponse = await dispatchTool("query_code", {
        repoRoot,
        intent: "discover",
        query: "Greeter",
        includeTextMatches: true,
      });

      const queryCodeContent = asTextResultForTest(queryCodeResponse);
      expect(JSON.parse(queryCodeContent)).toMatchObject({
        intent: "discover",
        query: "Greeter",
      });
      expect(JSON.parse(queryCodeContent).symbolMatches[0]).toMatchObject({
        name: "Greeter",
      });
      let latestDiscoverEvent:
        | Awaited<ReturnType<typeof readRecentEngineEvents>>[number]
        | undefined;
      await waitFor(async () => {
        const recentEvents = await readRecentEngineEvents({ repoRoot, limit: 40 });
        latestDiscoverEvent = [...recentEvents].reverse().find((event) =>
          event.event === "mcp.tool.finished"
          && event.source === "mcp"
          && event.data?.toolName === "query_code"
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

      const autoAssembleResponse = await dispatchTool("query_code", {
        repoRoot,
        query: "Greeter",
        tokenBudget: 120,
      });

      const autoAssembleContent = asTextResultForTest(autoAssembleResponse);
      expect(JSON.parse(autoAssembleContent)).toMatchObject({
        intent: "assemble",
        bundle: {
          tokenBudget: 120,
        },
      });

      await expect(
        dispatchTool("search_symbols", {
          repoRoot,
          query: "Greeter",
        }),
      ).rejects.toThrow(/unknown tool: search_symbols/i);

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

      expect(stderr()).toBe("");
      expect(JSON.parse(diagnosticsContent.text)).toMatchObject({
        engineVersion: ASTROGRAPH_PACKAGE_VERSION,
        storageDir: path.join(canonicalRepoRoot, ".astrograph"),
        storageVersion: 1,
        schemaVersion: 4,
        readiness: {
          stage: "not-ready",
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
    ).rejects.toThrow(/unsupported summaryStrategy/i);
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
      dispatchTool("query_code", {
        repoRoot,
        intent: "discover",
        query: "Greeter",
        kind: "bogus",
      }),
    ).rejects.toThrow(/invalid option|unsupported kind/i);

    await expect(
      dispatchTool("query_code", {
        repoRoot,
        intent: "assemble",
        query: "Greeter",
        tokenBudget: "oops",
      }),
    ).rejects.toThrow(/expected number|invalid numeric argument/i);

    await expect(
      dispatchTool("query_code", {
        repoRoot,
        intent: "discover",
        query: "Greeter",
        limit: 0,
      }),
    ).rejects.toThrow(/limit must be positive|must be positive/i);

    await expect(
      dispatchTool("query_code", {
        repoRoot,
        intent: "source",
        symbolId: "fake-symbol",
        contextLines: -1,
      }),
    ).rejects.toThrow(/contextLines must be non-negative|must be non-negative/i);

    await expect(
      dispatchTool("query_code", {
        repoRoot,
        intent: "assemble",
        query: "   ",
        symbolIds: ["   "],
      }),
    ).rejects.toThrow(/query_code assemble intent requires a non-empty query or symbolIds/i);

    await expect(
      dispatchTool("query_code", {
        repoRoot,
      }),
    ).rejects.toThrow(/query_code auto intent resolved to discover and requires a non-empty query/i);
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
