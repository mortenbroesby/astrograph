import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { z } from "zod";

import { getSupportedLanguages } from "./language-registry.ts";
import type {
  EngineConfig,
  EnginePaths,
  RepoPerformanceConfig,
  RepoRankingConfig,
  RepoEngineConfig,
  ResolvedRepoEngineConfig,
  EngineToolName,
  RankingWeights,
  SymbolKind,
  SummaryStrategy,
} from "./types.ts";
import { SUMMARY_STRATEGIES as SUMMARY_STRATEGY_VALUES } from "./types.ts";

export const ENGINE_STORAGE_DIRNAME = ".astrograph";
export const ENGINE_STORAGE_VERSION = 1;
export const ENGINE_SCHEMA_VERSION = 4;
export const ENGINE_CONFIG_FILENAME = "astrograph.config.ts";
export const ENGINE_LEGACY_CONFIG_FILENAME = "astrograph.config.json";
export const ENGINE_DISPLAY_NAME = "@astrograph";
export const DEFAULT_SUMMARY_STRATEGY: SummaryStrategy = "doc-comments-first";
export const DEFAULT_OBSERVABILITY_HOST = "127.0.0.1";
export const DEFAULT_OBSERVABILITY_PORT = 34323;
export const DEFAULT_OBSERVABILITY_RECENT_LIMIT = 100;
export const DEFAULT_OBSERVABILITY_RETENTION_DAYS = 3;
export const DEFAULT_OBSERVABILITY_SNAPSHOT_INTERVAL_MS = 1000;
export const DEFAULT_WATCH_DEBOUNCE_MS = 100;
export const DEFAULT_MAX_FILES_DISCOVERED = 100_000;
export const DEFAULT_MAX_FILE_BYTES = 250_000;
export const DEFAULT_MAX_SYMBOLS_PER_FILE = 2_000;
export const DEFAULT_MAX_SYMBOL_RESULTS = 20;
export const DEFAULT_MAX_TEXT_RESULTS = 100;
export const DEFAULT_MAX_CHILD_PROCESS_OUTPUT_BYTES = 1_000_000;
export const DEFAULT_MAX_LIVE_SEARCH_MATCHES = 100;
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  exactName: 1000,
  exactQualifiedName: 900,
  prefixName: 700,
  prefixQualifiedName: 650,
  containsName: 500,
  containsQualifiedName: 450,
  signatureContains: 250,
  summaryContains: 200,
  filePathContains: 120,
  exactWord: 180,
  tokenMatch: 70,
  exportedBonus: 20,
};

const SUMMARY_STRATEGIES = new Set<SummaryStrategy>(SUMMARY_STRATEGY_VALUES);

const SYMBOL_KINDS = new Set<SymbolKind>([
  "function",
  "class",
  "method",
  "constant",
  "type",
]);

export const ENGINE_TOOLS: EngineToolName[] = [
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
];

const repoObservabilityConfigSchema = z.object({
  enabled: z.boolean().optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().nonnegative().optional(),
  recentLimit: z.number().int().positive().optional(),
  retentionDays: z.number().int().positive().optional(),
  snapshotIntervalMs: z.number().int().positive().optional(),
  redactSourceText: z.boolean().optional(),
});

const repoPerformanceConfigSchema = z.object({
  include: z.array(z.string().min(1)).optional(),
  exclude: z.array(z.string().min(1)).optional(),
  fileProcessingConcurrency: z.union([
    z.literal("auto"),
    z.number().int().positive(),
  ]).optional(),
  workerPool: z.object({
    enabled: z.boolean().optional(),
    maxWorkers: z.union([
      z.literal("auto"),
      z.number().int().positive(),
    ]).optional(),
  }).optional(),
});

const repoWatchConfigSchema = z.object({
  backend: z.enum(["auto", "parcel", "node-fs-watch", "polling"]).optional(),
  debounceMs: z.number().int().positive().optional(),
});

