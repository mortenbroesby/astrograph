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
  migrateLocalCache,
  pruneGlobalCaches,
  removeGlobalCache,
  createDefaultEngineConfig,
  parseStorageLocation,
  parseAstrographVersion,
  resolveGlobalCacheRoot,
  resolveGlobalConfigPath,
  resolveEnginePaths,
} from "../src/index.ts";
import {
  COMMAND_REGISTRY,
  MCP_COMMAND_REGISTRY,
  getCommandByCliCommand,
  getCommandByMcpToolName,
} from "../src/command-registry.ts";
import { MCP_TOOL_DEFINITIONS } from "../src/mcp-contract.ts";
import { setupForAllIdes, setupForCodex, setupForIde, setupGlobalForCodex } from "../src/scripts/install.ts";
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

  it("uses platform-specific global cache roots without trusting relative XDG paths", () => {
    expect(resolveGlobalCacheRoot({
      platform: "linux",
      env: { XDG_CACHE_HOME: "relative-cache" },
      homeDir: () => "/home/example",
    })).toBe("/home/example/.cache/astrograph");
    expect(resolveGlobalCacheRoot({
      platform: "darwin",
      env: {},
      homeDir: () => "/Users/example",
    })).toBe("/Users/example/Library/Caches/astrograph");
    expect(resolveGlobalCacheRoot({
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Users\\example\\AppData\\Local" },
      homeDir: () => "C:\\Users\\example",
    })).toContain(path.join("astrograph", "cache"));
  });

  it("uses a platform-specific global configuration path", () => {
    expect(resolveGlobalConfigPath({
      platform: "linux",
      env: { XDG_CONFIG_HOME: "/var/config/user" },
      homeDir: () => "/home/example",
    })).toBe("/var/config/user/astrograph/config.json");
    expect(resolveGlobalConfigPath({
      platform: "darwin",
      env: {},
      homeDir: () => "/Users/example",
    })).toBe("/Users/example/Library/Application Support/astrograph/config.json");
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
      languages: ["ts", "tsx", "js", "jsx"],
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
    expect(ENGINE_STORAGE_VERSION).toBe(1);
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
      "get_context_bundle",
      "get_ranked_context",
      "diagnostics",
    ]);
    expect(MCP_COMMAND_REGISTRY.map((command) => command.mcpToolName)).toEqual(
      ENGINE_TOOLS.filter((toolName) => toolName !== "init"),
    );
    expect(COMMAND_REGISTRY.indexFolder.normalizedOptions).toEqual([
      "repoRoot",
      "summaryStrategy",
    ]);
    expect(COMMAND_REGISTRY.queryCode.normalizedOptions).toContain("tokenBudget");
    expect(getCommandByCliCommand("query-code")).toBe(COMMAND_REGISTRY.queryCode);
    expect(getCommandByMcpToolName("query_code")).toBeUndefined();
    expect(getCommandByMcpToolName("search_symbols")).toBe(COMMAND_REGISTRY.searchSymbols);
    expect(getCommandByMcpToolName("get_symbol_source")).toBe(COMMAND_REGISTRY.getSymbolSource);
    expect(getCommandByMcpToolName("get_context_bundle")).toBe(COMMAND_REGISTRY.getContextBundle);
    expect(getCommandByMcpToolName("get_ranked_context")).toBe(COMMAND_REGISTRY.getRankedContext);
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

  it("rejects malformed get_context_bundle output with a strict failure envelope", async () => {
    const tool = MCP_TOOL_DEFINITIONS.find((entry) => entry.name === "get_context_bundle");
    expect(tool).toBeDefined();

    const mutableTool = tool as unknown as { execute: (...args: any[]) => Promise<unknown> };
    const originalExecute = mutableTool.execute;
    try {
      mutableTool.execute = async () => ({
        tokenBudget: 128,
        usedTokens: 12,
        estimatedTokens: 18,
        truncated: false,
        query: "Greeter",
        repoRoot: "/tmp",
        items: "not-an-array",
      });

      const malformedResult = await dispatchTool("get_context_bundle", {
        repoRoot: "/tmp",
        query: "Greeter",
      });

      expect(malformedResult).toMatchObject({
        ok: false,
        data: null,
        error: {
          code: expect.stringMatching(/^(internal_error|invalid_argument)$/),
          message: expect.stringContaining("get_context_bundle output must include items"),
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

  it("copies a verified repository-local cache into an isolated global cache without removing the source", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-migration-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-migration-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-migration-root-"));
    tempDirs.push(repoRoot, configHome, cacheHome);
    await mkdir(path.join(repoRoot, "src"));
    await writeFile(path.join(repoRoot, "src", "entry.ts"), "export const migrationProof = true;\n");
    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({ storageLocation: "repo-local" }),
    );
    await indexFolder({ repoRoot });
    clearStorageProcessCaches();

    const environment = {
      platform: "linux" as const,
      env: { XDG_CONFIG_HOME: configHome, XDG_CACHE_HOME: cacheHome },
      homeDir: () => "/unused",
    };
    const globalConfigPath = resolveGlobalConfigPath(environment);
    await mkdir(path.dirname(globalConfigPath), { recursive: true });
    await writeFile(globalConfigPath, JSON.stringify({ storageLocation: "global" }));
    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({ storageLocation: "global" }),
    );

    const preview = await migrateLocalCache(repoRoot, true, environment);
    expect(preview.changed).toBe(false);
    expect(preview.message).toMatch(/would copy/i);
    const migrated = await migrateLocalCache(repoRoot, false, environment);
    expect(migrated.changed).toBe(true);
    const status = await cacheStatus(repoRoot, environment);
    expect(status).toMatchObject({ storageLocation: "global", migration: "already-migrated" });
    await expect(readFile(resolveEnginePaths(repoRoot).databasePath)).resolves.toBeDefined();
    await expect(readFile(status.storageDir + "/index.sqlite")).resolves.toBeDefined();
  });

  it("refuses an incompatible global destination and preserves the local cache", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-migration-conflict-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-migration-conflict-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-migration-conflict-root-"));
    tempDirs.push(repoRoot, configHome, cacheHome);
    await mkdir(path.join(repoRoot, "src"));
    await writeFile(path.join(repoRoot, "src", "entry.ts"), "export const preserveLocalCache = true;\n");
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "repo-local" }));
    await indexFolder({ repoRoot });
    clearStorageProcessCaches();
    const source = resolveEnginePaths(repoRoot).databasePath;
    const environment = {
      platform: "linux" as const,
      env: { XDG_CONFIG_HOME: configHome, XDG_CACHE_HOME: cacheHome },
      homeDir: () => "/unused",
    };
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "global" }));
    const destination = resolveEnginePaths(repoRoot, { storageLocation: "global", environment });
    await mkdir(destination.storageDir, { recursive: true });
    await writeFile(destination.storageVersionPath, JSON.stringify({ version: ENGINE_STORAGE_VERSION - 1 }));

    await expect(migrateLocalCache(repoRoot, false, environment)).rejects.toThrow(/incompatible storage version/i);
    await expect(readFile(source)).resolves.toBeDefined();
    await expect(readFile(destination.storageVersionPath, "utf8")).resolves.toContain(`"version":${ENGINE_STORAGE_VERSION - 1}`);
  });

  it("reports partial global migration staging and preserves the local cache for retry", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-migration-partial-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-migration-partial-root-"));
    tempDirs.push(repoRoot, cacheHome);
    await mkdir(path.join(repoRoot, "src"));
    await writeFile(path.join(repoRoot, "src", "entry.ts"), "export const retryMigration = true;\n");
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "repo-local" }));
    await indexFolder({ repoRoot });
    clearStorageProcessCaches();
    const source = resolveEnginePaths(repoRoot).databasePath;
    const environment = { platform: "linux" as const, env: { XDG_CACHE_HOME: cacheHome }, homeDir: () => "/unused" };
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "global" }));
    const destination = resolveEnginePaths(repoRoot, { storageLocation: "global", environment }).storageDir;
    const staging = `${destination}.migrating-interrupted`;
    await mkdir(staging, { recursive: true });
    await writeFile(path.join(staging, "partial"), "incomplete");

    await expect(migrateLocalCache(repoRoot, false, environment)).rejects.toThrow(/previous global cache migration is incomplete.*local cache was preserved/i);
    await expect(readFile(source)).resolves.toBeDefined();
    await expect(readFile(path.join(staging, "partial"), "utf8")).resolves.toBe("incomplete");
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
      expect.objectContaining({ storageDir: older, active: false, removed: true }),
    ]);
    await expect(stat(older)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(newer)).resolves.toBeDefined();
  });

  it("refuses global cache removal while SQLite holds an exclusive lock", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-lock-"));
    const configHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-lock-config-"));
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-lock-root-"));
    tempDirs.push(repoRoot, configHome, cacheHome);
    await mkdir(path.join(repoRoot, "src"));
    await writeFile(path.join(repoRoot, "src", "entry.ts"), "export const lockProof = true;\n");
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "repo-local" }));
    await indexFolder({ repoRoot });
    clearStorageProcessCaches();
    const environment = { platform: "linux" as const, env: { XDG_CONFIG_HOME: configHome, XDG_CACHE_HOME: cacheHome }, homeDir: () => "/unused" };
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "global" }));
    await migrateLocalCache(repoRoot, false, environment);
    const globalPath = resolveEnginePaths(repoRoot, { storageLocation: "global", environment }).databasePath;
    const lock = SQLITE_INDEX_BACKEND.open(globalPath);
    lock.exec("BEGIN EXCLUSIVE");
    try {
      await expect(removeGlobalCache(repoRoot, false, environment)).rejects.toThrow(/Refusing to remove an active global Astrograph cache/i);
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
    expect(first.configPreview).toContain("[mcp_servers.unrelated]");
    expect(JSON.parse(await readFile(first.engineConfigPath, "utf8"))).toEqual({
      storageLocation: "global",
    });
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
    expect(result.agentsPolicyPreview).toContain("get_context_bundle");
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
    expect(result.configPreview).toContain("get_context_bundle");
    expect(result.configPreview).toContain("get_ranked_context");
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
    expect(result.configPreview).toContain('"get_context_bundle"');
    expect(result.configPreview).toContain('"get_ranked_context"');
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
