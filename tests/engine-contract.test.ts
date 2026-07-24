import { mkdir, mkdtemp, readFile, stat, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ASTROGRAPH_PACKAGE_VERSION,
  ASTROGRAPH_VERSION_PARTS,
  DEFAULT_MAX_CHILD_PROCESS_OUTPUT_BYTES,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_FILES_DISCOVERED,
  DEFAULT_MAX_LIVE_SEARCH_MATCHES,
  DEFAULT_MAX_SYMBOLS_PER_FILE,
  DEFAULT_RANKING_WEIGHTS,
  DEFAULT_MAX_SYMBOL_RESULTS,
  DEFAULT_MAX_TEXT_RESULTS,
  DEFAULT_OBSERVABILITY_RETENTION_DAYS,
  DEFAULT_SUMMARY_STRATEGY,
  DEFAULT_WATCH_DEBOUNCE_MS,
  ENGINE_SCHEMA_VERSION,
  ENGINE_STORAGE_VERSION,
  ENGINE_TOOLS,
  assessAstrographVersionBump,
  cacheStatus,
  clearStorageProcessCaches,
  indexFolder,
  loadRepoEngineConfig,
  pruneGlobalCaches,
  removeGlobalCache,
  restoreGlobalCache,
  createDefaultEngineConfig,
  parseStorageLocation,
  parseAstrographVersion,
  resolveGlobalCacheRoot,
  resolveGlobalConfigPath,
  resolveEnginePaths,
  searchSymbols,
} from "../src/index.ts";
import {
  COMMAND_REGISTRY,
  MCP_COMMAND_REGISTRY,
  getCommandByCliCommand,
  getCommandByMcpToolName,
} from "../src/command-registry.ts";
import { MCP_TOOL_DEFINITIONS } from "../src/mcp-contract.ts";
import {
  setupForAllIdes,
  setupForCodex,
  setupForIde,
  formatGlobalInstallation,
  formatRepositoryInstallation,
  getGlobalInstallationDiagnostics,
  setupGlobalForCodex,
  setupGlobalForCopilotCli,
} from "../src/scripts/install.ts";
import { dispatchTool } from "../src/mcp.ts";
import { SQLITE_INDEX_BACKEND } from "../src/sqlite-backend.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await import("node:fs/promises").then((fs) =>
        fs.rm(dir, { recursive: true, force: true }),
      );
    }),
  );
});