const repoRankingConfigSchema = z.object({
  exactName: z.number().finite().nonnegative().optional(),
  exactQualifiedName: z.number().finite().nonnegative().optional(),
  prefixName: z.number().finite().nonnegative().optional(),
  prefixQualifiedName: z.number().finite().nonnegative().optional(),
  containsName: z.number().finite().nonnegative().optional(),
  containsQualifiedName: z.number().finite().nonnegative().optional(),
  signatureContains: z.number().finite().nonnegative().optional(),
  summaryContains: z.number().finite().nonnegative().optional(),
  filePathContains: z.number().finite().nonnegative().optional(),
  exactWord: z.number().finite().nonnegative().optional(),
  tokenMatch: z.number().finite().nonnegative().optional(),
  exportedBonus: z.number().finite().nonnegative().optional(),
});

const repoLimitsConfigSchema = z.object({
  maxFilesDiscovered: z.number().int().positive().optional(),
  maxFileBytes: z.number().int().positive().optional(),
  maxSymbolsPerFile: z.number().int().positive().optional(),
  maxSymbolResults: z.number().int().positive().optional(),
  maxTextResults: z.number().int().positive().optional(),
  maxChildProcessOutputBytes: z.number().int().positive().optional(),
  maxLiveSearchMatches: z.number().int().positive().optional(),
});

const repoEngineConfigSchema = z.object({
  summaryStrategy: z.enum(SUMMARY_STRATEGY_VALUES).optional(),
  storageMode: z.enum(["wal"]).optional(),
  observability: repoObservabilityConfigSchema.optional(),
  performance: repoPerformanceConfigSchema.optional(),
  ranking: repoRankingConfigSchema.optional(),
  watch: repoWatchConfigSchema.optional(),
  limits: repoLimitsConfigSchema.optional(),
}) satisfies z.ZodType<RepoEngineConfig>;

type WorkerPoolMaxWorkersValue = number | "auto" | undefined;

function defaultFileProcessingConcurrency(): number {
  return Math.max(2, Math.min(16, os.availableParallelism()));
}

function normalizeFileProcessingConcurrency(
  value: RepoPerformanceConfig["fileProcessingConcurrency"],
): number {
  if (value === undefined || value === "auto") {
    return defaultFileProcessingConcurrency();
  }

  return Math.max(1, Math.min(32, Math.trunc(value)));
}

function defaultWorkerPoolMaxWorkers(): number {
  return Math.max(1, Math.min(8, os.availableParallelism() - 1));
}

function normalizeWorkerPoolMaxWorkers(
  value: WorkerPoolMaxWorkersValue,
): number {
  if (value === undefined || value === "auto") {
    return defaultWorkerPoolMaxWorkers();
  }

  return Math.max(1, Math.min(16, Math.trunc(value)));
}

function resolveRankingWeights(
  value: RepoRankingConfig | undefined,
): RankingWeights {
  return {
    exactName: value?.exactName ?? DEFAULT_RANKING_WEIGHTS.exactName,
    exactQualifiedName:
      value?.exactQualifiedName ?? DEFAULT_RANKING_WEIGHTS.exactQualifiedName,
    prefixName: value?.prefixName ?? DEFAULT_RANKING_WEIGHTS.prefixName,
    prefixQualifiedName:
      value?.prefixQualifiedName ?? DEFAULT_RANKING_WEIGHTS.prefixQualifiedName,
    containsName: value?.containsName ?? DEFAULT_RANKING_WEIGHTS.containsName,
    containsQualifiedName:
      value?.containsQualifiedName ?? DEFAULT_RANKING_WEIGHTS.containsQualifiedName,
    signatureContains:
      value?.signatureContains ?? DEFAULT_RANKING_WEIGHTS.signatureContains,
    summaryContains:
      value?.summaryContains ?? DEFAULT_RANKING_WEIGHTS.summaryContains,
    filePathContains:
      value?.filePathContains ?? DEFAULT_RANKING_WEIGHTS.filePathContains,
    exactWord: value?.exactWord ?? DEFAULT_RANKING_WEIGHTS.exactWord,
    tokenMatch: value?.tokenMatch ?? DEFAULT_RANKING_WEIGHTS.tokenMatch,
    exportedBonus:
      value?.exportedBonus ?? DEFAULT_RANKING_WEIGHTS.exportedBonus,
  };
}

