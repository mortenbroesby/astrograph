import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  loadRepoEngineConfig,
  createDefaultEngineConfig,
  parseAstrographVersion,
  resolveEnginePaths,
} from "../src/index.ts";
import { installForCodex } from "../scripts/install.mjs";

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
      rawCacheDir: "/tmp/playground/.astrograph/raw-cache",
      eventsPath: "/tmp/playground/.astrograph/events.jsonl",
    });
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
    expect(ENGINE_SCHEMA_VERSION).toBe(4);
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
      "query_code",
      "diagnostics",
    ]);
  });

  it("uses package.json as the canonical Astrograph version source", () => {
    expect(ASTROGRAPH_PACKAGE_VERSION).toBe("0.1.0-alpha.59");
    expect(parseAstrographVersion(ASTROGRAPH_PACKAGE_VERSION)).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
      increment: 59,
    });
    expect(ASTROGRAPH_VERSION_PARTS).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
      increment: 59,
    });
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
      node: ">=24",
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
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        summaryStrategy: "signature-only",
        storageMode: "wal",
        ranking: {
          exactName: 0,
          filePathContains: 2000,
        },
        observability: {
          enabled: true,
          port: 0,
          recentLimit: 17,
          retentionDays: 5,
          snapshotIntervalMs: 250,
          redactSourceText: false,
        },
        performance: {
          include: ["src/**/*.ts"],
          exclude: ["**/*.test.ts"],
          fileProcessingConcurrency: 1,
          workerPool: {
            enabled: true,
            maxWorkers: 2,
          },
        },
        watch: {
          backend: "polling",
          debounceMs: 175,
        },
        limits: {
          maxFilesDiscovered: 1234,
          maxFileBytes: 4321,
          maxSymbolsPerFile: 7,
          maxSymbolResults: 9,
          maxTextResults: 8,
          maxChildProcessOutputBytes: 7654,
          maxLiveSearchMatches: 3,
        },
      }),
    );

    const config = await loadRepoEngineConfig(repoRoot);

    expect(config.summaryStrategy).toBe("signature-only");
    expect(config.storageMode).toBe("wal");
    expect(config.ranking).toMatchObject({
      exactName: 0,
      filePathContains: 2000,
      exportedBonus: DEFAULT_RANKING_WEIGHTS.exportedBonus,
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
    expect(config.configPath).toContain("astrograph.config.json");
  });

  it("fails clearly for invalid repo-root config", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-config-"));
    tempDirs.push(repoRoot);

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        observability: {
          recentLimit: 0,
        },
      }),
    );

    await expect(loadRepoEngineConfig(repoRoot)).rejects.toThrow(
      /Invalid astrograph\.config\.json/i,
    );
  });

  it("normalizes auto and bounded performance config values", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-config-"));
    tempDirs.push(repoRoot);

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        storageMode: "wal",
        ranking: {
          exportedBonus: 5,
        },
        performance: {
          fileProcessingConcurrency: "auto",
        },
      }),
    );

    const autoConfig = await loadRepoEngineConfig(repoRoot);
    expect(autoConfig.performance.include).toEqual([]);
    expect(autoConfig.performance.exclude).toEqual([]);
    expect(autoConfig.performance.fileProcessingConcurrency).toBeGreaterThanOrEqual(2);
    expect(autoConfig.storageMode).toBe("wal");
    expect(autoConfig.ranking).toEqual({
      ...DEFAULT_RANKING_WEIGHTS,
      exportedBonus: 5,
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
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        performance: {
          fileProcessingConcurrency: 99,
          workerPool: {
            enabled: true,
            maxWorkers: 99,
          },
        },
      }),
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

    const result = await installForCodex(repoRoot, { dryRun: true });

    expect(result.packageName).toBe("@mortenbroesby/astrograph");
    expect(result.configPath).toContain(path.join(".codex", "config.toml"));
    expect(result.configPreview).toContain("[mcp_servers.astrograph]");
    expect(result.configPreview).toContain('command = "npx"');
    expect(result.configPreview).toContain('args = ["@mortenbroesby/astrograph", "mcp"]');
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

    const result = await installForCodex(repoRoot, { dryRun: true });

    expect(result.configPreview).toContain('command = "npx"');
    expect(result.configPreview).toContain(
      'args = ["@mortenbroesby/astrograph", "mcp"]',
    );
    expect(result.configPreview.match(/\[mcp_servers\.astrograph\]/g)).toHaveLength(1);
    expect(result.configPreview).toContain("# END ASTROGRAPH\n\n[features]");
  });
});
