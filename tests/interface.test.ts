import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it as baseIt } from "vitest";

import { handleCli } from "../src/cli.ts";
import { decodeCompactMcpEnvelope } from "../src/compact-mcp.ts";
import { MCP_SERVER_NAME, MCP_TOOL_DEFINITIONS } from "../src/mcp-contract.ts";
import { dispatchTool } from "../src/mcp.ts";
import { ASTROGRAPH_PACKAGE_VERSION, indexFolder } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const it = (name: string, fn: (...args: never[]) => unknown, timeout = 30_000) =>
  baseIt(name, fn as never, timeout);

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
  const isolatedHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-mcp-home-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(packageRoot, "scripts", "astrograph.mjs"), "mcp"],
    cwd: packageRoot,
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: isolatedHome,
      XDG_CONFIG_HOME: path.join(isolatedHome, ".config"),
      ASTROGRAPH_HOME: isolatedHome,
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
    await rm(isolatedHome, { recursive: true, force: true });
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
      totalFiles: 3,
      totalSymbols: 6,
    });

    const diagnosticsStdout = await handleCli(["diagnostics", "--repo", repoRoot]);
    expect(JSON.parse(diagnosticsStdout)).toMatchObject({
      staleStatus: "fresh",
      freshnessMode: "metadata",
      freshnessScanned: false,
      indexedFiles: 3,
      currentFiles: 3,
      readiness: {
        stage: "deep-retrieval-ready",
        discoveryReady: true,
        deepRetrievalReady: true,
        deepening: false,
        discoveredFiles: 3,
        deepIndexedFiles: 3,
        pendingDeepIndexedFiles: 0,
      },
      retrievalHealth: {
        status: "safe",
        safeOperations: ["discovery", "exact_source", "ranked_context", "dependency_graph"],
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
          expect.objectContaining({
            extension: ".txt",
            tiers: ["discovery"],
            summarySource: "text-lines",
          }),
          expect.objectContaining({
            extension: ".yaml",
            tiers: ["discovery"],
            summarySource: "yaml-top-level-keys",
          }),
          expect.objectContaining({
            extension: ".yml",
            tiers: ["discovery"],
            summarySource: "yaml-top-level-keys",
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
    expect(JSON.parse(filteredStdout).items).toHaveLength(1);
    expect(JSON.parse(filteredStdout).items[0]).toMatchObject({
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
    const greeterId = JSON.parse(filteredStdout).items[0].id as string;

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
    const greetId = JSON.parse(greetStdout).items[0].id as string;

    const taskContextStdout = await handleCli([
      "get-task-context",
      "--repo",
      repoRoot,
      "--query",
      "Greeter",
      "--payload-token-budget",
      "1200",
    ]);
    expect(JSON.parse(taskContextStdout)).toMatchObject({
      query: "Greeter",
      payloadTokenBudget: 1200,
    });
    expect(JSON.parse(taskContextStdout).items[0]).toMatchObject({
      symbol: {
        name: "Greeter",
      },
      provenance: expect.any(Object),
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
    const symbolSourceJson = JSON.parse(symbolSourceStdout);
    expect(symbolSourceJson).toMatchObject({ requestedContextLines: 1 });
    expect(symbolSourceJson.items).toHaveLength(2);
    expect(symbolSourceJson.items[0]).toMatchObject({
      provenance: {
        range: { encoding: "utf8" },
        freshness: "indexed-snapshot",
      },
    });
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
        signature: 6,
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
    const nestedRepoRoot = path.join(repoRoot, "src");

    const summaryStdout = await handleCli([
      "index-folder",
      "--repo",
      nestedRepoRoot,
    ]);
    expect(JSON.parse(summaryStdout)).toMatchObject({
      indexedFiles: 3,
      indexedSymbols: 6,
      staleStatus: "fresh",
    });

    const diagnosticsStdout = await handleCli([
      "diagnostics",
      "--repo",
      nestedRepoRoot,
    ]);
    expect(JSON.parse(diagnosticsStdout)).toMatchObject({
      storageVersion: 2,
      schemaVersion: 7,
      indexedFiles: 3,
      currentFiles: 3,
      readiness: {
        stage: "deep-retrieval-ready",
        discoveredFiles: 3,
      },
    });
  }, 15_000);

  it("exposes spec-aligned MCP tools", async () => {
    const repoRoot = await createFixtureRepo();
    let symbolSourceResponse: unknown;
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
      const compactDiscoverResult = await client.callTool({
        name: "search_symbols",
        arguments: {
          repoRoot,
          query: "Greeter",
          kind: "class",
          limit: 1,
          format: "compact",
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
        name: "get_task_context",
        arguments: {
          repoRoot,
          query: "Greeter",
          payloadTokenBudget: 1200,
        },
      });
      const greeterId = parseMcpToolResult(
        discoverResult as { content: Array<{ type: string; text: string }> },
      ).data.items[0].id as string;
      const greetId = parseMcpToolResult(
        greetResult as { content: Array<{ type: string; text: string }> },
      ).data.items[0].id as string;
      symbolSourceResponse = await client.callTool({
        name: "get_symbol_source",
        arguments: {
          repoRoot,
          symbolIds: [greeterId, greetId],
          contextLines: 1,
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
        "get_task_context",
      ]));
      expect(MCP_TOOL_DEFINITIONS.every((tool) => tool.toolVersion === "1")).toBe(true);

      const discoverPayload = parseMcpToolResult(
        discoverResult as {
        content: Array<{ type: string; text: string }>;
        },
      );
      const compactDiscoverPayload = parseMcpToolResult(
        compactDiscoverResult as {
          content: Array<{ type: string; text: string }>;
        },
      );
      expect(Array.isArray(compactDiscoverPayload)).toBe(true);
      expect(decodeCompactMcpEnvelope(compactDiscoverPayload)).toMatchObject({
        ok: true,
        data: {
          items: [expect.objectContaining({ name: "Greeter", kind: "class" })],
        },
        meta: { toolVersion: "1" },
      });
      expect(discoverPayload).toMatchObject({
        ok: true,
        meta: {
          toolVersion: "1",
          dataFreshness: expect.stringMatching(/^(fresh|stale|unknown)$/),
          tokenBudgetUsed: expect.any(Number),
        },
        data: {
          truncated: false,
          items: expect.arrayContaining([
            expect.objectContaining({
              name: "Greeter",
              kind: "class",
              filePath: "src/strings.ts",
              summarySource: "signature",
            }),
          ]),
        },
      });
      expect(discoverPayload.data.items).toHaveLength(1);
      expect(discoverPayload.data.items).toEqual(
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
      const filteredDiscover = filteredSearchPayload.data.items;
      expect(filteredDiscover.every((entry: { filePath: string }) =>
        entry.filePath.endsWith(".ts"),
      )).toBe(true);


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
          discoveredFiles: expect.any(Number),
          deepIndexedFiles: expect.any(Number),
          pendingDeepIndexedFiles: 0,
        },
        freshness: {
          staleStatus: "fresh",
        },
        retrievalHealth: {
          status: "safe",
          safeOperations: ["discovery", "exact_source", "ranked_context", "dependency_graph"],
        },
        supportTiers: {
          discovery: {
            summarySources: expect.arrayContaining(["markdown-headings", "yaml-top-level-keys"]),
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
                  "get_task_context",
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
                  "get_task_context",
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
          payloadTokenBudget: 1200,
        },
      });
      expect(bundlePayload.data.items[0]).toMatchObject({
        symbol: {
          name: "Greeter",
        },
        provenance: expect.any(Object),
      });

      const parsedSymbolSource = parseMcpToolResult(
        symbolSourceResponse as { content: Array<{ type: string; text: string }> },
      );
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
      expect(parsedSymbolSource.data.items[0]).toMatchObject({
        provenance: {
          range: { encoding: "utf8" },
          freshness: "indexed-snapshot",
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
          storageVersion: 2,
          schemaVersion: 7,
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
        "get-task-context",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--payload-token-budget",
        "0",
      ]),
    ).rejects.toThrow(/payloadTokenBudget must be positive/i);

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
        "get-task-context",
        "--repo",
        repoRoot,
        "--query",
        "   ",
        "--symbols",
        "   ",
      ]),
    ).rejects.toThrow(/getTaskContext requires a non-empty query or symbolIds/i);
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
      dispatchTool("get_task_context", {
        repoRoot,
        query: "Greeter",
        payloadTokenBudget: "oops",
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
      dispatchTool("get_task_context", {
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
      dispatchTool("get_task_context", {
        repoRoot,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
    });
  });

  it("rejects malformed MCP tool outputs with a strict failure envelope", async () => {
    const repoRoot = await createFixtureRepo();

    const tool = MCP_TOOL_DEFINITIONS.find((entry) => entry.name === "search_symbols");
    expect(tool).toBeDefined();

    const mutableTool = tool as unknown as { execute: (...args: any[]) => Promise<unknown> };
    const originalExecute = mutableTool.execute;
    try {
      mutableTool.execute = async () => [
        {
          id: "sym-id",
          kind: "class",
          filePath: "src/strings.ts",
        },
      ];

      const malformedResult = await dispatchTool("search_symbols", {
        repoRoot,
        query: "Greeter",
      });

      expect(malformedResult).toMatchObject({
        ok: false,
        data: null,
        error: {
          code: expect.stringMatching(/^(internal_error|invalid_argument)$/),
          message: expect.stringContaining("Invalid MCP output"),
        },
        meta: {
          toolVersion: "1",
          tokenBudgetUsed: null,
          dataFreshness: "unknown",
        },
      });
    } finally {
      mutableTool.execute = originalExecute;
    }
  }, 15_000);

  it("rejects malformed get_symbol_source MCP output with a strict failure envelope", async () => {
    const repoRoot = await createFixtureRepo();

    const tool = MCP_TOOL_DEFINITIONS.find((entry) => entry.name === "get_symbol_source");
    expect(tool).toBeDefined();

    const mutableTool = tool as unknown as { execute: (...args: any[]) => Promise<unknown> };
    const originalExecute = mutableTool.execute;
    try {
      mutableTool.execute = async () => ({
        requestedContextLines: 5,
        items: "not-an-array",
      });

      const malformedResult = await dispatchTool("get_symbol_source", {
        repoRoot,
        symbolId: "fake-symbol",
        contextLines: 3,
      });

      expect(malformedResult).toMatchObject({
        ok: false,
        data: null,
        error: {
          code: expect.stringMatching(/^(internal_error|invalid_argument)$/),
          message: expect.stringContaining("get_symbol_source output must include items"),
        },
        meta: {
          toolVersion: "1",
          tokenBudgetUsed: null,
          dataFreshness: "unknown",
        },
      });
    } finally {
      mutableTool.execute = originalExecute;
    }
  }, 15_000);

  it("rejects malformed get_task_context MCP output with a strict failure envelope", async () => {
    const repoRoot = await createFixtureRepo();

    const tool = MCP_TOOL_DEFINITIONS.find((entry) => entry.name === "get_task_context");
    expect(tool).toBeDefined();

    const mutableTool = tool as unknown as { execute: (...args: any[]) => Promise<unknown> };
    const originalExecute = mutableTool.execute;
    try {
      mutableTool.execute = async () => ({
        payloadTokenBudget: 128,
        usedPayloadTokens: 12,
        estimatedPayloadTokens: 18,
        sourceTokens: 12,
        truncated: false,
        query: "Greeter",
        repoRoot,
        items: "not-an-array",
      });

      const malformedResult = await dispatchTool("get_task_context", {
        repoRoot,
        query: "Greeter",
      });

      expect(malformedResult).toMatchObject({
        ok: false,
        data: null,
        error: {
          code: expect.stringMatching(/^(internal_error|invalid_argument)$/),
          message: expect.stringContaining("get_task_context output must include items"),
        },
        meta: {
          toolVersion: "1",
          tokenBudgetUsed: null,
          dataFreshness: "unknown",
        },
      });
    } finally {
      mutableTool.execute = originalExecute;
    }
  }, 15_000);

  it("exposes a workspace bin wrapper for cli commands", async () => {
    const repoRoot = await createFixtureRepo();
    const binPath = path.join(packageRoot, "scripts", "astrograph.mjs");

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

  it("marks bounded broad MCP symbol results as truncated", async () => {
    const repoRoot = await createFixtureRepo();
    await writeFile(
      path.join(repoRoot, "src", "many-symbols.ts"),
      Array.from(
        { length: 12 },
        (_, index) => `export function matchingSymbol${index}() { return ${index}; }`,
      ).join("\n"),
    );
    await indexFolder({ repoRoot });

    const mcpResponse = await dispatchTool("search_symbols", {
      repoRoot,
      query: "matchingSymbol",
    });
    expect(mcpResponse).toMatchObject({
      ok: true,
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({ name: "matchingSymbol0" }),
        ]),
        truncated: true,
        refinementHints: [
          { field: "limit", value: 4 },
          { field: "filePattern", value: "src/**" },
          { field: "kind", value: "function" },
        ],
        tokenSavings: {
          unit: "tokens",
          tokenizer: "cl100k_base",
          baseline: "all_ranked_symbol_items",
        },
      },
    });

    const cliOutput = await handleCli([
      "search-symbols",
      "--repo",
      repoRoot,
      "--query",
      "matchingSymbol",
    ]);
    const cliResult = JSON.parse(cliOutput);
    expect(cliResult).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ name: "matchingSymbol0" }),
      ]),
      truncated: true,
      refinementHints: [
        { field: "limit", value: 4 },
        { field: "filePattern", value: "src/**" },
        { field: "kind", value: "function" },
      ],
    });
    const tokenSavings = (mcpResponse as { data: { tokenSavings: {
      baselineTokens: number;
      returnedTokens: number;
      savedTokens: number;
      savedPercent: number;
    } } }).data.tokenSavings;
    expect(tokenSavings.baselineTokens).toBeGreaterThan(tokenSavings.returnedTokens);
    expect(tokenSavings.savedTokens).toBe(tokenSavings.baselineTokens - tokenSavings.returnedTokens);
    expect(tokenSavings.savedPercent).toBe(
      Math.round((tokenSavings.savedTokens / tokenSavings.baselineTokens) * 100),
    );
    expect(cliResult.tokenSavings).toEqual(tokenSavings);
  });
});