export function resolveEnginePaths(repoRoot: string): EnginePaths {
  const storageDir = path.join(repoRoot, ENGINE_STORAGE_DIRNAME);

  return {
    storageDir,
    databasePath: path.join(storageDir, "index.sqlite"),
    repoMetaPath: path.join(storageDir, "repo-meta.json"),
    integrityPath: path.join(storageDir, "integrity.sha256"),
    storageVersionPath: path.join(storageDir, "storage-version.json"),
    eventsPath: path.join(storageDir, "events.jsonl"),
  };
}

export async function resolveEngineRepoRoot(repoRoot: string): Promise<string> {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const resolvedRepoRoot = await realpath(absoluteRepoRoot).catch(
    () => absoluteRepoRoot,
  );

  try {
    const worktreeRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: resolvedRepoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return await realpath(worktreeRoot).catch(() => worktreeRoot);
  } catch {
    return resolvedRepoRoot;
  }
}

function createDefaultResolvedRepoEngineConfig(
  repoRoot: string,
): ResolvedRepoEngineConfig {
  return {
    configPath: null,
    repoRoot,
    summaryStrategy: DEFAULT_SUMMARY_STRATEGY,
    storageMode: "wal",
    observability: {
      enabled: false,
      host: DEFAULT_OBSERVABILITY_HOST,
      port: DEFAULT_OBSERVABILITY_PORT,
      recentLimit: DEFAULT_OBSERVABILITY_RECENT_LIMIT,
      retentionDays: DEFAULT_OBSERVABILITY_RETENTION_DAYS,
      snapshotIntervalMs: DEFAULT_OBSERVABILITY_SNAPSHOT_INTERVAL_MS,
      redactSourceText: true,
    },
    performance: {
      include: [],
      exclude: [],
      fileProcessingConcurrency: defaultFileProcessingConcurrency(),
      workerPool: {
        enabled: false,
        maxWorkers: defaultWorkerPoolMaxWorkers(),
      },
    },
    ranking: { ...DEFAULT_RANKING_WEIGHTS },
    watch: {
      backend: "auto",
      debounceMs: DEFAULT_WATCH_DEBOUNCE_MS,
    },
    limits: {
      maxFilesDiscovered: DEFAULT_MAX_FILES_DISCOVERED,
      maxFileBytes: DEFAULT_MAX_FILE_BYTES,
      maxSymbolsPerFile: DEFAULT_MAX_SYMBOLS_PER_FILE,
      maxSymbolResults: DEFAULT_MAX_SYMBOL_RESULTS,
      maxTextResults: DEFAULT_MAX_TEXT_RESULTS,
      maxChildProcessOutputBytes: DEFAULT_MAX_CHILD_PROCESS_OUTPUT_BYTES,
      maxLiveSearchMatches: DEFAULT_MAX_LIVE_SEARCH_MATCHES,
    },
  };
}