describe("ai-context-engine contract", () => {
  it("uses repo-local storage artifacts aligned with the engine name", () => {
    const repoRoot = "/tmp/playground";

    expect(resolveEnginePaths(repoRoot)).toEqual({
      storageDir: "/tmp/playground/.astrograph",
      databasePath: "/tmp/playground/.astrograph/index.sqlite",
      repoMetaPath: "/tmp/playground/.astrograph/repo-meta.json",
      integrityPath: "/tmp/playground/.astrograph/integrity.sha256",
      storageVersionPath: "/tmp/playground/.astrograph/storage-version.json",
      eventsPath: "/tmp/playground/.astrograph/events.jsonl",
    });
  });

  it("derives a user-private global cache directory from the canonical repository path", () => {
    const environment = {
      platform: "linux" as const,
      env: { XDG_CACHE_HOME: "/var/cache/user" },
      homeDir: () => "/home/example",
    };

    const first = resolveEnginePaths("/work/project one", {
      storageLocation: "global",
      environment,
    });
    const second = resolveEnginePaths("/work/project two", {
      storageLocation: "global",
      environment,
    });

    expect(first.storageDir).toMatch(/^\/var\/cache\/user\/astrograph\/repos\/[a-f0-9]{64}$/);
    expect(second.storageDir).toMatch(/^\/var\/cache\/user\/astrograph\/repos\/[a-f0-9]{64}$/);
    expect(first.storageDir).not.toBe(second.storageDir);
    expect(first.databasePath).toBe(path.join(first.storageDir, "index.sqlite"));
    expect(first.eventsPath).toBe(path.join(first.storageDir, "events.jsonl"));
  });

  it("uses a visible home-directory root for macOS global cache state", () => {
    expect(resolveGlobalCacheRoot({
      platform: "linux",
      env: { XDG_CACHE_HOME: "relative-cache" },
      homeDir: () => "/home/example",
    })).toBe("/home/example/.cache/astrograph");
    expect(resolveGlobalCacheRoot({
      platform: "darwin",
      env: {},
      homeDir: () => "/Users/example",
    })).toBe("/Users/example/.astrograph/cache");
    expect(resolveGlobalCacheRoot({
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Users\\example\\AppData\\Local" },
      homeDir: () => "C:\\Users\\example",
    })).toContain(path.join("astrograph", "cache"));
  });

  it("uses a visible home-directory configuration path on macOS", () => {
    expect(resolveGlobalConfigPath({
      platform: "linux",
      env: { XDG_CONFIG_HOME: "/var/config/user" },
      homeDir: () => "/home/example",
    })).toBe("/var/config/user/astrograph/config.json");
    expect(resolveGlobalConfigPath({
      platform: "darwin",
      env: {},
      homeDir: () => "/Users/example",
    })).toBe("/Users/example/.astrograph/config.json");
  });

  it("validates the storage location contract", () => {
    expect(parseStorageLocation("global")).toBe("global");
    expect(parseStorageLocation("repo-local")).toBe("repo-local");
    expect(() => parseStorageLocation("shared-database")).toThrow(/Unsupported storageLocation/i);
  });

  it("defaults to a spec-aligned engine config", () => {
    const config = createDefaultEngineConfig({
      repoRoot: "/tmp/playground",
    });

    expect(config).toMatchObject({
      repoRoot: "/tmp/playground",
      languages: [
        "ts",
        "tsx",
        "js",
        "jsx",
        "python",
        "bash",
        "powershell",
        "csharp",
        "java",
        "go",
        "rust",
        "json",
        "html",
        "css",
        "c",
        "cpp",
        "php",
        "ruby",
        "template",
        "scala",
      ],
      respectGitIgnore: true,
      storageMode: "wal",
      storageLocation: "repo-local",
      staleStatus: "unknown",
      summaryStrategy: DEFAULT_SUMMARY_STRATEGY,
      indexInclude: [],
      indexExclude: [],
      maxFilesDiscovered: DEFAULT_MAX_FILES_DISCOVERED,
      maxFileBytes: DEFAULT_MAX_FILE_BYTES,
      maxSymbolsPerFile: DEFAULT_MAX_SYMBOLS_PER_FILE,
      maxSymbolResults: DEFAULT_MAX_SYMBOL_RESULTS,
      maxTextResults: DEFAULT_MAX_TEXT_RESULTS,
      maxChildProcessOutputBytes: DEFAULT_MAX_CHILD_PROCESS_OUTPUT_BYTES,
      maxLiveSearchMatches: DEFAULT_MAX_LIVE_SEARCH_MATCHES,
      rankingWeights: DEFAULT_RANKING_WEIGHTS,
    });

    expect(config.paths.databasePath).toContain(".astrograph/index.sqlite");
    expect(config.fileProcessingConcurrency).toBeGreaterThanOrEqual(2);
    expect(ENGINE_STORAGE_VERSION).toBe(2);
    expect(ENGINE_SCHEMA_VERSION).toBe(7);
  });

  it("advertises the required engine tools", () => {
    expect(ENGINE_TOOLS).toEqual([
      "init",
      "index_folder",
      "index_file",
      "find_files",
      "search_text",
      "get_file_summary",
      "get_project_status",
      "get_repo_outline",
      "get_file_tree",
      "get_file_outline",
      "suggest_initial_queries",
      "search_symbols",
      "get_symbol_source",
      "get_task_context",
      "diagnostics",
    ]);
    expect(MCP_COMMAND_REGISTRY.map((command) => command.mcpToolName)).toEqual(
      ENGINE_TOOLS.filter((toolName) => toolName !== "init"),
    );
    expect(COMMAND_REGISTRY.indexFolder.normalizedOptions).toEqual([
      "repoRoot",
      "summaryStrategy",
    ]);
    expect(COMMAND_REGISTRY.queryCode.normalizedOptions).not.toContain("tokenBudget");
    expect(getCommandByCliCommand("query-code")).toBe(COMMAND_REGISTRY.queryCode);
    expect(getCommandByMcpToolName("query_code")).toBeUndefined();
    expect(getCommandByMcpToolName("search_symbols")).toBe(COMMAND_REGISTRY.searchSymbols);
    expect(getCommandByMcpToolName("get_symbol_source")).toBe(COMMAND_REGISTRY.getSymbolSource);
    expect(getCommandByMcpToolName("get_task_context")).toBe(COMMAND_REGISTRY.getTaskContext);
  });

  it("keeps the tracked Codex MCP configuration aligned with the v1 tool contract", async () => {
    const config = await readFile(path.join(process.cwd(), ".codex", "config.toml"), "utf8");
    const managed = config.match(/# BEGIN ASTROGRAPH[\s\S]*?# END ASTROGRAPH/);
    expect(managed).not.toBeNull();

    const managedContents = managed?.[0] ?? "";
    const enabledToolsMatch = managedContents.match(/^enabled_tools = \[([^\]]*)\]$/m);
    expect(enabledToolsMatch).not.toBeNull();
    const enabledTools = [...(enabledToolsMatch?.[1] ?? "").matchAll(/"([^"]+)"/g)]
      .map((match) => match[1]);

    expect(enabledTools).toEqual(MCP_TOOL_DEFINITIONS.map((tool) => tool.name));
    for (const tool of MCP_TOOL_DEFINITIONS) {
      expect(managedContents).toContain(
        `[mcp_servers.astrograph.tools.${tool.name}]\napproval_mode = "approve"`,
      );
    }
    expect(managedContents).not.toContain("query_code");
    expect(managedContents).not.toContain("[mcp_servers.github]");
    expect(config).toContain("[mcp_servers.github]");
  });

  it("normalizes dispatch failures into MCP envelopes", async () => {
    const unknownToolResult = await dispatchTool("query_code", { repoRoot: "/tmp" });
    expect(unknownToolResult).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: "tool_not_found",
      },
      meta: {
        toolVersion: "1",
        tokenBudgetUsed: null,
        dataFreshness: "unknown",
      },
    });

    const invalidArgResult = await dispatchTool("search_symbols", {
      repoRoot: "/tmp",
      query: "Greeter",
      kind: "bogus",
    });
    expect(invalidArgResult).toMatchObject({
      ok: false,
      error: {
        code: "invalid_argument",
      },
    });
  });

  it("rejects malformed MCP tool output with a strict failure envelope", async () => {
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
        repoRoot: "/tmp",
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
  });

  it("rejects malformed get_symbol_source output with a strict failure envelope", async () => {
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
        repoRoot: "/tmp",
        symbolId: "fake-symbol",
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
  });

  it("rejects malformed get_task_context output with a strict failure envelope", async () => {
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
        repoRoot: "/tmp",
        items: "not-an-array",
      });

      const malformedResult = await dispatchTool("get_task_context", {
        repoRoot: "/tmp",
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
  });

  it("uses package.json as the canonical Astrograph version source", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      version: string;
    };

    expect(ASTROGRAPH_PACKAGE_VERSION).toBe(packageJson.version);
    expect(parseAstrographVersion(ASTROGRAPH_PACKAGE_VERSION)).toEqual(
      ASTROGRAPH_VERSION_PARTS,
    );
  });

  it("publishes package metadata that makes the local-first alpha intent explicit", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      description: string;
      keywords: string[];
      homepage: string;
      repository: {
        type: string;
        url: string;
      };
      bugs: {
        url: string;
      };
      engines: {
        node: string;
      };
    };

    expect(packageJson.description).toBe(
      "Local deterministic context engine for AI-assisted code exploration",
    );
    expect(packageJson.keywords).toEqual(
      expect.arrayContaining([
        "astrograph",
        "mcp",
        "code-indexing",
        "code-search",
        "local-first",
        "sqlite",
      ]),
    );
    expect(packageJson.homepage).toBe("https://github.com/mortenbroesby/astrograph");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/mortenbroesby/astrograph.git",
    });
    expect(packageJson.bugs).toEqual({
      url: "https://github.com/mortenbroesby/astrograph/issues",
    });
    expect(packageJson.engines).toEqual({
      node: ">=22.12.0",
    });
  });

  it("advertises profiling scripts and ignores generated profiling artifacts", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    const rootGitignore = await readFile(
      new URL("../.gitignore", import.meta.url),
      "utf8",
    );

    expect(packageJson.scripts).toMatchObject({
      "profile:index:clinic":
        "clinic flame --dest .profiles/clinic/index --name astrograph-index -- node --experimental-strip-types ./scripts/perf-index.mjs",
      "profile:query:clinic":
        "clinic doctor --dest .profiles/clinic/query --name astrograph-query -- node --experimental-strip-types ./scripts/perf-query.mjs",
      "profile:index:0x":
        "0x --output-dir .profiles/0x/index -- node --experimental-strip-types ./scripts/perf-index.mjs",
      "profile:query:0x":
        "0x --output-dir .profiles/0x/query -- node --experimental-strip-types ./scripts/perf-query.mjs",
    });
    expect(rootGitignore).toContain(".profiles/");
  });

  it("enforces Astrograph bump rules with a monotonic alpha increment", () => {
    expect(
      assessAstrographVersionBump(
        { major: 0, minor: 0, patch: 1, increment: 0 },
        { major: 0, minor: 0, patch: 1, increment: 1 },
      ),
    ).toMatchObject({
      ok: true,
      kind: "increment",
    });

    expect(
      assessAstrographVersionBump(
        { major: 0, minor: 0, patch: 1, increment: 4 },
        { major: 0, minor: 0, patch: 2, increment: 5 },
      ),
    ).toMatchObject({
      ok: true,
      kind: "patch",
    });

    expect(
      assessAstrographVersionBump(
        { major: 0, minor: 0, patch: 1, increment: 4 },
        { major: 0, minor: 1, patch: 0, increment: 5 },
      ),
    ).toMatchObject({
      ok: true,
      kind: "minor",
    });

    expect(
      assessAstrographVersionBump(
        { major: 0, minor: 0, patch: 1, increment: 4 },
        { major: 0, minor: 1, patch: 0, increment: 4 },
      ),
    ).toMatchObject({
      ok: false,
      kind: null,
    });
  });

  it("loads repo-root config defaults when present", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-config-"));
    tempDirs.push(repoRoot);

    await writeFile(
      path.join(repoRoot, "astrograph.config.ts"),
      [
        "export default {",
        '  summaryStrategy: "signature-only",',
        '  storageMode: "wal",',
        "  ranking: {",
        "    exactName: 0,",
        "    filePathContains: 2000,",
        '    pathPresets: { generationCode: ["tools/**"] },',
        "  },",
        "  observability: {",
        "    enabled: true,",
        "    port: 0,",
        "    recentLimit: 17,",
        "    retentionDays: 5,",
        "    snapshotIntervalMs: 250,",
        "    redactSourceText: false,",
        "  },",
        "  performance: {",
        '    include: ["src/**/*.ts"],',
        '    exclude: ["**/*.test.ts"],',
        "    fileProcessingConcurrency: 1,",
        "    workerPool: {",
        "      enabled: true,",
        "      maxWorkers: 2,",
        "    },",
        "  },",
        "  watch: {",
        '    backend: "polling",',
        "    debounceMs: 175,",
        "  },",
        "  limits: {",
        "    maxFilesDiscovered: 1234,",
        "    maxFileBytes: 4321,",
        "    maxSymbolsPerFile: 7,",
        "    maxSymbolResults: 9,",
        "    maxTextResults: 8,",
        "    maxChildProcessOutputBytes: 7654,",
        "    maxLiveSearchMatches: 3,",
        "  },",
        "};",
        "",
      ].join("\n"),
    );

    const config = await loadRepoEngineConfig(repoRoot);

    expect(config.summaryStrategy).toBe("signature-only");
    expect(config.storageMode).toBe("wal");
    expect(config.ranking).toMatchObject({
      exactName: 0,
      filePathContains: 2000,
      exportedBonus: DEFAULT_RANKING_WEIGHTS.exportedBonus,
      pathPresets: {
        generationCode: ["tools/**"],
        appCode: [],
        sharedRuntime: [],
      },
    });
    expect(config.observability).toMatchObject({
      enabled: true,
      host: "127.0.0.1",
      port: 0,
      recentLimit: 17,
      retentionDays: 5,
      snapshotIntervalMs: 250,
      redactSourceText: false,
    });
    expect(config.performance.fileProcessingConcurrency).toBe(1);
    expect(config.performance.include).toEqual(["src/**/*.ts"]);
    expect(config.performance.exclude).toEqual(["**/*.test.ts"]);
    expect(config.performance.workerPool).toEqual({
      enabled: true,
      maxWorkers: 2,
    });
    expect(config.watch).toEqual({
      backend: "polling",
      debounceMs: 175,
    });
    expect(config.limits).toEqual({
      maxFilesDiscovered: 1234,
      maxFileBytes: 4321,
      maxSymbolsPerFile: 7,
      maxSymbolResults: 9,
      maxTextResults: 8,
      maxChildProcessOutputBytes: 7654,
      maxLiveSearchMatches: 3,
    });
    expect(config.configPath).toContain("astrograph.config.ts");
  });

  it("fails clearly for invalid repo-root config", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-config-"));
    tempDirs.push(repoRoot);

    await writeFile(
      path.join(repoRoot, "astrograph.config.ts"),
      [
        "export default {",
        "  observability: {",
        "    recentLimit: 0,",
        "  },",
        "};",
        "",
      ].join("\n"),
    );

    await expect(loadRepoEngineConfig(repoRoot)).rejects.toThrow(
      /Invalid astrograph\.config\.ts/i,
    );
  });

  it("loads a repository global storage selection and rejects an invalid value", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-config-"));
    tempDirs.push(repoRoot);

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({ storageLocation: "global" }),
    );
    await expect(loadRepoEngineConfig(repoRoot)).resolves.toMatchObject({
      storageLocation: "global",
    });

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({ storageLocation: "shared-database" }),
    );
    await expect(loadRepoEngineConfig(repoRoot)).rejects.toThrow(
      /Invalid astrograph\.config\.json/i,
    );
  });

  it("uses the global storage default until a repository config overrides it", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-config-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-global-config-"));
    tempDirs.push(repoRoot, configHome);
    const environment = {
      platform: "linux" as const,
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: () => "/unused",
    };
    const globalConfigPath = resolveGlobalConfigPath(environment);
    await mkdir(path.dirname(globalConfigPath), { recursive: true });
    await writeFile(globalConfigPath, JSON.stringify({ storageLocation: "global" }));
    await expect(loadRepoEngineConfig(repoRoot, { environment })).resolves.toMatchObject({
      storageLocation: "global",
      globalConfigPath,
    });

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({ storageLocation: "repo-local" }),
    );
    await expect(loadRepoEngineConfig(repoRoot, { environment })).resolves.toMatchObject({
      storageLocation: "repo-local",
      globalConfigPath,
    });
  });

  it("prunes global caches oldest-first only after explicit confirmation", async () => {
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-prune-"));
    tempDirs.push(cacheHome);
    const environment = {
      platform: "linux" as const,
      env: { XDG_CACHE_HOME: cacheHome },
      homeDir: () => "/unused",
    };
    const reposRoot = path.join(resolveGlobalCacheRoot(environment), "repos");
    const older = path.join(reposRoot, "a".repeat(64));
    const newer = path.join(reposRoot, "b".repeat(64));
    await mkdir(older, { recursive: true });
    await mkdir(newer, { recursive: true });
    await writeFile(path.join(older, "payload"), "a".repeat(20));
    await writeFile(path.join(newer, "payload"), "b".repeat(30));
    await utimes(older, new Date(1_000), new Date(1_000));
    await utimes(newer, new Date(2_000), new Date(2_000));

    const preview = await pruneGlobalCaches(30, true, environment);
    expect(preview.dryRun).toBe(true);
    expect(preview.candidates).toEqual([
      expect.objectContaining({ storageDir: older, active: false, removed: false }),
    ]);
    await expect(stat(older)).resolves.toBeDefined();

    const pruned = await pruneGlobalCaches(30, false, environment);
    expect(pruned.candidates).toEqual([
      expect.objectContaining({ storageDir: older, active: false, removed: true, archive: expect.objectContaining({ reason: "prune" }) }),
    ]);
    await expect(stat(older)).rejects.toMatchObject({ code: "ENOENT" });
    const archive = pruned.candidates[0]!.archive;
    await expect(readFile(path.join(archive!.archivePath, "payload"), "utf8")).resolves.toBe("a".repeat(20));
    expect(archive).toMatchObject({ bytes: 20, recoveryCommand: expect.stringContaining("astrograph cache restore") });
    await expect(readFile(`${archive!.archivePath}.receipt.json`, "utf8")).resolves.toContain('"recoveryCommand"');
    await expect(stat(newer)).resolves.toBeDefined();
  });

  it("restores an explicitly archived global cache only with confirmation", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-restore-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-restore-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-restore-root-"));
    tempDirs.push(repoRoot, configHome, cacheHome);
    const environment = { platform: "linux" as const, env: { XDG_CONFIG_HOME: configHome, XDG_CACHE_HOME: cacheHome }, homeDir: () => "/unused" };
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "global" }));
    const storageDir = resolveEnginePaths(repoRoot, { storageLocation: "global", environment }).storageDir;
    await mkdir(storageDir, { recursive: true });
    await writeFile(path.join(storageDir, "payload"), "restore me");
    const archived = await removeGlobalCache(repoRoot, false, environment);
    const receiptPath = `${archived.archive!.archivePath}.receipt.json`;
    await expect(restoreGlobalCache(repoRoot, receiptPath, true, environment)).resolves.toMatchObject({ changed: false });
    await expect(stat(storageDir)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(restoreGlobalCache(repoRoot, receiptPath, false, environment)).resolves.toMatchObject({ changed: true });
    await expect(readFile(path.join(storageDir, "payload"), "utf8")).resolves.toBe("restore me");
    await expect(restoreGlobalCache(repoRoot, receiptPath, false, environment)).rejects.toThrow(
      /missing or unsafe|restore over an existing/i,
    );
  });

  it("rejects malformed and out-of-root archive receipts before restoring", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-bad-receipt-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-bad-receipt-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-bad-receipt-root-"));
    tempDirs.push(repoRoot, configHome, cacheHome);
    const environment = { platform: "linux" as const, env: { XDG_CONFIG_HOME: configHome, XDG_CACHE_HOME: cacheHome }, homeDir: () => "/unused" };
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "global" }));
    const receiptPath = path.join(resolveGlobalCacheRoot(environment), "repos", ".archive", "bad.receipt.json");
    await mkdir(path.dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, JSON.stringify({ archivePath: "/tmp/not-astrograph", originalPath: "/tmp/not-astrograph", reason: "bad", archivedAt: "now" }));
    await expect(restoreGlobalCache(repoRoot, receiptPath, true, environment)).rejects.toThrow(/invalid schema|invalid archive path/i);
    await expect(restoreGlobalCache(repoRoot, receiptPath, false, environment)).rejects.toThrow(/invalid schema|invalid archive path/i);
  });

  it("refuses global cache removal while SQLite holds an exclusive lock", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-lock-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-lock-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-lock-root-"));
    tempDirs.push(repoRoot, configHome, cacheHome);
    const environment = { platform: "linux" as const, env: { XDG_CONFIG_HOME: configHome, XDG_CACHE_HOME: cacheHome }, homeDir: () => "/unused" };
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "global" }));
    const globalPath = resolveEnginePaths(repoRoot, { storageLocation: "global", environment }).databasePath;
    await mkdir(path.dirname(globalPath), { recursive: true });
    const lock = SQLITE_INDEX_BACKEND.open(globalPath);
    lock.exec("BEGIN EXCLUSIVE");
    try {
      await expect(removeGlobalCache(repoRoot, false, environment)).rejects.toThrow(
        /(Refusing to remove an active global Astrograph cache|database is locked)/i,
      );
      await expect(stat(globalPath)).resolves.toBeDefined();
    } finally {
      lock.exec("ROLLBACK");
      lock.close();
    }
  });

  it("rejects a symlinked global cache target before removal", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-symlink-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-symlink-root-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-symlink-outside-"));
    tempDirs.push(repoRoot, cacheHome, outside);
    const environment = { platform: "linux" as const, env: { XDG_CACHE_HOME: cacheHome }, homeDir: () => "/unused" };
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "global" }));
    const target = resolveEnginePaths(repoRoot, { storageLocation: "global", environment }).storageDir;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(path.join(outside, "outside.txt"), "do not remove");
    await symlink(outside, target, "dir");

    await expect(removeGlobalCache(repoRoot, false, environment)).rejects.toThrow(/Refusing symlinked cache path/i);
    await expect(readFile(path.join(outside, "outside.txt"), "utf8")).resolves.toBe("do not remove");
  });

  it("rejects unknown ranking path preset categories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-config-"));
    tempDirs.push(repoRoot);

    await writeFile(
      path.join(repoRoot, "astrograph.config.ts"),
      [
        "export default {",
        "  ranking: {",
        '    pathPresets: { unknownCategory: ["src/**"] },',
        "  },",
        "};",
        "",
      ].join("\n"),
    );

    await expect(loadRepoEngineConfig(repoRoot)).rejects.toThrow(
      /Invalid astrograph\.config\.ts/i,
    );
  });

  it("normalizes auto and bounded performance config values", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-config-"));
    tempDirs.push(repoRoot);

    await writeFile(
      path.join(repoRoot, "astrograph.config.ts"),
      [
        "export default {",
        '  storageMode: "wal",',
        "  ranking: {",
        "    exportedBonus: 5,",
        "  },",
        "  performance: {",
        '    fileProcessingConcurrency: "auto",',
        "  },",
        "};",
        "",
      ].join("\n"),
    );

    const autoConfig = await loadRepoEngineConfig(repoRoot);
    expect(autoConfig.performance.include).toEqual([]);
    expect(autoConfig.performance.exclude).toEqual([]);
    expect(autoConfig.performance.fileProcessingConcurrency).toBeGreaterThanOrEqual(2);
    expect(autoConfig.storageMode).toBe("wal");
    expect(autoConfig.ranking).toEqual({
      ...DEFAULT_RANKING_WEIGHTS,
      exportedBonus: 5,
      pathPresets: {
        generationCode: [],
        appCode: [],
        sharedRuntime: [],
      },
    });
    expect(autoConfig.performance.workerPool).toEqual({
      enabled: false,
      maxWorkers: expect.any(Number),
    });
    expect(autoConfig.observability.retentionDays).toBe(
      DEFAULT_OBSERVABILITY_RETENTION_DAYS,
    );
    expect(autoConfig.watch).toEqual({
      backend: "auto",
      debounceMs: DEFAULT_WATCH_DEBOUNCE_MS,
    });
    expect(autoConfig.limits).toEqual({
      maxFilesDiscovered: DEFAULT_MAX_FILES_DISCOVERED,
      maxFileBytes: DEFAULT_MAX_FILE_BYTES,
      maxSymbolsPerFile: DEFAULT_MAX_SYMBOLS_PER_FILE,
      maxSymbolResults: DEFAULT_MAX_SYMBOL_RESULTS,
      maxTextResults: DEFAULT_MAX_TEXT_RESULTS,
      maxChildProcessOutputBytes: DEFAULT_MAX_CHILD_PROCESS_OUTPUT_BYTES,
      maxLiveSearchMatches: DEFAULT_MAX_LIVE_SEARCH_MATCHES,
    });

    await writeFile(
      path.join(repoRoot, "astrograph.config.ts"),
      [
        "export default {",
        "  performance: {",
        "    fileProcessingConcurrency: 99,",
        "    workerPool: {",
        "      enabled: true,",
        "      maxWorkers: 99,",
        "    },",
        "  },",
        "};",
        "",
      ].join("\n"),
    );

    const boundedConfig = await loadRepoEngineConfig(repoRoot);
    expect(boundedConfig.performance.fileProcessingConcurrency).toBe(32);
    expect(boundedConfig.performance.workerPool).toEqual({
      enabled: true,
      maxWorkers: 16,
    });
  });

  it("renders a managed Codex MCP block for standalone install", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForCodex(repoRoot, { dryRun: true });

    expect(result.packageName).toBe("astrograph");
    expect(result.configPath).toContain(path.join(".codex", "config.toml"));
    expect(result.engineConfigPath).toContain("astrograph.config.ts");
    expect(result.engineConfigPreview).toContain(
      'import { defineConfig } from "astrograph";',
    );
    expect(result.engineConfigPreview).toContain("export default defineConfig({");
    expect(result.engineConfigPreview).toContain("performance:");
    expect(result.engineConfigPreview).toContain("node_modules/**");
    expect(result.configPreview).toContain("[mcp_servers.astrograph]");
    expect(result.configPreview).toContain('command = "npx"');
    expect(result.configPreview).toContain(
      'args = ["-y", "--package", "astrograph@latest", "astrograph", "mcp"]',
    );
  });

  it("installs one idempotent global Codex server and opts into global storage", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-install-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-config-"));
    tempDirs.push(homeDir, configHome);
    const environment = {
      platform: "linux" as const,
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: () => homeDir,
    };
    const codexConfigPath = path.join(homeDir, ".codex", "config.toml");
    await mkdir(path.dirname(codexConfigPath), { recursive: true });
    await writeFile(codexConfigPath, "[mcp_servers.unrelated]\ncommand = \"keep\"\n");

    const first = await setupGlobalForCodex({ environment, executableAvailable: true });
    const second = await setupGlobalForCodex({ environment, executableAvailable: true });

    expect(first.configPath).toBe(codexConfigPath);
    expect(second.configPreview).toBe(first.configPreview);
    expect(first.configPreview).toContain('command = "astrograph"');
    expect(first.configPreview).toContain('args = ["mcp"]');
    expect(first.configPreview).toContain('"get_project_status"');
    expect(first.configPreview).toContain('"find_files"');
    expect(first.configPreview).toContain('"search_text"');
    expect(first.configPreview).toContain('"get_file_summary"');
    expect(first.configPreview).toContain("[mcp_servers.unrelated]");
    expect(JSON.parse(await readFile(first.engineConfigPath, "utf8"))).toEqual({
      storageLocation: "global",
    });
  });

  it("installs one idempotent global Copilot CLI server without replacing unrelated servers", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-home-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-config-"));
    tempDirs.push(homeDir, configHome);
    const environment = {
      platform: "linux" as const,
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: () => homeDir,
    };
    const copilotConfigPath = path.join(homeDir, ".copilot", "mcp-config.json");
    await mkdir(path.dirname(copilotConfigPath), { recursive: true });
    await writeFile(copilotConfigPath, JSON.stringify({
      mcpServers: {
        unrelated: { type: "local", command: "keep", args: [] },
      },
      unrelatedSetting: true,
    }, null, 2));

    const first = await setupGlobalForCopilotCli({ environment, executableAvailable: true });
    const second = await setupGlobalForCopilotCli({ environment, executableAvailable: true });

    expect(first.ide).toBe("copilot-cli");
    expect(first.configPath).toBe(copilotConfigPath);
    expect(second.configPreview).toBe(first.configPreview);
    expect(JSON.parse(first.configPreview)).toMatchObject({
      unrelatedSetting: true,
      mcpServers: {
        unrelated: { command: "keep" },
        astrograph: {
          type: "local",
          command: "astrograph",
          args: ["mcp"],
          env: {},
          tools: expect.arrayContaining([
            "get_project_status",
            "find_files",
            "search_text",
            "get_file_summary",
          ]),
        },
      },
    });
    expect(JSON.parse(await readFile(first.engineConfigPath, "utf8"))).toEqual({
      storageLocation: "global",
    });
  });

  it("explains global setup without exposing managed configuration contents", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-install-message-home-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-install-message-config-"));
    tempDirs.push(homeDir, configHome);

    const result = await setupGlobalForCodex({
      dryRun: true,
      environment: {
        platform: "linux",
        env: { XDG_CONFIG_HOME: configHome },
        homeDir: () => homeDir,
      },
      executableAvailable: true,
    });

    const output = formatGlobalInstallation(result, { dryRun: true });
    expect(output).toContain("Preview complete — no files were changed.");
    expect(output).toContain(`Astrograph ${ASTROGRAPH_PACKAGE_VERSION} is connected to Codex.`);
    expect(output).toContain("One private, isolated index per repository");
    expect(output).toContain("astrograph install --global --ide codex");
    expect(output).not.toContain(result.configPreview);
  });

  it("explains repository setup without exposing generated configuration contents", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-local-install-message-"));
    tempDirs.push(repoRoot);
    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
    });

    const result = await setupForAllIdes(repoRoot, { dryRun: true, agentsPolicy: true });
    const output = formatRepositoryInstallation(result, { dryRun: true });
    const first = Array.isArray(result) ? result[0] : result;

    expect(output).toContain("Preview complete — no files were changed.");
    expect(output).toContain(`Astrograph ${ASTROGRAPH_PACKAGE_VERSION} is connected to Codex.`);
    expect(output).toContain("A local index that stays with this repository");
    expect(output).toContain("astrograph init --yes");
    expect(output).not.toContain(first.configPreview);
    expect(output).not.toContain(first.engineConfigPreview);
  });

  it("reports the default Copilot CLI global setup and cache location without writing state", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-diagnostics-home-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-diagnostics-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-diagnostics-cache-"));
    tempDirs.push(homeDir, configHome, cacheHome);
    const environment = {
      platform: "linux" as const,
      env: { XDG_CONFIG_HOME: configHome, ASTROGRAPH_CACHE_HOME: cacheHome },
      homeDir: () => homeDir,
    };

    const before = await getGlobalInstallationDiagnostics(environment);
    expect(before).toMatchObject({
      schemaVersion: 1,
      defaultGlobalIde: "copilot-cli",
      storage: {
        location: "not-configured",
        cacheRoot: path.join(cacheHome, "astrograph"),
        cacheRootExists: false,
      },
    });
    expect(before.clients).toEqual(expect.arrayContaining([
      expect.objectContaining({ ide: "copilot-cli", configured: false }),
      expect.objectContaining({ ide: "codex", configured: false }),
    ]));

    await setupGlobalForCopilotCli({ environment, executableAvailable: true });
    const after = await getGlobalInstallationDiagnostics(environment);
    expect(after.storage).toMatchObject({ location: "global" });
    expect(after.clients).toEqual(expect.arrayContaining([
      expect.objectContaining({ ide: "copilot-cli", configured: true }),
    ]));
  });

  it("uses COPILOT_HOME for global Copilot CLI setup", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-home-"));
    const copilotHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-config-home-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-config-"));
    tempDirs.push(homeDir, copilotHome, configHome);

    const result = await setupGlobalForCopilotCli({
      environment: {
        platform: "linux",
        env: { COPILOT_HOME: copilotHome, XDG_CONFIG_HOME: configHome },
        homeDir: () => homeDir,
      },
      executableAvailable: true,
    });

    expect(result.configPath).toBe(path.join(copilotHome, "mcp-config.json"));
    await expect(readFile(result.configPath, "utf8")).resolves.toContain('"astrograph"');
  });

  it("uses one global Codex setup across unconfigured repositories", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-home-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-cache-"));
    const firstRepo = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-first-"));
    const secondRepo = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-second-"));
    tempDirs.push(homeDir, configHome, cacheHome, firstRepo, secondRepo);
    const environment = {
      platform: process.platform,
      env: {
        XDG_CONFIG_HOME: configHome,
        ASTROGRAPH_CACHE_HOME: cacheHome,
        ASTROGRAPH_HOME: path.join(homeDir, ".astrograph"),
      },
      homeDir: () => homeDir,
    };
    const previousHome = process.env.HOME;
    const previousConfigHome = process.env.XDG_CONFIG_HOME;
    const previousCacheHome = process.env.ASTROGRAPH_CACHE_HOME;
    const previousAstrographHome = process.env.ASTROGRAPH_HOME;

    try {
      process.env.HOME = homeDir;
      process.env.XDG_CONFIG_HOME = configHome;
      process.env.ASTROGRAPH_CACHE_HOME = cacheHome;
      process.env.ASTROGRAPH_HOME = path.join(homeDir, ".astrograph");
      await setupGlobalForCodex({ environment, executableAvailable: true });
      await writeFile(path.join(firstRepo, "first.ts"), "export function firstGlobalFixture() { return true; }\n");
      await writeFile(path.join(secondRepo, "second.ts"), "export function secondGlobalFixture() { return true; }\n");
      clearStorageProcessCaches();

      await indexFolder({ repoRoot: firstRepo });
      await indexFolder({ repoRoot: secondRepo });
      const [firstStatus, secondStatus, firstSymbols, secondSymbols] = await Promise.all([
        cacheStatus(firstRepo),
        cacheStatus(secondRepo),
        searchSymbols({ repoRoot: firstRepo, query: "firstGlobalFixture" }),
        searchSymbols({ repoRoot: secondRepo, query: "secondGlobalFixture" }),
      ]);

      expect(firstStatus.storageLocation).toBe("global");
      expect(secondStatus.storageLocation).toBe("global");
      expect(firstStatus.storageDir).not.toBe(secondStatus.storageDir);
      expect(firstStatus.storageDir.startsWith(path.join(homeDir, ".astrograph", "cache", "repos"))).toBe(true);
      expect(secondStatus.storageDir.startsWith(path.join(homeDir, ".astrograph", "cache", "repos"))).toBe(true);
      expect(firstSymbols.map((symbol) => symbol.name)).toContain("firstGlobalFixture");
      expect(secondSymbols.map((symbol) => symbol.name)).toContain("secondGlobalFixture");
      await expect(stat(path.join(firstRepo, ".astrograph"))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(path.join(secondRepo, ".astrograph"))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(path.join(firstRepo, "astrograph.config.json"))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(path.join(secondRepo, "astrograph.config.json"))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(path.join(firstRepo, "astrograph.config.ts"))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(path.join(secondRepo, "astrograph.config.ts"))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(path.join(firstRepo, ".codex"))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(path.join(secondRepo, ".codex"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousConfigHome;
      if (previousCacheHome === undefined) delete process.env.ASTROGRAPH_CACHE_HOME;
      else process.env.ASTROGRAPH_CACHE_HOME = previousCacheHome;
      if (previousAstrographHome === undefined) delete process.env.ASTROGRAPH_HOME;
      else process.env.ASTROGRAPH_HOME = previousAstrographHome;
      clearStorageProcessCaches();
    }
  }, 15_000);

  it("uses one global Copilot CLI setup across unconfigured repositories", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-home-"));
    const copilotHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-config-home-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-cache-"));
    const firstRepo = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-first-"));
    const secondRepo = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-second-"));
    tempDirs.push(homeDir, copilotHome, configHome, cacheHome, firstRepo, secondRepo);
    const environment = {
      platform: process.platform,
      env: {
        COPILOT_HOME: copilotHome,
        XDG_CONFIG_HOME: configHome,
        ASTROGRAPH_CACHE_HOME: cacheHome,
        ASTROGRAPH_HOME: path.join(homeDir, ".astrograph"),
      },
      homeDir: () => homeDir,
    };
    const previousHome = process.env.HOME;
    const previousCopilotHome = process.env.COPILOT_HOME;
    const previousConfigHome = process.env.XDG_CONFIG_HOME;
    const previousCacheHome = process.env.ASTROGRAPH_CACHE_HOME;
    const previousAstrographHome = process.env.ASTROGRAPH_HOME;

    try {
      process.env.HOME = homeDir;
      process.env.COPILOT_HOME = copilotHome;
      process.env.XDG_CONFIG_HOME = configHome;
      process.env.ASTROGRAPH_CACHE_HOME = cacheHome;
      process.env.ASTROGRAPH_HOME = path.join(homeDir, ".astrograph");
      await setupGlobalForCopilotCli({ environment, executableAvailable: true });
      await writeFile(path.join(firstRepo, "first.ts"), "export function firstCopilotGlobalFixture() { return true; }\n");
      await writeFile(path.join(secondRepo, "second.ts"), "export function secondCopilotGlobalFixture() { return true; }\n");
      clearStorageProcessCaches();

      await indexFolder({ repoRoot: firstRepo });
      await indexFolder({ repoRoot: secondRepo });
      const [firstStatus, secondStatus, firstSymbols, secondSymbols] = await Promise.all([
        cacheStatus(firstRepo),
        cacheStatus(secondRepo),
        searchSymbols({ repoRoot: firstRepo, query: "firstCopilotGlobalFixture" }),
        searchSymbols({ repoRoot: secondRepo, query: "secondCopilotGlobalFixture" }),
      ]);

      expect(firstStatus.storageLocation).toBe("global");
      expect(secondStatus.storageLocation).toBe("global");
      expect(firstStatus.storageDir).not.toBe(secondStatus.storageDir);
      expect(firstStatus.storageDir.startsWith(path.join(homeDir, ".astrograph", "cache", "repos"))).toBe(true);
      expect(secondStatus.storageDir.startsWith(path.join(homeDir, ".astrograph", "cache", "repos"))).toBe(true);
      expect(firstSymbols.map((symbol) => symbol.name)).toContain("firstCopilotGlobalFixture");
      expect(secondSymbols.map((symbol) => symbol.name)).toContain("secondCopilotGlobalFixture");
      for (const repoRoot of [firstRepo, secondRepo]) {
        await expect(stat(path.join(repoRoot, ".mcp.json"))).rejects.toMatchObject({ code: "ENOENT" });
        await expect(stat(path.join(repoRoot, ".astrograph"))).rejects.toMatchObject({ code: "ENOENT" });
        await expect(stat(path.join(repoRoot, "astrograph.config.json"))).rejects.toMatchObject({ code: "ENOENT" });
        await expect(stat(path.join(repoRoot, "astrograph.config.ts"))).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousCopilotHome === undefined) delete process.env.COPILOT_HOME;
      else process.env.COPILOT_HOME = previousCopilotHome;
      if (previousConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousConfigHome;
      if (previousCacheHome === undefined) delete process.env.ASTROGRAPH_CACHE_HOME;
      else process.env.ASTROGRAPH_CACHE_HOME = previousCacheHome;
      if (previousAstrographHome === undefined) delete process.env.ASTROGRAPH_HOME;
      else process.env.ASTROGRAPH_HOME = previousAstrographHome;
      clearStorageProcessCaches();
    }
  }, 15_000);

  it("reports invalid and unwritable global Copilot CLI configuration before changing user state", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-invalid-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-copilot-invalid-config-"));
    const copilotConfigPath = path.join(homeDir, ".copilot", "mcp-config.json");
    tempDirs.push(homeDir, configHome);
    await mkdir(path.dirname(copilotConfigPath), { recursive: true });
    await writeFile(copilotConfigPath, "not-json");

    await expect(setupGlobalForCopilotCli({
      environment: { platform: "linux", env: { XDG_CONFIG_HOME: configHome }, homeDir: () => homeDir },
      executableAvailable: true,
    })).rejects.toThrow(/Invalid JSON config file.*mcp-config\.json/i);
    await expect(readFile(resolveGlobalConfigPath({
      platform: "linux",
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: () => homeDir,
    }), "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    await expect(setupGlobalForCopilotCli({
      environment: {
        platform: "linux",
        env: { COPILOT_HOME: "relative-copilot-home", XDG_CONFIG_HOME: configHome },
        homeDir: () => homeDir,
      },
      executableAvailable: true,
    })).rejects.toThrow(/COPILOT_HOME must be an absolute path/i);

    const blockedCopilotHome = path.join(homeDir, "blocked-copilot-home");
    await writeFile(blockedCopilotHome, "not-a-directory");
    await expect(setupGlobalForCopilotCli({
      environment: {
        platform: "linux",
        env: { COPILOT_HOME: blockedCopilotHome, XDG_CONFIG_HOME: configHome },
        homeDir: () => homeDir,
      },
      executableAvailable: true,
    })).rejects.toThrow(/Cannot read user configuration.*blocked-copilot-home/i);
  });

  it("reports actionable global-install prerequisites before writing user configuration", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-prerequisites-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-prerequisites-config-"));
    tempDirs.push(homeDir, configHome);
    const environment = { platform: "linux" as const, env: { XDG_CONFIG_HOME: configHome }, homeDir: () => homeDir };

    await expect(setupGlobalForCodex({ environment, nodeVersion: "20.11.0", executableAvailable: true }))
      .rejects.toThrow(/requires Node\.js >=22\.12\.0.*Install a supported Node/i);
    await expect(setupGlobalForCodex({ environment, executableAvailable: false }))
      .rejects.toThrow(/Cannot find `astrograph` on PATH.*npm install --global astrograph/i);
    await expect(readFile(path.join(homeDir, ".codex", "config.toml"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reports an unwritable global configuration location before registration is written", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-unwritable-"));
    const configHomeFile = path.join(homeDir, "not-a-directory");
    tempDirs.push(homeDir);
    await writeFile(configHomeFile, "blocked");
    const environment = { platform: "linux" as const, env: { XDG_CONFIG_HOME: configHomeFile }, homeDir: () => homeDir };

    await expect(setupGlobalForCodex({ environment, executableAvailable: true }))
      .rejects.toThrow(/Cannot read user configuration.*not-a-directory/i);
    await expect(readFile(path.join(homeDir, ".codex", "config.toml"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("replaces a legacy repo-local astrograph block with the portable package command", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-workspace-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    await mkdir(path.join(repoRoot, "tools", "ai-context-engine", "scripts"), {
      recursive: true,
    });
    await writeFile(
      path.join(repoRoot, "tools", "ai-context-engine", "scripts", "ai-context-engine.mjs"),
      "#!/usr/bin/env node\n",
    );
    await mkdir(path.join(repoRoot, ".codex"), { recursive: true });
    await writeFile(
      path.join(repoRoot, ".codex", "config.toml"),
      [
        "[mcp_servers.astrograph]",
        'command = "pnpm"',
        'args = ["exec", "astrograph", "mcp"]',
        'cwd = "."',
        "",
        "[features]",
        "codex_hooks = true",
        "",
      ].join("\n"),
    );

    const result = await setupForCodex(repoRoot, { dryRun: true });

    expect(result.configPreview).toContain('command = "npx"');
    expect(result.configPreview).toContain(
      'args = ["-y", "--package", "astrograph@latest", "astrograph", "mcp"]',
    );
    expect(result.configPreview.match(/\[mcp_servers\.astrograph\]/g)).toHaveLength(1);
    expect(result.configPreview).toContain("# END ASTROGRAPH\n\n[features]");
  });

  it("renders a managed Copilot MCP block for workspace installs", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-copilot-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForIde(repoRoot, {
      ide: "copilot",
      dryRun: true,
    });

    expect(result.configPath).toContain(path.join(".vscode", "mcp.json"));
    expect(result.configPreview).toContain('"servers"');
    expect(result.configPreview).toContain('"astrograph"');
    expect(result.configPreview).toContain('"command": "npx"');
    expect(result.configPreview).toContain('"type": "stdio"');
  });

  it("defaults standalone setup to Codex with an Astrograph config", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-defaults-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForAllIdes(repoRoot, { dryRun: true });
    if (Array.isArray(result)) {
      throw new Error("Expected default setup to target one IDE");
    }

    expect(result.ide).toBe("codex");
    expect(result.configPath).toContain(path.join(".codex", "config.toml"));
    expect(result.engineConfigPath).toContain("astrograph.config.ts");
    expect(result.engineConfigPreview).toContain("node_modules/**");
    expect(result.configPreview).toContain("index_folder");
    expect(result.agentsPolicyPath).toContain("AGENTS.md");
    expect(result.agentsPolicyUpdated).toBe(false);
    expect(result.agentsPolicyReason).toBe("not requested");
  });

  it("can opt into an AGENTS.md Astrograph code exploration policy", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-agents-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForAllIdes(repoRoot, {
      dryRun: true,
      agentsPolicy: true,
    });
    if (Array.isArray(result)) {
      throw new Error("Expected default setup to target one IDE");
    }

    expect(result.agentsPolicyPath).toContain("AGENTS.md");
    expect(result.agentsPolicyUpdated).toBe(false);
    expect(result.agentsPolicyReason).toBe("would add Astrograph code exploration policy");
    expect(result.agentsPolicyPreview).toContain("## Code Exploration with Astrograph");
    expect(result.agentsPolicyPreview).toContain("### Working agreements");
    expect(result.agentsPolicyPreview).toContain("get_project_status");
    expect(result.agentsPolicyPreview).toContain("index_folder");
    expect(result.agentsPolicyPreview).toContain("search_symbols");
    expect(result.agentsPolicyPreview).toContain("get_task_context");
    expect(result.agentsPolicyPreview).not.toContain("query_code");
  });

  it("writes copilot-instructions.md when --agents is used with copilot IDE", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-copilot-agents-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForAllIdes(repoRoot, {
      ides: ["copilot"],
      dryRun: true,
      agentsPolicy: true,
    });
    if (Array.isArray(result)) {
      throw new Error("Expected single IDE result");
    }

    expect(result.agentsPolicyPath).toContain(path.join(".github", "copilot-instructions.md"));
    expect(result.agentsPolicyUpdated).toBe(false);
    expect(result.agentsPolicyReason).toBe("would add Astrograph code exploration policy");
    expect(result.agentsPolicyPreview).toContain("## Code Exploration with Astrograph");
    expect(result.agentsPolicyPreview).toContain("get_project_status");
    expect(result.agentsPolicyPreview).toContain("index_folder");
  });

  it("does not add Astrograph as a dependency of itself", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-self-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({
        name: "astrograph",
        private: false,
      }, null, 2),
    );

    const result = await setupForAllIdes(repoRoot, { dryRun: true });
    if (Array.isArray(result)) {
      throw new Error("Expected default setup to target one IDE");
    }

    expect(result.packageDependencyUpdated).toBe(false);
    expect(result.packageDependencyReason).toBe("target package is Astrograph itself");
    expect(result.packageDependencyPreview).toBeUndefined();
  });

  it("writes all tools in Codex config", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-codex-full-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForCodex(repoRoot, {
      dryRun: true,
    });

    expect(result.configPreview).toContain("index_folder");
    expect(result.configPreview).toContain("search_symbols");
    expect(result.configPreview).toContain("get_symbol_source");
    expect(result.configPreview).toContain("get_task_context");
    expect(result.configPreview).not.toContain("query_code");
    expect(result.configPreview).toContain("diagnostics");
  });

  it("writes all tools in Copilot CLI config", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-copilot-cli-full-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForIde(repoRoot, {
      ide: "copilot-cli",
      dryRun: true,
    });

    expect(result.configPreview).toContain('"tools": [');
    expect(result.configPreview).toContain('"search_symbols"');
    expect(result.configPreview).toContain('"get_symbol_source"');
    expect(result.configPreview).toContain('"get_task_context"');
    expect(result.configPreview).not.toContain('"query_code"');
    expect(result.configPreview).toContain('"suggest_initial_queries"');
    expect(result.configPreview).toContain('"diagnostics"');
  });

  it("supports installing all requested IDEs in one run", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-all-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForAllIdes(repoRoot, {
      ides: ["all"],
      dryRun: true,
    });
    if (!Array.isArray(result)) {
      throw new Error("Expected multiple install results for all requested IDEs");
    }

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.ide).sort()).toEqual([
      "codex",
      "copilot",
      "copilot-cli",
    ].sort());
    const outputs = result.map((item) => item.configPath).join("\n");
    expect(outputs).toContain(path.join(".codex", "config.toml"));
    expect(outputs).toContain(path.join(".vscode", "mcp.json"));
    expect(outputs).toContain(".mcp.json");
  });

  it("renders a managed Copilot CLI MCP block for workspace installs", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-install-copilot-cli-"));
    tempDirs.push(repoRoot);

    await import("node:child_process").then(({ execFileSync }) => {
      execFileSync("git", ["init"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    });

    const result = await setupForIde(repoRoot, {
      ide: "copilot-cli",
      dryRun: true,
    });

    expect(result.configPath).toContain(path.join(".mcp.json"));
    expect(result.configPreview).toContain('"mcpServers"');
    expect(result.configPreview).toContain('"astrograph"');
    expect(result.configPreview).toContain('"command": "npx"');
    expect(result.configPreview).toContain('"type": "local"');
    expect(result.configPreview).toContain('"tools": [');
    expect(result.configPreview).toContain('"diagnostics"');
  });
});