function resolveEngineConfigFromParsed(
  configPath: string,
  resolvedRepoRoot: string,
  data: RepoEngineConfig,
  defaults: ResolvedRepoEngineConfig,
): ResolvedRepoEngineConfig {
  return {
    configPath,
    repoRoot: resolvedRepoRoot,
    summaryStrategy: data.summaryStrategy ?? defaults.summaryStrategy,
    storageMode: data.storageMode ?? defaults.storageMode,
    observability: {
      enabled: data.observability?.enabled ?? defaults.observability.enabled,
      host: data.observability?.host ?? defaults.observability.host,
      port: data.observability?.port ?? defaults.observability.port,
      recentLimit: data.observability?.recentLimit ?? defaults.observability.recentLimit,
      retentionDays: data.observability?.retentionDays ?? defaults.observability.retentionDays,
      snapshotIntervalMs: data.observability?.snapshotIntervalMs ?? defaults.observability.snapshotIntervalMs,
      redactSourceText: data.observability?.redactSourceText ?? defaults.observability.redactSourceText,
    },
    performance: {
      include: data.performance?.include ?? defaults.performance.include,
      exclude: data.performance?.exclude ?? defaults.performance.exclude,
      fileProcessingConcurrency: normalizeFileProcessingConcurrency(data.performance?.fileProcessingConcurrency),
      workerPool: {
        enabled: data.performance?.workerPool?.enabled ?? defaults.performance.workerPool.enabled,
        maxWorkers: normalizeWorkerPoolMaxWorkers(data.performance?.workerPool?.maxWorkers),
      },
    },
    ranking: resolveRankingWeights(data.ranking),
    watch: {
      backend: data.watch?.backend ?? defaults.watch.backend,
      debounceMs: data.watch?.debounceMs ?? defaults.watch.debounceMs,
    },
    limits: {
      maxFilesDiscovered: data.limits?.maxFilesDiscovered ?? defaults.limits.maxFilesDiscovered,
      maxFileBytes: data.limits?.maxFileBytes ?? defaults.limits.maxFileBytes,
      maxSymbolsPerFile: data.limits?.maxSymbolsPerFile ?? defaults.limits.maxSymbolsPerFile,
      maxSymbolResults: data.limits?.maxSymbolResults ?? defaults.limits.maxSymbolResults,
      maxTextResults: data.limits?.maxTextResults ?? defaults.limits.maxTextResults,
      maxChildProcessOutputBytes: data.limits?.maxChildProcessOutputBytes ?? defaults.limits.maxChildProcessOutputBytes,
      maxLiveSearchMatches: data.limits?.maxLiveSearchMatches ?? defaults.limits.maxLiveSearchMatches,
    },
  };
}

export async function loadRepoEngineConfig(
  repoRoot: string,
  options: { repoRootResolved?: boolean } = {},
): Promise<ResolvedRepoEngineConfig> {
  const resolvedRepoRoot = options.repoRootResolved
    ? repoRoot
    : await resolveEngineRepoRoot(repoRoot);
  const defaults = createDefaultResolvedRepoEngineConfig(resolvedRepoRoot);
  const configPath = path.join(resolvedRepoRoot, ENGINE_CONFIG_FILENAME);
  const legacyConfigPath = path.join(resolvedRepoRoot, ENGINE_LEGACY_CONFIG_FILENAME);

  const contents = await readFile(configPath, "utf8")
    .catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    });

  if (contents !== null) {
    const parsedJson = await loadTsConfig(configPath);
    const parsed = repoEngineConfigSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(
        `Invalid ${ENGINE_CONFIG_FILENAME}: ${parsed.error.issues[0]?.message ?? "validation failed"}`,
      );
    }
    return resolveEngineConfigFromParsed(configPath, resolvedRepoRoot, parsed.data, defaults);
  }

  const legacyContents = await readFile(legacyConfigPath, "utf8")
    .catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    });

  if (legacyContents === null) {
    return defaults;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(legacyContents);
  } catch (error) {
    throw new Error(
      `Invalid ${ENGINE_LEGACY_CONFIG_FILENAME}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = repoEngineConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `Invalid ${ENGINE_LEGACY_CONFIG_FILENAME}: ${parsed.error.issues[0]?.message ?? "validation failed"}`,
    );
  }

  return resolveEngineConfigFromParsed(legacyConfigPath, resolvedRepoRoot, parsed.data, defaults);
}

export function defineConfig(config: RepoEngineConfig): RepoEngineConfig {
  return config;
}

async function loadTsConfig(configPath: string): Promise<unknown> {
  const loaderCode = [
    "import { pathToFileURL } from 'node:url';",
    `const mod = await import(pathToFileURL(${JSON.stringify(configPath)}).href);`,
    "process.stdout.write(JSON.stringify(mod.default ?? mod));",
  ].join("\n");

  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module"],
      {
        input: loaderCode,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5_000,
      },
    ) as string;
  } catch (error) {
    const maybeProcessError = error as { stderr?: Buffer | string; message?: string };
    const stderr = typeof maybeProcessError.stderr === "string"
      ? maybeProcessError.stderr.trim()
      : maybeProcessError.stderr instanceof Buffer
        ? maybeProcessError.stderr.toString("utf8").trim()
        : "";
    const message = stderr || maybeProcessError.message || String(error);
    throw new Error(`Invalid ${ENGINE_CONFIG_FILENAME}: ${message}`);
  }

  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(
      `Invalid ${ENGINE_CONFIG_FILENAME}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function isSummaryStrategy(value: unknown): value is SummaryStrategy {
  return typeof value === "string" && SUMMARY_STRATEGIES.has(value as SummaryStrategy);
}

export function parseSummaryStrategy(
  value: unknown,
  label = "summaryStrategy",
): SummaryStrategy {
  if (!isSummaryStrategy(value)) {
    throw new Error(
      `Unsupported ${label}: ${String(value)}. Expected one of: ${[...SUMMARY_STRATEGIES].join(", ")}`,
    );
  }

  return value;
}

export function normalizeSummaryStrategy(value: unknown): SummaryStrategy {
  return isSummaryStrategy(value) ? value : DEFAULT_SUMMARY_STRATEGY;
}

export function isSymbolKind(value: unknown): value is SymbolKind {
  return typeof value === "string" && SYMBOL_KINDS.has(value as SymbolKind);
}

export function parseSymbolKind(
  value: unknown,
  label = "kind",
): SymbolKind {
  if (!isSymbolKind(value)) {
    throw new Error(
      `Unsupported ${label}: ${String(value)}. Expected one of: ${[...SYMBOL_KINDS].join(", ")}`,
    );
  }

  return value;
}

export function createDefaultEngineConfig(input: {
  repoRoot: string;
  summaryStrategy?: SummaryStrategy;
  storageMode?: EngineConfig["storageMode"];
  indexInclude?: string[];
  indexExclude?: string[];
  rankingWeights?: RankingWeights;
  fileProcessingConcurrency?: number;
  workerPoolEnabled?: boolean;
  workerPoolMaxWorkers?: number;
  maxFilesDiscovered?: number;
  maxFileBytes?: number;
  maxSymbolsPerFile?: number;
  maxSymbolResults?: number;
  maxTextResults?: number;
  maxChildProcessOutputBytes?: number;
  maxLiveSearchMatches?: number;
}): EngineConfig {
  return {
    repoRoot: input.repoRoot,
    languages: getSupportedLanguages(),
    respectGitIgnore: true,
    storageMode: input.storageMode ?? "wal",
    staleStatus: "unknown",
    summaryStrategy:
      input.summaryStrategy === undefined
        ? DEFAULT_SUMMARY_STRATEGY
        : parseSummaryStrategy(input.summaryStrategy),
    indexInclude: [...(input.indexInclude ?? [])],
    indexExclude: [...(input.indexExclude ?? [])],
    fileProcessingConcurrency:
      input.fileProcessingConcurrency ?? defaultFileProcessingConcurrency(),
    workerPoolEnabled: input.workerPoolEnabled ?? false,
    workerPoolMaxWorkers: input.workerPoolMaxWorkers ?? defaultWorkerPoolMaxWorkers(),
    maxFilesDiscovered: input.maxFilesDiscovered ?? DEFAULT_MAX_FILES_DISCOVERED,
    maxFileBytes: input.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
    maxSymbolsPerFile: input.maxSymbolsPerFile ?? DEFAULT_MAX_SYMBOLS_PER_FILE,
    maxSymbolResults: input.maxSymbolResults ?? DEFAULT_MAX_SYMBOL_RESULTS,
    maxTextResults: input.maxTextResults ?? DEFAULT_MAX_TEXT_RESULTS,
    maxChildProcessOutputBytes:
      input.maxChildProcessOutputBytes ?? DEFAULT_MAX_CHILD_PROCESS_OUTPUT_BYTES,
    maxLiveSearchMatches: input.maxLiveSearchMatches ?? DEFAULT_MAX_LIVE_SEARCH_MATCHES,
    rankingWeights: input.rankingWeights ?? { ...DEFAULT_RANKING_WEIGHTS },
    paths: resolveEnginePaths(input.repoRoot),
  };
}
