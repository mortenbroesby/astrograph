import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import pMap from "p-map";
import { Piscina } from "piscina";
import {
  Subject,
  buffer,
  concatMap,
  debounceTime,
  filter,
  from,
  map,
  mergeMap,
  share,
} from "rxjs";

import {
  createDefaultEngineConfig,
  ENGINE_STORAGE_VERSION,
  loadRepoEngineConfig,
  resolveEngineRepoRoot,
} from "./config.ts";
import { emitEngineEvent } from "./event-sink.ts";
import { analyzeFileContent } from "./file-analysis.ts";
import type { FileAnalysisTaskInput, FileAnalysisTaskOutput } from "./file-analysis.ts";
import { searchLiveText } from "./live-search.ts";
import {
  compactDirectoryRescanPaths,
  compareDirectoryStates,
  isGitIgnored,
  listSupportedFiles,
  loadFilesystemSnapshot,
  loadFilesystemStateSnapshot,
  loadKnownDirectoryStateSnapshot,
  loadSupportedFileStatesForSubtree,
  parentDirectoryPath,
  scanDirectoryStateSnapshot,
  snapshotHash,
} from "./filesystem-scan.ts";
import {
  finalizeIndex,
  persistFileIndexResult,
  removeFileIndex,
} from "./indexing.ts";
import type { AnalyzedFileIndexResult } from "./indexing.ts";
import type {
  IndexBackendConnection,
} from "./index-backend.ts";
import {
  availableSupportTiersForFile,
  getFallbackSupportForFile,
  getLanguageRegistrySnapshot,
  listDiscoverySummarySources,
  listFallbackExtensions,
  listLanguagesForTier,
  supportReasonForFile,
  supportedLanguageForFile,
  supportTierForFile,
} from "./language-registry.ts";
import { createPathMatcher } from "./path-matcher.ts";
import { containsSecretLikeText } from "./privacy.ts";
import {
  buildReadinessStatus,
  normalizeRepoReadiness,
  summarizeReadiness,
} from "./readiness.ts";
import type { RepoMetaReadinessRecord } from "./readiness.ts";
import {
  createDefaultWatchDiagnostics,
  readRepoMeta,
  readRepoMetaHealth,
  writeRepoMetaFiles,
} from "./repo-meta.ts";
import type { RepoMetaHealthStatus } from "./repo-meta.ts";
import { getLogger } from "./logger.ts";
import { SQLITE_INDEX_BACKEND } from "./sqlite-backend.ts";
import {
  initializeDatabase,
  readSchemaVersion,
} from "./storage-schema.ts";
import {
  countRows,
  mapSymbolRow,
  typedAll,
  typedGet,
} from "./storage-queries.ts";
import type {
  DbSymbolRow,
  TrackedFileRow,
} from "./storage-queries.ts";
import {
  buildTextMatchResults,
  getContextBundleFromContext,
  getFileContentFromContext,
  getRankedContextFromContext,
  getSymbolSourceFromContext,
  queryCodeInContext,
  resolveQueryCodeIntent,
  searchSymbolsInContext,
  searchTextInContext,
} from "./retrieval.ts";
import { subscribeRepo } from "./watch-backend.ts";
import {
  ASTROGRAPH_PACKAGE_VERSION,
  ASTROGRAPH_VERSION_PARTS,
} from "./version.ts";
import {
  validateFindFilesOptions,
  validateFileSummaryOptions,
  validateProjectStatusOptions,
  validateSearchTextOptions,
  validateSearchSymbolsOptions,
} from "./validation.ts";
import type {
  DiagnosticsOptions,
  DiagnosticsResult,
  DoctorResult,
  ContextBundle,
  ContextBundleOptions,
  FindFilesMatch,
  FindFilesOptions,
  FileContentResult,
  FileOutline,
  FileSummaryOptions,
  FileSummaryResult,
  FileSummarySource,
  FileSummarySymbol,
  FileTreeEntry,
  ImportSpecifier,
  IndexSummary,
  ProjectStatusOptions,
  ProjectStatusResult,
  QueryCodeOptions,
  QueryCodeResult,
  RankedContextResult,
  RepoOutline,
  SearchSymbolsOptions,
  SearchTextOptions,
  SearchTextMatch,
  SymbolSourceResult,
  SymbolSummary,
  SummarySource,
  SummaryStrategy,
  SupportedLanguage,
  WatchBackendKind,
  WatchDiagnostics,
  WatchEvent,
  WatchHandle,
  WatchOptions,
} from "./types.ts";
import type {
  DirectoryStateEntry,
  FilesystemStateEntry,
  SnapshotEntry,
} from "./filesystem-scan.ts";

const DISCOVERY_SKIP_SEGMENTS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".astrograph",
  ".codeintel",
  "coverage",
  "dist",
  "node_modules",
]);

function loadParserHealth(db: IndexBackendConnection): DiagnosticsResult["parser"] {
  const parserStats = typedGet<{
    indexed_file_count: number;
    known_file_count: number;
    fallback_file_count: number;
    unknown_file_count: number;
  }>(
    db.prepare(`
      SELECT
        COUNT(*) AS indexed_file_count,
        SUM(CASE WHEN parser_backend IS NOT NULL THEN 1 ELSE 0 END) AS known_file_count,
        SUM(CASE WHEN parser_fallback_used = 1 THEN 1 ELSE 0 END) AS fallback_file_count,
        SUM(CASE WHEN parser_backend IS NULL THEN 1 ELSE 0 END) AS unknown_file_count
      FROM files
    `),
  ) ?? {
    indexed_file_count: 0,
    known_file_count: 0,
    fallback_file_count: 0,
    unknown_file_count: 0,
  };

  const fallbackReasons = Object.fromEntries(
    typedAll<{ reason: string; count: number }>(
      db.prepare(`
        SELECT parser_fallback_reason AS reason, COUNT(*) AS count
        FROM files
        WHERE parser_fallback_used = 1
          AND parser_fallback_reason IS NOT NULL
          AND parser_fallback_reason != ''
        GROUP BY parser_fallback_reason
      `),
    ).map((row) => [row.reason, row.count]),
  ) as Record<string, number>;

  const knownFileCount = parserStats.known_file_count ?? 0;
  const fallbackFileCount = parserStats.fallback_file_count ?? 0;

  return {
    primaryBackend: "oxc",
    fallbackBackend: "tree-sitter",
    indexedFileCount: parserStats.indexed_file_count ?? 0,
    fallbackFileCount,
    fallbackRate: knownFileCount > 0 ? fallbackFileCount / knownFileCount : null,
    unknownFileCount: parserStats.unknown_file_count ?? 0,
    fallbackReasons,
  };
}

interface EngineContext {
  config: Awaited<ReturnType<typeof ensureStorage>>;
  db: IndexBackendConnection;
}

interface CachedDatabaseConnection {
  actual: IndexBackendConnection;
  shared: IndexBackendConnection;
}

const REPO_ROOT_CACHE_LIMIT = 32;
const STORAGE_ROOT_CACHE_LIMIT = 32;
const DATABASE_CONNECTION_CACHE_LIMIT = 4;

const repoRootResolutionCache = new Map<string, Promise<string>>();
const ensuredStorageRoots = new Map<string, true>();
const databaseConnectionCache = new Map<string, CachedDatabaseConnection>();
const INDEX_WORKER_CHILD_ENV = "AI_CONTEXT_ENGINE_INDEX_WORKER_CHILD";
const storageLogger = getLogger({ component: "storage" });
const STORAGE_VERSION_FILENAME = "storage-version.json";

const storageModulePath = fileURLToPath(import.meta.url);
const storageModuleDir = path.dirname(storageModulePath);
const builtCliEntrypoint = path.join(storageModuleDir, "cli.js");
const sourceCliEntrypoint = path.join(storageModuleDir, "cli.ts");
const cliEntrypoint = existsSync(builtCliEntrypoint)
  ? builtCliEntrypoint
  : sourceCliEntrypoint;
const builtAnalyzeFileWorkerEntrypoint = path.join(
  storageModuleDir,
  "..",
  "dist",
  "workers",
  "analyze-file-worker.js",
);
const sourceAnalyzeFileWorkerEntrypoint = path.join(
  storageModuleDir,
  "workers",
  "analyze-file-worker.ts",
);
let fileAnalysisPool: Piscina<FileAnalysisTaskInput, FileAnalysisTaskOutput> | null = null;
let fileAnalysisPoolKey: string | null = null;

function resolveAnalyzeFileWorkerOptions(): {
  filename: string;
  execArgv?: string[];
} {
  const preferSource =
    process.env.ASTROGRAPH_USE_SOURCE === "1"
    || process.env.ASTROGRAPH_USE_SOURCE === "true";
  const useBuiltTarget = existsSync(builtAnalyzeFileWorkerEntrypoint)
    && (!preferSource || !existsSync(sourceAnalyzeFileWorkerEntrypoint));

  return useBuiltTarget
    ? {
        filename: builtAnalyzeFileWorkerEntrypoint,
      }
    : {
        filename: sourceAnalyzeFileWorkerEntrypoint,
        execArgv: ["--experimental-strip-types"],
      };
}

function getFileAnalysisPool(maxWorkers: number) {
  const options = resolveAnalyzeFileWorkerOptions();
  const poolKey = `${options.filename}:${options.execArgv?.join(" ") ?? ""}:${maxWorkers}`;

  if (fileAnalysisPool && fileAnalysisPoolKey === poolKey) {
    return fileAnalysisPool;
  }

  fileAnalysisPool = new Piscina<FileAnalysisTaskInput, FileAnalysisTaskOutput>({
    filename: options.filename,
    execArgv: options.execArgv,
    minThreads: 1,
    maxThreads: maxWorkers,
    concurrentTasksPerWorker: 1,
  });
  fileAnalysisPoolKey = poolKey;
  return fileAnalysisPool;
}

function getLruEntry<TKey, TValue>(
  cache: Map<TKey, TValue>,
  key: TKey,
): TValue | undefined {
  const value = cache.get(key);
  if (value === undefined) {
    return undefined;
  }

  cache.delete(key);
  cache.set(key, value);
  return value;
}

function setLruEntry<TKey, TValue>(
  cache: Map<TKey, TValue>,
  key: TKey,
  value: TValue,
  limit: number,
  onEvict?: (key: TKey, value: TValue) => void,
) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);

  while (cache.size > limit) {
    const oldest = cache.entries().next();
    if (oldest.done) {
      return;
    }

    const [oldestKey, oldestValue] = oldest.value;
    cache.delete(oldestKey);
    onEvict?.(oldestKey, oldestValue);
  }
}

function shareDatabaseConnection(actual: IndexBackendConnection): IndexBackendConnection {
  return {
    backendName: actual.backendName,
    exec(sql: string) {
      actual.exec(sql);
    },
    prepare(sql: string) {
      return actual.prepare(sql);
    },
    close() {
      // Shared process-lifetime connection; real close happens via cache reset.
    },
  };
}

function openDatabase(databasePath: string): IndexBackendConnection {
  const cached = getLruEntry(databaseConnectionCache, databasePath);
  if (cached) {
    return cached.shared;
  }

  const actual = SQLITE_INDEX_BACKEND.open(databasePath);
  initializeDatabase(actual);

  const shared = shareDatabaseConnection(actual);
  setLruEntry(
    databaseConnectionCache,
    databasePath,
    {
      actual,
      shared,
    },
    DATABASE_CONNECTION_CACHE_LIMIT,
    (_evictedPath, evictedConnection) => {
      evictedConnection.actual.close();
    },
  );

  return shared;
}

export function clearStorageProcessCaches() {
  clearDatabaseConnectionCache();
  repoRootResolutionCache.clear();
  ensuredStorageRoots.clear();
  void fileAnalysisPool?.destroy().catch(() => undefined);
  fileAnalysisPool = null;
  fileAnalysisPoolKey = null;
}

function clearDatabaseConnectionCache(databasePath?: string) {
  if (databasePath) {
    const cached = databaseConnectionCache.get(databasePath);
    cached?.actual.close();
    databaseConnectionCache.delete(databasePath);
    return;
  }

  for (const cached of databaseConnectionCache.values()) {
    cached.actual.close();
  }

  databaseConnectionCache.clear();
}

function shouldUseIndexWorker() {
  return process.env[INDEX_WORKER_CHILD_ENV] !== "1";
}

async function runIndexCommandInChild(
  command: "index-folder" | "index-file",
  input: {
    repoRoot: string;
    filePath?: string;
    summaryStrategy?: SummaryStrategy;
  },
): Promise<IndexSummary> {
  const startedAt = Date.now();
  const correlationId = randomUUID();
  const args = cliEntrypoint.endsWith(".ts")
    ? [
        "--no-warnings",
        "--experimental-strip-types",
        cliEntrypoint,
        command,
        "--repo",
        input.repoRoot,
      ]
    : [
        "--no-warnings",
        cliEntrypoint,
        command,
        "--repo",
        input.repoRoot,
      ];

  if (input.filePath) {
    args.push("--file", input.filePath);
  }
  if (input.summaryStrategy) {
    args.push("--summary-strategy", input.summaryStrategy);
  }

  return new Promise<IndexSummary>((resolve, reject) => {
    storageLogger.debug({
      event: "index_worker_start",
      command,
      repoRoot: input.repoRoot,
      filePath: input.filePath ?? null,
      summaryStrategy: input.summaryStrategy ?? null,
    });
    emitEngineEvent({
      repoRoot: input.repoRoot,
      source: "index-worker",
      event: "index-worker.started",
      level: "debug",
      correlationId,
      data: {
        command,
        filePath: input.filePath ?? null,
        summaryStrategy: input.summaryStrategy ?? null,
      },
    });
    const child = spawn(process.execPath, args, {
      env: {
        ...process.env,
        [INDEX_WORKER_CHILD_ENV]: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      storageLogger.error({
        event: "index_worker_spawn_error",
        command,
        repoRoot: input.repoRoot,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      });
      emitEngineEvent({
        repoRoot: input.repoRoot,
        source: "index-worker",
        event: "index-worker.failed",
        level: "error",
        correlationId,
        data: {
          command,
          filePath: input.filePath ?? null,
          durationMs: Date.now() - startedAt,
          stage: "spawn",
          message: error instanceof Error ? error.message : String(error),
        },
      });
      reject(error);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        storageLogger.error({
          event: "index_worker_failed",
          command,
          repoRoot: input.repoRoot,
          filePath: input.filePath ?? null,
          durationMs: Date.now() - startedAt,
          exitCode: code,
          stderrBytes: stderr.length,
          stdoutBytes: stdout.length,
        });
        emitEngineEvent({
          repoRoot: input.repoRoot,
          source: "index-worker",
          event: "index-worker.failed",
          level: "error",
          correlationId,
          data: {
            command,
            filePath: input.filePath ?? null,
            durationMs: Date.now() - startedAt,
            exitCode: code,
            stderrBytes: stderr.length,
            stdoutBytes: stdout.length,
          },
        });
        reject(new Error(stderr.trim() || stdout.trim() || `${command} worker failed`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as IndexSummary;
        storageLogger.debug({
          event: "index_worker_finish",
          command,
          repoRoot: input.repoRoot,
          filePath: input.filePath ?? null,
          durationMs: Date.now() - startedAt,
          indexedFiles: parsed.indexedFiles,
          indexedSymbols: parsed.indexedSymbols,
        });
        emitEngineEvent({
          repoRoot: input.repoRoot,
          source: "index-worker",
          event: "index-worker.finished",
          level: "info",
          correlationId,
          data: {
            command,
            filePath: input.filePath ?? null,
            durationMs: Date.now() - startedAt,
            indexedFiles: parsed.indexedFiles,
            indexedSymbols: parsed.indexedSymbols,
            staleStatus: parsed.staleStatus,
          },
        });
        resolve(parsed);
      } catch (error) {
        storageLogger.error({
          event: "index_worker_parse_error",
          command,
          repoRoot: input.repoRoot,
          durationMs: Date.now() - startedAt,
          stdoutBytes: stdout.length,
          stderrBytes: stderr.length,
          message: error instanceof Error ? error.message : String(error),
        });
        emitEngineEvent({
          repoRoot: input.repoRoot,
          source: "index-worker",
          event: "index-worker.parse-failed",
          level: "error",
          correlationId,
          data: {
            command,
            filePath: input.filePath ?? null,
            durationMs: Date.now() - startedAt,
            stdoutBytes: stdout.length,
            stderrBytes: stderr.length,
            message: error instanceof Error ? error.message : String(error),
          },
        });
        reject(
          new Error(
            `Failed to parse ${command} worker output: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  });
}

async function resolveRepoRoot(repoRoot: string): Promise<string> {
  const absoluteRepoRoot = path.resolve(repoRoot);
  let cachedResolution = getLruEntry(repoRootResolutionCache, absoluteRepoRoot);
  if (!cachedResolution) {
    cachedResolution = resolveEngineRepoRoot(absoluteRepoRoot);
    setLruEntry(
      repoRootResolutionCache,
      absoluteRepoRoot,
      cachedResolution,
      REPO_ROOT_CACHE_LIMIT,
    );
  }

  return cachedResolution;
}

async function ensureStorage(repoRoot: string, summaryStrategy?: SummaryStrategy) {
  const resolvedRepoRoot = await resolveRepoRoot(repoRoot);
  const repoConfig = await loadRepoEngineConfig(resolvedRepoRoot, {
    repoRootResolved: true,
  });
  const config = createDefaultEngineConfig({
    repoRoot: resolvedRepoRoot,
    summaryStrategy: summaryStrategy ?? repoConfig.summaryStrategy,
    storageMode: repoConfig.storageMode,
    indexInclude: repoConfig.performance.include,
    indexExclude: repoConfig.performance.exclude,
    rankingWeights: repoConfig.ranking,
    fileProcessingConcurrency: repoConfig.performance.fileProcessingConcurrency,
    workerPoolEnabled: repoConfig.performance.workerPool.enabled,
    workerPoolMaxWorkers: repoConfig.performance.workerPool.maxWorkers,
    maxFilesDiscovered: repoConfig.limits.maxFilesDiscovered,
    maxFileBytes: repoConfig.limits.maxFileBytes,
    maxSymbolsPerFile: repoConfig.limits.maxSymbolsPerFile,
    maxSymbolResults: repoConfig.limits.maxSymbolResults,
    maxTextResults: repoConfig.limits.maxTextResults,
    maxChildProcessOutputBytes: repoConfig.limits.maxChildProcessOutputBytes,
    maxLiveSearchMatches: repoConfig.limits.maxLiveSearchMatches,
  });
  if (!getLruEntry(ensuredStorageRoots, resolvedRepoRoot)) {
    await mkdir(config.paths.storageDir, { recursive: true });
    await ensureStorageVersion(config);
    await mkdir(config.paths.rawCacheDir, { recursive: true });
    setLruEntry(
      ensuredStorageRoots,
      resolvedRepoRoot,
      true,
      STORAGE_ROOT_CACHE_LIMIT,
    );
  }
  return config;
}

async function ensureStorageVersion(
  config: ReturnType<typeof createDefaultEngineConfig>,
) {
  const currentVersion = await readStorageVersion(config.paths.storageVersionPath);

  if (currentVersion === ENGINE_STORAGE_VERSION) {
    return;
  }

  if (currentVersion === null) {
    if (await storageDirHasContents(config.paths.storageDir)) {
      await writeStorageVersion(config.paths.storageVersionPath, ENGINE_STORAGE_VERSION);
      storageLogger.info({
        event: "storage.version.backfilled",
        repoRoot: config.repoRoot,
        storageDir: config.paths.storageDir,
        storageVersion: ENGINE_STORAGE_VERSION,
      });
      return;
    }

    await writeStorageVersion(config.paths.storageVersionPath, ENGINE_STORAGE_VERSION);
    return;
  }

  if (currentVersion > ENGINE_STORAGE_VERSION) {
    throw new Error(
      `Unsupported Astrograph storage version ${currentVersion} in ${config.paths.storageDir}. Current runtime supports ${ENGINE_STORAGE_VERSION}.`,
    );
  }

  await resetStorageForVersionMismatch(config, currentVersion);
}

async function readStorageVersion(storageVersionPath: string): Promise<number | null> {
  const contents = await readFile(storageVersionPath, "utf8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  });

  if (contents === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(contents) as { version?: unknown };
    return typeof parsed.version === "number" && Number.isInteger(parsed.version)
      ? parsed.version
      : null;
  } catch {
    return null;
  }
}

async function writeStorageVersion(
  storageVersionPath: string,
  version: number,
) {
  await writeFile(
    storageVersionPath,
    `${JSON.stringify(
      {
        version,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

async function storageDirHasContents(storageDir: string): Promise<boolean> {
  const entries = await readdir(storageDir).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  });

  return entries.some((entry) => entry !== STORAGE_VERSION_FILENAME);
}

async function resetStorageForVersionMismatch(
  config: ReturnType<typeof createDefaultEngineConfig>,
  currentVersion: number,
) {
  storageLogger.warn({
    event: "storage.version.reset",
    repoRoot: config.repoRoot,
    storageDir: config.paths.storageDir,
    fromVersion: currentVersion,
    toVersion: ENGINE_STORAGE_VERSION,
  });

  clearDatabaseConnectionCache(config.paths.databasePath);
  ensuredStorageRoots.delete(config.repoRoot);
  await rm(config.paths.storageDir, { recursive: true, force: true });
  await mkdir(config.paths.storageDir, { recursive: true });
  await mkdir(config.paths.rawCacheDir, { recursive: true });
  await writeStorageVersion(config.paths.storageVersionPath, ENGINE_STORAGE_VERSION);
}

async function createEngineContext(input: {
  repoRoot: string;
  summaryStrategy?: SummaryStrategy;
}): Promise<EngineContext> {
  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);

  return {
    config,
    db: openDatabase(config.paths.databasePath),
  };
}

function closeEngineContext(context: EngineContext) {
  context.db.close();
}

function normalizeRepoRelativePath(repoRoot: string, filePath: string) {
  if (!filePath || filePath.trim().length === 0) {
    throw new Error("File path is required");
  }

  const normalizedPath = path.normalize(filePath);
  if (
    path.isAbsolute(filePath) ||
    normalizedPath === ".." ||
    normalizedPath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`File path escapes repository root: ${filePath}`);
  }

  const absolutePath = path.resolve(repoRoot, normalizedPath);
  const relativePath = path.relative(repoRoot, absolutePath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`File path escapes repository root: ${filePath}`);
  }

  return {
    absolutePath,
    relativePath,
  };
}

async function assertInsideRepoRoot(repoRoot: string, absolutePath: string) {
  const resolvedRepoRoot = await realpath(repoRoot);
  const resolvedPath = await realpath(absolutePath);
  const relativePath = path.relative(resolvedRepoRoot, resolvedPath);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`File path escapes repository root: ${absolutePath}`);
  }
}

async function writeSidecars(input: {
  repoRoot: string;
  indexedAt: string;
  indexedFiles: number;
  totalSymbols: number;
  indexedSnapshotHash: string;
  staleStatus: "fresh" | "stale" | "unknown";
  summaryStrategy: SummaryStrategy;
  readiness?: RepoMetaReadinessRecord;
}) {
  const config = createDefaultEngineConfig({
    repoRoot: input.repoRoot,
    summaryStrategy: input.summaryStrategy,
  });
  const existingMeta = await readRepoMeta(config.paths.repoMetaPath);
  const meta = {
    repoRoot: input.repoRoot,
    storageVersion: ENGINE_STORAGE_VERSION,
    indexedAt: input.indexedAt,
    indexedFiles: input.indexedFiles,
    indexedSymbols: input.totalSymbols,
    indexedSnapshotHash: input.indexedSnapshotHash,
    staleStatus: input.staleStatus,
    storageMode: config.storageMode,
    storageBackend: SQLITE_INDEX_BACKEND.backendName,
    summaryStrategy: input.summaryStrategy,
    readiness: input.readiness ?? existingMeta?.readiness ?? normalizeRepoReadiness(null),
    watch: existingMeta?.watch ?? createDefaultWatchDiagnostics(),
  };
  await writeRepoMetaFiles(config.paths.repoMetaPath, config.paths.integrityPath, meta);
}

async function writeWatchDiagnostics(input: {
  repoRoot: string;
  summaryStrategy?: SummaryStrategy;
  watch: WatchDiagnostics;
}) {
  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);
  const meta = await readRepoMeta(config.paths.repoMetaPath);
  if (!meta) {
    return;
  }
  await writeRepoMetaFiles(config.paths.repoMetaPath, config.paths.integrityPath, {
    ...meta,
    watch: input.watch,
  });
}

async function writeReadinessCheckpoint(input: {
  repoRoot: string;
  summaryStrategy: SummaryStrategy;
  discoveredFiles: number;
  deepIndexedAt: string | null;
  deepIndexedFiles: number;
}) {
  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);
  const meta = await readRepoMeta(config.paths.repoMetaPath);
  const now = new Date().toISOString();
  const indexedAt = meta?.indexedAt ?? now;

  await writeRepoMetaFiles(config.paths.repoMetaPath, config.paths.integrityPath, {
    repoRoot: config.repoRoot,
    storageVersion: meta?.storageVersion ?? ENGINE_STORAGE_VERSION,
    indexedAt,
    indexedFiles: meta?.indexedFiles ?? input.deepIndexedFiles,
    indexedSymbols: meta?.indexedSymbols ?? 0,
    indexedSnapshotHash: meta?.indexedSnapshotHash ?? snapshotHash([]),
    staleStatus: meta?.staleStatus ?? "unknown",
    storageMode: config.storageMode,
    storageBackend: SQLITE_INDEX_BACKEND.backendName,
    summaryStrategy: config.summaryStrategy,
    readiness: {
      discoveryIndexedAt: now,
      discoveredFiles: input.discoveredFiles,
      deepIndexedAt: input.deepIndexedAt,
      deepening: {
        startedAt: now,
        totalFiles: input.discoveredFiles,
        processedFiles: input.deepIndexedFiles,
        pendingFiles: Math.max(0, input.discoveredFiles - input.deepIndexedFiles),
      },
    },
    watch: meta?.watch ?? createDefaultWatchDiagnostics(),
  });
}

function loadIndexedSnapshot(
  db: IndexBackendConnection,
): SnapshotEntry[] {
  return typedAll<SnapshotEntry>(
    db.prepare(
      "SELECT path, content_hash AS contentHash FROM files ORDER BY path ASC",
    ),
  );
}

function compareSnapshots(
  indexedEntries: SnapshotEntry[],
  currentEntries: SnapshotEntry[],
) {
  const indexedMap = new Map(indexedEntries.map((entry) => [entry.path, entry]));
  const currentMap = new Map(currentEntries.map((entry) => [entry.path, entry]));
  const missingFiles = indexedEntries.filter((entry) => !currentMap.has(entry.path));
  const extraFiles = currentEntries.filter((entry) => !indexedMap.has(entry.path));
  const changedFiles = indexedEntries.filter((entry) => {
    const currentEntry = currentMap.get(entry.path);
    return Boolean(currentEntry && currentEntry.contentHash !== entry.contentHash);
  });

  return {
    missingPaths: missingFiles.map((entry) => entry.path),
    extraPaths: extraFiles.map((entry) => entry.path),
    changedPaths: changedFiles.map((entry) => entry.path),
    indexedFiles: indexedEntries.length,
    currentFiles: currentEntries.length,
    missingFiles: missingFiles.length,
    changedFiles: changedFiles.length,
    extraFiles: extraFiles.length,
    indexedSnapshotHash: snapshotHash(indexedEntries),
    currentSnapshotHash: snapshotHash(currentEntries),
  };
}

async function emitWatchEvent(
  onEvent: WatchOptions["onEvent"],
  event: WatchEvent,
): Promise<void> {
  await onEvent?.(event);
}

async function readRepoFile(repoRoot: string, filePath: string) {
  const { absolutePath, relativePath } = normalizeRepoRelativePath(repoRoot, filePath);
  const language = supportedLanguageForFile(relativePath);
  if (!language) {
    throw new Error(`Unsupported source file: ${filePath}`);
  }
  if (isGitIgnored(repoRoot, relativePath)) {
    throw new Error(`Ignored source file: ${relativePath}`);
  }
  await assertInsideRepoRoot(repoRoot, absolutePath);

  const content = await readFile(absolutePath, "utf8");
  const fileStat = await stat(absolutePath);
  return {
    absolutePath,
    relativePath,
    language,
    content,
    mtimeMs: fileStat.mtimeMs,
    size: fileStat.size,
  };
}

async function readRepoFileMetadata(repoRoot: string, filePath: string) {
  const { absolutePath, relativePath } = normalizeRepoRelativePath(repoRoot, filePath);
  const language = supportedLanguageForFile(relativePath);
  if (!language) {
    throw new Error(`Unsupported source file: ${filePath}`);
  }
  if (isGitIgnored(repoRoot, relativePath)) {
    throw new Error(`Ignored source file: ${relativePath}`);
  }
  await assertInsideRepoRoot(repoRoot, absolutePath);

  const fileStat = await stat(absolutePath);
  return {
    absolutePath,
    relativePath,
    language,
    mtimeMs: fileStat.mtimeMs,
    size: fileStat.size,
  };
}

function exceedsMaxFileBytes(size: number, maxFileBytes: number): boolean {
  return size > maxFileBytes;
}

function exceedsMaxSymbolsPerFile(symbolCount: number, maxSymbolsPerFile: number): boolean {
  return symbolCount > maxSymbolsPerFile;
}

function getIndexTestDelayMs(): number {
  const raw = process.env.ASTROGRAPH_INDEX_TEST_DELAY_MS;
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

async function resolveRepoFileRefreshState(
  repoRoot: string,
  filePath: string,
): Promise<{
  relativePath: string;
  exists: boolean;
  supported: boolean;
  ignored: boolean;
}> {
  const { absolutePath, relativePath } = normalizeRepoRelativePath(repoRoot, filePath);
  const exists = await stat(absolutePath)
    .then((entry) => entry.isFile())
    .catch(() => false);

  return {
    relativePath,
    exists,
    supported: Boolean(supportedLanguageForFile(relativePath)),
    ignored: isGitIgnored(repoRoot, relativePath),
  };
}

async function analyzeFileIndexResult(input: {
  repoRoot: string;
  filePath: string;
  summaryStrategy?: SummaryStrategy;
  forceRefresh?: boolean;
  existing?: TrackedFileRow;
  maxSymbolsPerFile: number;
  workerPool?: {
    enabled: boolean;
    maxWorkers: number;
  };
}): Promise<AnalyzedFileIndexResult> {
  const fileMetadata = await readRepoFileMetadata(input.repoRoot, input.filePath);

  if (
    !input.forceRefresh
    && input.existing
    && input.existing.size_bytes === fileMetadata.size
    && input.existing.mtime_ms === Math.trunc(fileMetadata.mtimeMs)
  ) {
    return {
      kind: "unchanged",
      existing: input.existing,
    };
  }

  const file = await readRepoFile(input.repoRoot, input.filePath);
  const analysis = input.workerPool?.enabled
    ? await getFileAnalysisPool(input.workerPool.maxWorkers).run({
        relativePath: file.relativePath,
        language: file.language,
        content: file.content,
        summaryStrategy: input.summaryStrategy,
      })
    : analyzeFileContent({
        relativePath: file.relativePath,
        language: file.language,
        content: file.content,
        summaryStrategy: input.summaryStrategy,
      });
  const reparsed = analysis.parsed;
  const { symbolSignatureHash, importHash } = analysis;

  if (exceedsMaxSymbolsPerFile(reparsed.symbols.length, input.maxSymbolsPerFile)) {
    return {
      kind: "symbol-limit-exceeded",
      existing: input.existing,
      symbolCount: reparsed.symbols.length,
    };
  }

  if (!input.forceRefresh && input.existing?.content_hash === reparsed.contentHash) {
    return {
      kind: "content-unchanged",
      existing: input.existing!,
      file,
      reparsed,
      symbolSignatureHash,
      importHash,
    };
  }

  return {
    kind: "reindexed",
    existing: input.existing,
    file,
    reparsed,
    symbolSignatureHash,
    importHash,
  };
}

function matchesFilePattern(filePath: string, pattern?: string): boolean {
  return createPathMatcher({ include: pattern ? [pattern] : undefined }).matches(
    filePath,
  );
}

async function collectRepoFiles(
  repoRoot: string,
  currentDir: string,
  results: string[],
  maxFiles: number,
): Promise<void> {
  if (results.length >= maxFiles) {
    return;
  }

  const entries = await readdir(currentDir, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (results.length >= maxFiles) {
      return;
    }
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (DISCOVERY_SKIP_SEGMENTS.has(entry.name)) {
        continue;
      }
      await collectRepoFiles(repoRoot, path.join(currentDir, entry.name), results, maxFiles);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath);
    if (relativePath.startsWith(`..${path.sep}`) || relativePath === "..") {
      continue;
    }
    if (isGitIgnored(repoRoot, relativePath)) {
      continue;
    }
    results.push(relativePath);
  }
}

function scoreFindFileMatch(filePath: string, query: string | undefined): {
  matched: boolean;
  reason: FindFilesMatch["matchReason"];
  score: number;
} {
  if (!query) {
    return {
      matched: true,
      reason: "pattern",
      score: 1,
    };
  }

  const normalizedQuery = query.toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  const normalizedPath = filePath.toLowerCase();

  if (fileName === normalizedQuery) {
    return { matched: true, reason: "name", score: 500 };
  }
  if (normalizedPath === normalizedQuery) {
    return { matched: true, reason: "path", score: 450 };
  }
  if (fileName.includes(normalizedQuery)) {
    return { matched: true, reason: "name", score: 300 };
  }
  if (normalizedPath.includes(normalizedQuery)) {
    return { matched: true, reason: "path", score: 200 };
  }

  return { matched: false, reason: "path", score: 0 };
}

function summarizeStructuredFile(relativePath: string, symbols: SymbolSummary[]): {
  summarySource: "structured";
  summary: string;
  topSymbols: FileSummarySymbol[];
  hints: string[];
} {
  const topSymbols = symbols.slice(0, 3).map((symbol) => ({
    name: symbol.name,
    kind: symbol.kind,
    line: symbol.startLine,
  }));
  const symbolKinds = new Set(symbols.map((symbol) => symbol.kind));
  return {
    summarySource: "structured",
    summary: `${path.extname(relativePath).slice(1).toUpperCase() || "Source"} file with ${symbols.length} indexed symbols`,
    topSymbols,
    hints: [
      `symbol kinds: ${[...symbolKinds].join(", ")}`,
      ...topSymbols.map((symbol) => `${symbol.kind} ${symbol.name} at line ${symbol.line}`),
    ],
  };
}

function summarizeDiscoveryContent(relativePath: string, content: string): {
  summarySource: Exclude<FileSummarySource, "structured">;
  summary: string;
  hints: string[];
} {
  const fallbackSupport = getFallbackSupportForFile(relativePath);
  const lines = content.split(/\r?\n/);
  const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);

  if (fallbackSupport?.summarySource === "markdown-headings") {
    const headings = nonEmptyLines
      .filter((line) => /^#{1,6}\s+/.test(line))
      .slice(0, 3)
      .map((line) => line.replace(/^#{1,6}\s+/, ""));
    return {
      summarySource: "markdown-headings",
      summary: `Markdown file with ${headings.length} heading${headings.length === 1 ? "" : "s"}`,
      hints: headings.length > 0 ? headings : nonEmptyLines.slice(0, 3),
    };
  }

  if (fallbackSupport?.summarySource === "json-top-level-keys") {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const topLevelKeys = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.keys(parsed).slice(0, 5)
        : [];
      return {
        summarySource: "json-top-level-keys",
        summary: `JSON file with ${topLevelKeys.length} top-level key${topLevelKeys.length === 1 ? "" : "s"}`,
        hints: topLevelKeys,
      };
    } catch {
      // Fall through to generic text summary.
    }
  }

  if (fallbackSupport?.summarySource === "yaml-top-level-keys") {
    const topLevelKeys = lines
      .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*/)?.[1] ?? null)
      .filter((value): value is string => value !== null)
      .slice(0, 5);
    return {
      summarySource: "yaml-top-level-keys",
      summary: `YAML file with ${topLevelKeys.length} top-level key${topLevelKeys.length === 1 ? "" : "s"}`,
      hints: topLevelKeys,
    };
  }

  if (fallbackSupport?.summarySource === "sql-schema-objects") {
    const objects = [...content.matchAll(/\b(?:create|alter)\s+(?:table|view|function|index)\s+([A-Za-z0-9_."]+)/gi)]
      .map((match) => match[1]?.replaceAll("\"", ""))
      .filter((value): value is string => Boolean(value))
      .slice(0, 5);
    return {
      summarySource: "sql-schema-objects",
      summary: `SQL file with ${objects.length} schema object reference${objects.length === 1 ? "" : "s"}`,
      hints: objects,
    };
  }

  if (fallbackSupport?.summarySource === "shell-functions") {
    const functions = lines
      .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*\(\)\s*\{/)?.[1] ?? null)
      .filter((value): value is string => value !== null)
      .slice(0, 5);
    return {
      summarySource: "shell-functions",
      summary: `Shell script with ${functions.length} function${functions.length === 1 ? "" : "s"}`,
      hints: functions,
    };
  }

  return {
    summarySource: "text-lines",
    summary: `Discovery-only file with ${nonEmptyLines.length} non-empty line${nonEmptyLines.length === 1 ? "" : "s"}`,
    hints: nonEmptyLines.slice(0, 3).map((line) => line.slice(0, 120)),
  };
}

function resolveImportedFilePaths(
  db: IndexBackendConnection,
  sourceFilePath: string,
  importSource: string,
): string[] {
  const source = importSource.trim();
  if (!source.startsWith(".") && !source.startsWith("/")) {
    return [];
  }

  const basePath = source.startsWith("/")
    ? path.normalize(source)
    : path.normalize(path.join(path.dirname(sourceFilePath), source));
  const withoutExtension = basePath.replace(/\.[^.\\/]+$/u, "");
  const candidates = [
    basePath,
    withoutExtension,
    `${withoutExtension}.ts`,
    `${withoutExtension}.tsx`,
    `${withoutExtension}.js`,
    `${withoutExtension}.jsx`,
    path.join(withoutExtension, "index.ts"),
    path.join(withoutExtension, "index.tsx"),
    path.join(withoutExtension, "index.js"),
    path.join(withoutExtension, "index.jsx"),
  ];

  for (const candidate of [...new Set(candidates)]) {
    const row = typedGet<{ path: string }>(
      db.prepare("SELECT path FROM files WHERE path = ?"),
      candidate,
    );
    if (row) {
      return [row.path];
    }
  }

  return [];
}

function normalizeImportSpecifier(
  value: unknown,
): ImportSpecifier | null {
  if (typeof value === "string") {
    const importedName = value.trim();
    return importedName
      ? {
          kind: "unknown",
          importedName,
          localName: null,
        }
      : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const kind = "kind" in value ? value.kind : null;
  const importedName = "importedName" in value ? value.importedName : null;
  const localName = "localName" in value ? value.localName : null;

  if (
    (kind !== "named" && kind !== "default" && kind !== "namespace" && kind !== "unknown")
    || typeof importedName !== "string"
    || importedName.trim().length === 0
  ) {
    return null;
  }

  return {
    kind,
    importedName: importedName.trim(),
    localName: typeof localName === "string" && localName.trim().length > 0
      ? localName.trim()
      : null,
  };
}

function parseStoredImportSpecifiers(serialized: string): ImportSpecifier[] {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizeImportSpecifier(entry))
      .filter((entry): entry is ImportSpecifier => entry !== null);
  } catch {
    return [];
  }
}

function rebuildFileDependencies(db: IndexBackendConnection) {
  db.prepare("DELETE FROM file_dependencies").run();

  const rows = typedAll<{
    importer_file_id: number;
    importer_path: string;
    source: string;
  }>(
    db.prepare(`
      SELECT imports.file_id AS importer_file_id, files.path AS importer_path, imports.source AS source
      FROM imports
      INNER JOIN files ON files.id = imports.file_id
      ORDER BY files.path ASC, imports.source ASC
    `),
  );
  const insertDependency = db.prepare(`
    INSERT OR IGNORE INTO file_dependencies (importer_file_id, importer_path, target_path, source)
    VALUES (?, ?, ?, ?)
  `);

  for (const row of rows) {
    const targetPaths = resolveImportedFilePaths(
      db,
      row.importer_path,
      row.source,
    );
    for (const targetPath of targetPaths) {
      insertDependency.run(
        row.importer_file_id,
        row.importer_path,
        targetPath,
        row.source,
      );
    }
  }
}

function loadDirectImporterPaths(
  db: IndexBackendConnection,
  targetPath: string,
): string[] {
  return typedAll<{ importer_path: string }>(
    db.prepare(
      `
        SELECT importer_path
        FROM file_dependencies
        WHERE target_path = ?
        ORDER BY importer_path ASC
      `,
    ),
    targetPath,
  ).map((row) => row.importer_path);
}

async function shouldUseLiveTextSearchFallback(input: {
  repoRoot: string;
  summaryStrategy?: SummaryStrategy;
}): Promise<boolean> {
  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);
  const meta = await readRepoMeta(config.paths.repoMetaPath);
  return !meta || meta.staleStatus !== "fresh";
}

async function indexFolderDirect(input: {
  repoRoot: string;
  summaryStrategy?: SummaryStrategy;
}): Promise<IndexSummary> {
  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);
  const db = openDatabase(config.paths.databasePath);
  const repoRoot = config.repoRoot;

  try {
    const meta = await readRepoMeta(config.paths.repoMetaPath);
    const forceRefresh = meta?.summaryStrategy !== config.summaryStrategy;
    const supportedFiles = await listSupportedFiles(repoRoot, repoRoot, {
      include: config.indexInclude,
      exclude: config.indexExclude,
      maxFilesDiscovered: config.maxFilesDiscovered,
      maxFileBytes: config.maxFileBytes,
    });
    const tracked = db.prepare(
      `
        SELECT id, path, content_hash, integrity_hash, size_bytes, mtime_ms
        FROM files
      `,
    ).all() as Array<TrackedFileRow & { path: string }>;
    const trackedRows = new Map(tracked.map((row) => [row.path, row]));
    const trackedPaths = new Set(tracked.map((row) => row.path));
    const nextPaths = new Set(supportedFiles);

    for (const stalePath of trackedPaths) {
      if (!nextPaths.has(stalePath)) {
        removeFileIndex(db, stalePath);
      }
    }

    await writeReadinessCheckpoint({
      repoRoot,
      summaryStrategy: config.summaryStrategy,
      discoveredFiles: supportedFiles.length,
      deepIndexedAt: meta?.readiness?.deepIndexedAt ?? null,
      deepIndexedFiles: countRows(db, "SELECT COUNT(*) AS count FROM files"),
    });

    let indexedFiles = 0;
    let indexedSymbols = 0;
    const analyzedFiles = await pMap(
      supportedFiles,
      async (filePath) => {
        const testDelayMs = getIndexTestDelayMs();
        if (testDelayMs > 0) {
          await delay(testDelayMs);
        }
        return analyzeFileIndexResult({
          repoRoot,
          filePath,
          summaryStrategy: config.summaryStrategy,
          forceRefresh,
          existing: trackedRows.get(filePath),
          maxSymbolsPerFile: config.maxSymbolsPerFile,
          workerPool: {
            enabled: config.workerPoolEnabled,
            maxWorkers: config.workerPoolMaxWorkers,
          },
        });
      },
      { concurrency: config.fileProcessingConcurrency },
    );

    for (const analyzed of analyzedFiles) {
      const result = persistFileIndexResult(db, analyzed);
      if (result.indexed) {
        indexedFiles += 1;
        indexedSymbols += result.symbolCount;
      }
    }

    const indexedAt = new Date().toISOString();
    const staleStatus = await finalizeIndex({
      db,
      repoRoot,
      indexedAt,
      summaryStrategy: config.summaryStrategy,
      discoveredFiles: supportedFiles.length,
      rebuildFileDependencies,
      loadDependencyGraphHealth,
      writeSidecars,
    });

    return {
      indexedFiles,
      indexedSymbols,
      staleStatus,
    };
  } finally {
    db.close();
  }
}

async function upsertFileIndex(db: IndexBackendConnection, input: {
  repoRoot: string;
  filePath: string;
  summaryStrategy?: SummaryStrategy;
  forceRefresh?: boolean;
  maxSymbolsPerFile: number;
  workerPool?: {
    enabled: boolean;
    maxWorkers: number;
  };
}) {
  const existing = db.prepare(
    `
      SELECT id, content_hash, integrity_hash, size_bytes, mtime_ms
      FROM files
      WHERE path = ?
    `,
  ).get(input.filePath) as TrackedFileRow | undefined;

  const analyzed = await analyzeFileIndexResult({
    repoRoot: input.repoRoot,
    filePath: input.filePath,
    summaryStrategy: input.summaryStrategy,
    forceRefresh: input.forceRefresh,
    existing,
    maxSymbolsPerFile: input.maxSymbolsPerFile,
    workerPool: input.workerPool,
  });
  return persistFileIndexResult(db, analyzed);
}

async function refreshIndexedFilePath(db: IndexBackendConnection, input: {
  repoRoot: string;
  filePath: string;
  summaryStrategy: SummaryStrategy;
  forceRefresh: boolean;
  maxFileBytes: number;
  maxSymbolsPerFile: number;
  workerPool: {
    enabled: boolean;
    maxWorkers: number;
  };
}): Promise<{ indexedFiles: number; indexedSymbols: number }> {
  const absolutePath = path.join(input.repoRoot, input.filePath);
  const fileExists = await stat(absolutePath)
    .then((entry) => entry.isFile())
    .catch(() => false);

  if (!fileExists) {
    return {
      indexedFiles: removeFileIndex(db, input.filePath) ? 1 : 0,
      indexedSymbols: 0,
    };
  }

  if (!supportedLanguageForFile(input.filePath) || isGitIgnored(input.repoRoot, input.filePath)) {
    return {
      indexedFiles: removeFileIndex(db, input.filePath) ? 1 : 0,
      indexedSymbols: 0,
    };
  }

  const fileMetadata = await readRepoFileMetadata(input.repoRoot, input.filePath);
  if (exceedsMaxFileBytes(fileMetadata.size, input.maxFileBytes)) {
    return {
      indexedFiles: removeFileIndex(db, input.filePath) ? 1 : 0,
      indexedSymbols: 0,
    };
  }

  const result = await upsertFileIndex(db, {
    repoRoot: input.repoRoot,
    filePath: input.filePath,
    summaryStrategy: input.summaryStrategy,
    forceRefresh: input.forceRefresh,
    maxSymbolsPerFile: input.maxSymbolsPerFile,
    workerPool: input.workerPool,
  });

  return {
    indexedFiles: result.indexed ? 1 : 0,
    indexedSymbols: result.symbolCount,
  };
}
export async function indexFolder(input: {
  repoRoot: string;
  summaryStrategy?: SummaryStrategy;
}): Promise<IndexSummary> {
  if (!shouldUseIndexWorker()) {
    return indexFolderDirect(input);
  }

  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);
  clearDatabaseConnectionCache(config.paths.databasePath);
  const result = await runIndexCommandInChild("index-folder", {
    repoRoot: config.repoRoot,
    summaryStrategy: config.summaryStrategy,
  });
  clearDatabaseConnectionCache(config.paths.databasePath);
  return result;
}

async function indexFileDirect(input: {
  repoRoot: string;
  filePath: string;
  summaryStrategy?: SummaryStrategy;
}): Promise<IndexSummary> {
  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);
  const db = openDatabase(config.paths.databasePath);
  const repoRoot = config.repoRoot;

  try {
    const meta = await readRepoMeta(config.paths.repoMetaPath);
    const fileState = await resolveRepoFileRefreshState(repoRoot, input.filePath);
    const dependentPaths = loadDirectImporterPaths(db, fileState.relativePath)
      .filter((candidate) => candidate !== fileState.relativePath);

    let indexedFiles = 0;
    let indexedSymbols = 0;

    const primaryResult = await refreshIndexedFilePath(db, {
      repoRoot,
      filePath: fileState.relativePath,
      summaryStrategy: config.summaryStrategy,
      forceRefresh: meta?.summaryStrategy !== config.summaryStrategy,
      maxFileBytes: config.maxFileBytes,
      maxSymbolsPerFile: config.maxSymbolsPerFile,
      workerPool: {
        enabled: config.workerPoolEnabled,
        maxWorkers: config.workerPoolMaxWorkers,
      },
    });
    indexedFiles += primaryResult.indexedFiles;
    indexedSymbols += primaryResult.indexedSymbols;

    for (const dependentPath of dependentPaths) {
      const dependentResult = await refreshIndexedFilePath(db, {
        repoRoot,
        filePath: dependentPath,
        summaryStrategy: config.summaryStrategy,
        forceRefresh: true,
        maxFileBytes: config.maxFileBytes,
        maxSymbolsPerFile: config.maxSymbolsPerFile,
        workerPool: {
          enabled: config.workerPoolEnabled,
          maxWorkers: config.workerPoolMaxWorkers,
        },
      });
      indexedFiles += dependentResult.indexedFiles;
      indexedSymbols += dependentResult.indexedSymbols;
    }

    const indexedAt = new Date().toISOString();
    const staleStatus = await finalizeIndex({
      db,
      repoRoot,
      indexedAt,
      summaryStrategy: config.summaryStrategy,
      rebuildFileDependencies,
      loadDependencyGraphHealth,
      writeSidecars,
    });

    return {
      indexedFiles,
      indexedSymbols,
      staleStatus,
    };
  } finally {
    db.close();
  }
}

export async function indexFile(input: {
  repoRoot: string;
  filePath: string;
  summaryStrategy?: SummaryStrategy;
}): Promise<IndexSummary> {
  if (!shouldUseIndexWorker()) {
    return indexFileDirect(input);
  }

  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);
  clearDatabaseConnectionCache(config.paths.databasePath);
  const result = await runIndexCommandInChild("index-file", {
    repoRoot: config.repoRoot,
    filePath: input.filePath,
    summaryStrategy: config.summaryStrategy,
  });
  clearDatabaseConnectionCache(config.paths.databasePath);
  return result;
}

export async function watchFolder(input: WatchOptions): Promise<WatchHandle> {
  const repoRoot = await resolveRepoRoot(input.repoRoot);
  const repoConfig = await loadRepoEngineConfig(repoRoot, {
    repoRootResolved: true,
  });
  const debounceMs = input.debounceMs ?? repoConfig.watch.debounceMs;
  const preferredBackend = input.backend ?? repoConfig.watch.backend;
  const pollMs = Math.max(50, Math.min(debounceMs, 250));
  const watchLogger = storageLogger.child({
    operation: "watch_folder",
    repoRoot,
  });
  let closed = false;
  let pollInFlight = false;
  let pollInterval: NodeJS.Timeout | null = null;
  let nativeWatchTimer: NodeJS.Timeout | null = null;
  let nativeSubscription: { backend: WatchBackendKind; close(): Promise<void> } | null = null;
  let activeBackend: WatchBackendKind | null = null;
  let usingPollingFallback = false;
  let observedState: FilesystemStateEntry[] = [];
  let observedDirectories: DirectoryStateEntry[] = [];
  const startedAt = new Date().toISOString();
  let reindexCount = 0;
  let lastSummary: IndexSummary | null = null;
  let lastError: string | null = null;
  let lastEventType: WatchEvent["type"] | null = null;
  const changedPathInputs$ = new Subject<string[]>();

  const persistWatchEvent = async (event: WatchEvent) => {
    lastEventType = event.type;
    if (event.type === "ready") {
      reindexCount = 0;
      lastError = null;
    }
    if (event.type === "reindex") {
      reindexCount += 1;
      lastError = null;
    }
    if (event.type === "error") {
      lastError = event.message ?? "Unknown watch error";
    }
    if (event.summary) {
      lastSummary = event.summary;
    }

    await writeWatchDiagnostics({
      repoRoot,
      summaryStrategy: input.summaryStrategy,
      watch: {
        status: event.type === "close" ? "idle" : "watching",
        backend: activeBackend,
        debounceMs,
        pollMs,
        startedAt,
        lastEvent: event.type,
        lastEventAt: new Date().toISOString(),
        lastChangedPaths: event.changedPaths,
        reindexCount,
        lastError,
        lastSummary,
      },
    });

    if (event.type === "ready") {
      watchLogger.info({
        event: "watch_ready",
        indexedFiles: event.summary?.indexedFiles ?? null,
        indexedSymbols: event.summary?.indexedSymbols ?? null,
      });
      emitEngineEvent({
        repoRoot,
        source: "watch",
        event: "watch.ready",
        level: "info",
        data: {
          indexedFiles: event.summary?.indexedFiles ?? null,
          indexedSymbols: event.summary?.indexedSymbols ?? null,
          staleStatus: event.summary?.staleStatus ?? null,
        },
      });
    } else if (event.type === "reindex") {
      watchLogger.debug({
        event: "watch_reindex",
        changedPathCount: event.changedPaths.length,
        indexedFiles: event.summary?.indexedFiles ?? null,
        indexedSymbols: event.summary?.indexedSymbols ?? null,
      });
      emitEngineEvent({
        repoRoot,
        source: "watch",
        event: "watch.reindex",
        level: "info",
        data: {
          changedPaths: event.changedPaths,
          indexedFiles: event.summary?.indexedFiles ?? null,
          indexedSymbols: event.summary?.indexedSymbols ?? null,
          staleStatus: event.summary?.staleStatus ?? null,
        },
      });
    } else if (event.type === "error") {
      watchLogger.warn({
        event: "watch_error",
        changedPathCount: event.changedPaths.length,
        message: event.message ?? "Unknown watch error",
      });
      emitEngineEvent({
        repoRoot,
        source: "watch",
        event: "watch.error",
        level: "warn",
        data: {
          changedPaths: event.changedPaths,
          message: event.message ?? "Unknown watch error",
        },
      });
    } else if (event.type === "close") {
      watchLogger.info({
        event: "watch_close",
        reindexCount,
        lastError,
      });
      emitEngineEvent({
        repoRoot,
        source: "watch",
        event: "watch.closed",
        level: "info",
        data: {
          reindexCount,
          lastError,
        },
      });
    }
  };

  const emitChangedPaths = (paths: string[]) => {
    if (closed || paths.length === 0) {
      return;
    }
    changedPathInputs$.next(paths);
  };

  const flushChangedPaths = async (changedPaths: string[]): Promise<WatchEvent> => {
    try {
      const config = await ensureStorage(repoRoot, input.summaryStrategy);
      const db = openDatabase(config.paths.databasePath);
      const meta = await readRepoMeta(config.paths.repoMetaPath);
      const forceRefresh = meta?.summaryStrategy !== config.summaryStrategy;
      const dependentPaths = new Set<string>();

      let indexedFiles = 0;
      let indexedSymbols = 0;

      try {
        for (const filePath of changedPaths) {
          for (const importerPath of loadDirectImporterPaths(db, filePath)) {
            if (!changedPaths.includes(importerPath) && importerPath !== filePath) {
              dependentPaths.add(importerPath);
            }
          }

          const result = await refreshIndexedFilePath(db, {
            repoRoot,
            filePath,
            summaryStrategy: config.summaryStrategy,
            forceRefresh,
            maxFileBytes: config.maxFileBytes,
            maxSymbolsPerFile: config.maxSymbolsPerFile,
            workerPool: {
              enabled: config.workerPoolEnabled,
              maxWorkers: config.workerPoolMaxWorkers,
            },
          });
          indexedFiles += result.indexedFiles;
          indexedSymbols += result.indexedSymbols;
        }

        for (const dependentPath of [...dependentPaths].sort()) {
          const result = await refreshIndexedFilePath(db, {
            repoRoot,
            filePath: dependentPath,
            summaryStrategy: config.summaryStrategy,
            forceRefresh: true,
            maxFileBytes: config.maxFileBytes,
            maxSymbolsPerFile: config.maxSymbolsPerFile,
            workerPool: {
              enabled: config.workerPoolEnabled,
              maxWorkers: config.workerPoolMaxWorkers,
            },
          });
          indexedFiles += result.indexedFiles;
          indexedSymbols += result.indexedSymbols;
        }

        const indexedAt = new Date().toISOString();
        const staleStatus = await finalizeIndex({
          db,
          repoRoot,
          indexedAt,
          summaryStrategy: config.summaryStrategy,
          rebuildFileDependencies,
          loadDependencyGraphHealth,
          writeSidecars,
        });

        return {
          type: "reindex",
          changedPaths,
          summary: {
            indexedFiles,
            indexedSymbols,
            staleStatus,
          },
        } satisfies WatchEvent;
      } finally {
        db.close();
      }
    } catch (error) {
      emitChangedPaths(changedPaths);
      return {
        type: "error",
        changedPaths,
        message: error instanceof Error ? error.message : String(error),
      } satisfies WatchEvent;
    }
  };

  const runPollingSweep = async () => {
    if (closed || pollInFlight) {
      return;
    }

    pollInFlight = true;
    try {
      const previousStateMap = new Map(
        observedState.map((entry) => [entry.path, entry]),
      );
      const currentStateMap = new Map<string, FilesystemStateEntry>();
      const changedPaths = new Set<string>();

      for (const previousEntry of observedState) {
        const absolutePath = path.join(repoRoot, previousEntry.path);
        const fileStat = await stat(absolutePath)
          .then((entry) => (entry.isFile() ? entry : null))
          .catch(() => null);

        if (!fileStat) {
          changedPaths.add(previousEntry.path);
          continue;
        }

        const currentEntry = {
          path: previousEntry.path,
          mtimeMs: fileStat.mtimeMs,
          size: fileStat.size,
        } satisfies FilesystemStateEntry;
        currentStateMap.set(currentEntry.path, currentEntry);

        if (
          currentEntry.mtimeMs !== previousEntry.mtimeMs ||
          currentEntry.size !== previousEntry.size
        ) {
          changedPaths.add(currentEntry.path);
        }
      }

      const currentDirectories = await loadKnownDirectoryStateSnapshot(
        repoRoot,
        observedDirectories.map((entry) => entry.path),
      );
      const directoryComparison = compareDirectoryStates(
        observedDirectories,
        currentDirectories,
      );
      const directoriesToRescan = compactDirectoryRescanPaths([
        ...directoryComparison.changedPaths,
        ...directoryComparison.missingPaths.map((entry) => parentDirectoryPath(entry)),
      ]);

      for (const directoryPath of directoriesToRescan) {
        const subtreeState = await loadSupportedFileStatesForSubtree(
          repoRoot,
          directoryPath,
          {
            include: repoConfig.performance.include,
            exclude: repoConfig.performance.exclude,
            maxFilesDiscovered: repoConfig.limits.maxFilesDiscovered,
            maxFileBytes: repoConfig.limits.maxFileBytes,
          },
        );
        for (const entry of subtreeState) {
          currentStateMap.set(entry.path, entry);
          if (!previousStateMap.has(entry.path)) {
            changedPaths.add(entry.path);
          }
        }
      }

      observedState = [...currentStateMap.values()].sort((left, right) =>
        left.path.localeCompare(right.path)
      );
      observedDirectories = directoriesToRescan.length > 0
        ? await scanDirectoryStateSnapshot(repoRoot)
        : currentDirectories;

      const changedPathList = [...changedPaths].sort();
      if (changedPathList.length > 0) {
        emitChangedPaths(changedPathList);
      }
    } catch (error) {
      const event = {
        type: "error",
        changedPaths: [],
        message: error instanceof Error ? error.message : String(error),
      } satisfies WatchEvent;
      await persistWatchEvent(event);
      await emitWatchEvent(input.onEvent, event);
    } finally {
      pollInFlight = false;
    }
  };

  const scheduleNativeWatchSweep = () => {
    if (closed || usingPollingFallback || nativeWatchTimer) {
      return;
    }
    nativeWatchTimer = setTimeout(() => {
      nativeWatchTimer = null;
      void runPollingSweep();
    }, 0);
  };

  const startPollingFallback = () => {
    if (pollInterval || closed) {
      return;
    }
    usingPollingFallback = true;
    activeBackend = "polling";
    watchLogger.warn({
      event: "watch_polling_fallback",
      pollMs,
    });
    pollInterval = setInterval(() => {
      void runPollingSweep();
    }, pollMs);
  };

  const startNativeWatcher = async () => {
    try {
      nativeSubscription = await subscribeRepo(
        repoRoot,
        () => {
          scheduleNativeWatchSweep();
        },
        {
          backend: preferredBackend,
          onError: () => {
            void nativeSubscription?.close().catch(() => undefined);
            nativeSubscription = null;
            activeBackend = "polling";
            usingPollingFallback = true;
            watchLogger.warn({ event: "watch_native_failed" });
            emitEngineEvent({
              repoRoot,
              source: "watch",
              event: "watch.backend-fallback",
              level: "warn",
              data: {
                backend: "polling",
              },
            });
            void writeWatchDiagnostics({
              repoRoot,
              summaryStrategy: input.summaryStrategy,
              watch: {
                status: "watching",
                backend: activeBackend,
                debounceMs,
                pollMs,
                startedAt,
                lastEvent: lastEventType,
                lastEventAt: new Date().toISOString(),
                lastChangedPaths: [],
                reindexCount,
                lastError,
                lastSummary,
              },
            }).catch(() => undefined);
            startPollingFallback();
          },
        },
      );
      activeBackend = nativeSubscription.backend;
      watchLogger.debug({
        event: "watch_native_started",
        backend: activeBackend,
      });
    } catch {
      nativeSubscription = null;
      activeBackend = "polling";
      startPollingFallback();
    }
  };

  const changedPathItems$ = changedPathInputs$.pipe(
    mergeMap((paths) => from(paths)),
    share(),
  );
  const flushQueue$ = changedPathItems$.pipe(
    buffer(changedPathItems$.pipe(debounceTime(debounceMs))),
    map((paths) => [...new Set(paths)].sort()),
    filter((paths) => paths.length > 0),
    concatMap((paths) =>
      from(flushChangedPaths(paths)).pipe(
        concatMap(async (event) => {
          await persistWatchEvent(event);
          await emitWatchEvent(input.onEvent, event);
          return event;
        }),
      )
    ),
  );

  let resolveProcessingDone!: () => void;
  let rejectProcessingDone!: (error: unknown) => void;
  const processingDone = new Promise<void>((resolve, reject) => {
    resolveProcessingDone = resolve;
    rejectProcessingDone = reject;
  });
  const flushSubscription = flushQueue$.subscribe({
    next() {},
    error(error) {
      rejectProcessingDone(error);
    },
    complete() {
      resolveProcessingDone();
    },
  });

  const initialSummary = await indexFolder({
    repoRoot,
    summaryStrategy: input.summaryStrategy,
  });
  const readyEvent = {
    type: "ready",
    changedPaths: [],
    summary: initialSummary,
  } satisfies WatchEvent;
  observedState = await loadFilesystemStateSnapshot(repoRoot, {
    include: repoConfig.performance.include,
    exclude: repoConfig.performance.exclude,
    maxFilesDiscovered: repoConfig.limits.maxFilesDiscovered,
    maxFileBytes: repoConfig.limits.maxFileBytes,
  });
  observedDirectories = await scanDirectoryStateSnapshot(repoRoot);
  await startNativeWatcher();
  await persistWatchEvent(readyEvent);
  await emitWatchEvent(input.onEvent, readyEvent);

  return {
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      if (nativeWatchTimer) {
        clearTimeout(nativeWatchTimer);
        nativeWatchTimer = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      await nativeSubscription?.close().catch(() => undefined);
      nativeSubscription = null;
      changedPathInputs$.complete();
      await processingDone;
      flushSubscription.unsubscribe();
      const event = {
        type: "close",
        changedPaths: [],
      } satisfies WatchEvent;
      await persistWatchEvent(event);
      await emitWatchEvent(input.onEvent, event);
    },
  };
}

export async function getRepoOutline(input: { repoRoot: string }): Promise<RepoOutline> {
  const context = await createEngineContext(input);

  try {
    const languages = Object.fromEntries(
      (
        context.db.prepare(
          "SELECT language, COUNT(*) AS count FROM files GROUP BY language",
        ).all() as Array<{ language: SupportedLanguage; count: number }>
      ).map((row) => [row.language, row.count]),
    ) as RepoOutline["languages"];

    return {
      totalFiles: countRows(context.db, "SELECT COUNT(*) AS count FROM files"),
      totalSymbols: countRows(context.db, "SELECT COUNT(*) AS count FROM symbols"),
      languages,
    };
  } finally {
    closeEngineContext(context);
  }
}

export async function getFileTree(input: { repoRoot: string }): Promise<FileTreeEntry[]> {
  const context = await createEngineContext(input);

  try {
    const rows = typedAll<{
      path: string;
      language: SupportedLanguage;
      symbol_count: number;
    }>(
      context.db.prepare("SELECT path, language, symbol_count FROM files ORDER BY path ASC"),
    );
    return rows.map((row) => ({
      path: row.path,
      language: row.language,
      symbolCount: row.symbol_count,
    }));
  } finally {
    closeEngineContext(context);
  }
}

export async function getFileOutline(input: {
  repoRoot: string;
  filePath: string;
}): Promise<FileOutline> {
  const context = await createEngineContext(input);
  const { relativePath } = normalizeRepoRelativePath(context.config.repoRoot, input.filePath);

  try {
    const rows = typedAll<DbSymbolRow>(context.db.prepare(
      `
        SELECT
          id, name, qualified_name, kind, file_path, signature, summary,
          summary_source,
          start_line, end_line, start_byte, end_byte, exported
        FROM symbols
        WHERE file_path = ?
        ORDER BY start_line ASC
      `,
    ), relativePath);

    return {
      filePath: relativePath,
      symbols: rows.map(mapSymbolRow),
    };
  } finally {
    closeEngineContext(context);
  }
}

export async function suggestInitialQueries(input: {
  repoRoot: string;
}): Promise<string[]> {
  const context = await createEngineContext(input);

  try {
    const rows = context.db.prepare(
      `
        SELECT name, kind, file_path, exported
        FROM symbols
        ORDER BY exported DESC, kind = 'class' DESC, kind = 'function' DESC, name ASC
        LIMIT 5
      `,
    ).all() as Array<{
      name: string;
      kind: SymbolSummary["kind"];
      file_path: string;
      exported: number;
    }>;

    return rows.map(
      (row) => `Inspect ${row.kind} ${row.name} in ${row.file_path}`,
    );
  } finally {
    closeEngineContext(context);
  }
}

export async function searchSymbols(
  input: SearchSymbolsOptions,
): Promise<SymbolSummary[]> {
  validateSearchSymbolsOptions(input);
  const context = await createEngineContext(input);

  try {
    return searchSymbolsInContext(context, input);
  } finally {
    closeEngineContext(context);
  }
}

export async function searchText(
  input: SearchTextOptions,
): Promise<SearchTextMatch[]> {
  validateSearchTextOptions(input);
  if (await shouldUseLiveTextSearchFallback({ repoRoot: input.repoRoot })) {
    const config = await ensureStorage(input.repoRoot);
    return searchLiveText({
      repoRoot: config.repoRoot,
      query: input.query,
      filePattern: input.filePattern,
      maxMatches: Math.min(
        input.limit ?? config.maxLiveSearchMatches,
        config.maxLiveSearchMatches,
        config.maxTextResults,
      ),
      maxOutputBytes: config.maxChildProcessOutputBytes,
    });
  }

  const context = await createEngineContext(input);

  try {
    return searchTextInContext(context, input);
  } finally {
    closeEngineContext(context);
  }
}

export async function findFiles(
  input: FindFilesOptions,
): Promise<FindFilesMatch[]> {
  const normalizedInput = validateFindFilesOptions(input);
  const config = await ensureStorage(input.repoRoot);
  const context = await createEngineContext({ repoRoot: config.repoRoot });

  try {
    const indexedPaths = new Set(
      typedAll<{ path: string }>(
        context.db.prepare("SELECT path FROM files ORDER BY path ASC"),
      ).map((row) => row.path),
    );
    const discoveredPaths: string[] = [];
    await collectRepoFiles(
      config.repoRoot,
      config.repoRoot,
      discoveredPaths,
      Math.max(config.maxFilesDiscovered, input.limit ?? 0),
    );
    const resultLimit = Math.min(
      input.limit ?? config.maxSymbolResults,
      config.maxFilesDiscovered,
    );

    return discoveredPaths
      .filter((filePath) => matchesFilePattern(filePath, normalizedInput.filePattern))
      .map((filePath) => {
        const match = scoreFindFileMatch(filePath, normalizedInput.query);
        const language = supportedLanguageForFile(filePath);
        return {
          filePath,
          fileName: path.basename(filePath),
          language,
          indexed: indexedPaths.has(filePath),
          match,
        };
      })
      .filter((entry) => entry.match.matched)
      .sort(
        (left, right) =>
          right.match.score - left.match.score ||
          Number(right.indexed) - Number(left.indexed) ||
          left.filePath.localeCompare(right.filePath),
      )
      .slice(0, resultLimit)
      .map((entry) => ({
        filePath: entry.filePath,
        fileName: entry.fileName,
        language: entry.language,
        supportTier: supportTierForFile(entry.filePath, entry.language),
        indexed: entry.indexed,
        matchReason: entry.match.reason,
      }));
  } finally {
    closeEngineContext(context);
  }
}

export async function getFileSummary(
  input: FileSummaryOptions,
): Promise<FileSummaryResult> {
  validateFileSummaryOptions(input);
  const config = await ensureStorage(input.repoRoot);
  const context = await createEngineContext({ repoRoot: config.repoRoot });
  const { absolutePath, relativePath } = normalizeRepoRelativePath(config.repoRoot, input.filePath);
  const language = supportedLanguageForFile(relativePath);

  try {
    const indexed = Boolean(
      context.db.prepare("SELECT 1 AS present FROM files WHERE path = ?").get(relativePath),
    );
    const outline = indexed
      ? {
          filePath: relativePath,
          symbols: typedAll<DbSymbolRow>(
            context.db.prepare(
              `
                SELECT
                  id, name, qualified_name, kind, file_path, signature, summary,
                  summary_source,
                  start_line, end_line, start_byte, end_byte, exported
                FROM symbols
                WHERE file_path = ?
                ORDER BY start_line ASC
              `,
            ),
            relativePath,
          ).map(mapSymbolRow),
        }
      : null;
    if (outline && outline.symbols.length > 0) {
      const structured = summarizeStructuredFile(relativePath, outline.symbols);
      return {
        filePath: relativePath,
        fileName: path.basename(relativePath),
        language,
        supportTier: "structured",
        support: {
          activeTier: "structured",
          availableTiers: availableSupportTiersForFile(relativePath, language),
          reason: supportReasonForFile(relativePath, language),
        },
        indexed,
        summarySource: structured.summarySource,
        summary: structured.summary,
        confidence: "high",
        symbolCount: outline.symbols.length,
        topSymbols: structured.topSymbols,
        hints: structured.hints,
      };
    }

    const content = await readFile(absolutePath, "utf8");
    const discovery = summarizeDiscoveryContent(relativePath, content);
    return {
      filePath: relativePath,
      fileName: path.basename(relativePath),
      language,
      supportTier: "discovery",
      support: {
        activeTier: "discovery",
        availableTiers: availableSupportTiersForFile(relativePath, language),
        reason: supportReasonForFile(relativePath, language),
      },
      indexed,
      summarySource: discovery.summarySource,
      summary: discovery.summary,
      confidence: language ? "high" : "medium",
      symbolCount: outline?.symbols.length ?? 0,
      topSymbols: [],
      hints: discovery.hints,
    };
  } finally {
    closeEngineContext(context);
  }
}

export async function getProjectStatus(
  input: ProjectStatusOptions,
): Promise<ProjectStatusResult> {
  validateProjectStatusOptions(input);
  const diagnosticsResult = await diagnostics(input);
  const languageRegistry = getLanguageRegistrySnapshot();
  const readinessSummary = summarizeReadiness(
    diagnosticsResult.readiness.discoveryReady,
    diagnosticsResult.readiness.deepRetrievalReady,
  );
  const lifecycleSuffix = diagnosticsResult.readiness.deepening
    ? ` while deepening ${diagnosticsResult.readiness.pendingDeepIndexedFiles} pending files`
    : "";

  return {
    repoRoot: diagnosticsResult.storageDir.endsWith(".astrograph")
      ? path.dirname(diagnosticsResult.storageDir)
      : input.repoRoot,
    summary: `Astrograph is ${readinessSummary}${lifecycleSuffix} with freshness ${diagnosticsResult.staleStatus}`,
    readiness: diagnosticsResult.readiness,
    freshness: {
      staleStatus: diagnosticsResult.staleStatus,
      staleReasons: diagnosticsResult.staleReasons,
      indexedFiles: diagnosticsResult.indexedFiles,
      indexedSymbols: diagnosticsResult.indexedSymbols,
      changedFiles: diagnosticsResult.changedFiles,
      missingFiles: diagnosticsResult.missingFiles,
      extraFiles: diagnosticsResult.extraFiles,
    },
    supportTiers: {
      discovery: {
        languages: listLanguagesForTier("discovery"),
        fallbackExtensions: listFallbackExtensions(),
        summarySources: listDiscoverySummarySources(),
      },
      structured: {
        languages: listLanguagesForTier("structured"),
      },
      graph: {
        languages: listLanguagesForTier("graph"),
      },
      byLanguage: languageRegistry.byLanguage,
      byFallbackExtension: languageRegistry.byFallbackExtension,
    },
    watch: diagnosticsResult.watch,
  };
}

export async function queryCode(
  input: QueryCodeOptions,
): Promise<QueryCodeResult> {
  const resolvedIntent = resolveQueryCodeIntent(input);
  if (
    resolvedIntent === "discover"
    && input.includeTextMatches
    && await shouldUseLiveTextSearchFallback({
      repoRoot: input.repoRoot,
    })
  ) {
    const config = await ensureStorage(input.repoRoot);
    const textMatches = await searchLiveText({
      repoRoot: config.repoRoot,
      query: input.query ?? "",
      filePattern: input.filePattern,
      maxMatches: Math.min(config.maxLiveSearchMatches, config.maxTextResults),
      maxOutputBytes: config.maxChildProcessOutputBytes,
    });
    return {
      intent: "discover",
      query: input.query ?? "",
      symbolMatches: [],
      textMatches,
      matches: [],
      textMatchResults: buildTextMatchResults(textMatches),
    };
  }

  const context = await createEngineContext(input);

  try {
    return queryCodeInContext(context, input, resolvedIntent);
  } finally {
    closeEngineContext(context);
  }
}

export async function getContextBundle(
  input: ContextBundleOptions,
): Promise<ContextBundle> {
  const context = await createEngineContext(input);

  try {
    return getContextBundleFromContext(context, input);
  } finally {
    closeEngineContext(context);
  }
}


export async function getRankedContext(input: {
  repoRoot: string;
  query: string;
  tokenBudget?: number;
  includeDependencies?: boolean;
  includeImporters?: boolean;
  includeReferences?: boolean;
  relationDepth?: number;
}): Promise<RankedContextResult> {
  const context = await createEngineContext(input);

  try {
    return getRankedContextFromContext(context, input);
  } finally {
    closeEngineContext(context);
  }
}


export async function getFileContent(input: {
  repoRoot: string;
  filePath: string;
}): Promise<FileContentResult> {
  const context = await createEngineContext(input);

  try {
    return getFileContentFromContext(context, input.filePath);
  } finally {
    closeEngineContext(context);
  }
}


export async function getSymbolSource(input: {
  repoRoot: string;
  symbolId?: string;
  symbolIds?: string[];
  verify?: boolean;
  contextLines?: number;
}): Promise<SymbolSourceResult> {
  const context = await createEngineContext(input);

  try {
    return getSymbolSourceFromContext(context, input);
  } finally {
    closeEngineContext(context);
  }
}

export async function diagnostics(input: DiagnosticsOptions): Promise<DiagnosticsResult> {
  const config = await ensureStorage(input.repoRoot);
  const db = openDatabase(config.paths.databasePath);
  const repoRoot = config.repoRoot;

  try {
    const metaHealth = await readRepoMetaHealth(
      config.paths.repoMetaPath,
      config.paths.integrityPath,
    );
    const meta = metaHealth.meta;
    const indexedEntries = loadIndexedSnapshot(db);
    const dependencyGraph = loadDependencyGraphHealth(db);
    const indexedSnapshotHash =
      meta?.indexedSnapshotHash ?? (indexedEntries.length > 0 ? snapshotHash(indexedEntries) : null);
    const scanFreshness = input.scanFreshness === true;
  const drift = scanFreshness
      ? compareSnapshots(
          indexedEntries,
          await loadFilesystemSnapshot(repoRoot, {
            include: config.indexInclude,
            exclude: config.indexExclude,
            maxFilesDiscovered: config.maxFilesDiscovered,
            maxFileBytes: config.maxFileBytes,
          }),
        )
      : {
          missingPaths: [] as string[],
          extraPaths: [] as string[],
          changedPaths: [] as string[],
          indexedFiles: indexedEntries.length,
          currentFiles: meta?.indexedFiles ?? indexedEntries.length,
          missingFiles: 0,
          changedFiles: 0,
          extraFiles: 0,
          indexedSnapshotHash: indexedSnapshotHash ?? null,
          currentSnapshotHash: indexedSnapshotHash ?? null,
        };
    const indexedAt = meta?.indexedAt ?? null;
    const indexAgeMs =
      indexedAt !== null ? Math.max(0, Date.now() - Date.parse(indexedAt)) : null;
    const staleReasons: string[] = [];

    if (metaHealth.status === "missing") {
      staleReasons.push("index metadata missing");
    }
    if (metaHealth.status === "unreadable") {
      staleReasons.push("index metadata unreadable");
    }
    if (metaHealth.status === "missing-integrity") {
      staleReasons.push("index metadata integrity missing");
    }
    if (metaHealth.status === "integrity-mismatch") {
      staleReasons.push("index metadata integrity mismatch");
    }
    if (dependencyGraph.brokenRelativeImportCount > 0) {
      staleReasons.push("unresolved relative imports");
    }
    if (dependencyGraph.brokenRelativeSymbolImportCount > 0) {
      staleReasons.push("unresolved relative symbol imports");
    }
    if (scanFreshness) {
      if (drift.missingFiles > 0) {
        staleReasons.push("missing files");
      }
      if (drift.changedFiles > 0) {
        staleReasons.push("content drift");
      }
      if (drift.extraFiles > 0) {
        staleReasons.push("new files");
      }
    }

    const staleStatus: DiagnosticsResult["staleStatus"] =
      scanFreshness
        ? meta && staleReasons.length === 0
          ? "fresh"
          : meta
            ? "stale"
            : "unknown"
        : staleReasons.length > 0
          ? meta
            ? "stale"
            : "unknown"
          : meta?.staleStatus ?? "unknown";
    const summarySources = Object.fromEntries(
      typedAll<{ summary_source: SummarySource; count: number }>(
        db.prepare(
          `
            SELECT summary_source, COUNT(*) AS count
            FROM symbols
            GROUP BY summary_source
          `,
        ),
      ).map((row) => [row.summary_source, row.count]),
    ) as DiagnosticsResult["summarySources"];
    const indexedFiles = meta?.indexedFiles ?? drift.indexedFiles;
    const readiness = buildReadinessStatus({
      readiness: meta?.readiness,
      indexedFiles,
    });
    const languageRegistry = getLanguageRegistrySnapshot();

    return {
      engineVersion: ASTROGRAPH_PACKAGE_VERSION,
      engineVersionParts: ASTROGRAPH_VERSION_PARTS,
      storageDir: config.paths.storageDir,
      databasePath: config.paths.databasePath,
      storageVersion: meta?.storageVersion ?? ENGINE_STORAGE_VERSION,
      schemaVersion: readSchemaVersion(db),
      storageMode: config.storageMode,
      storageBackend: SQLITE_INDEX_BACKEND.backendName,
      staleStatus,
      freshnessMode: scanFreshness ? "scan" : "metadata",
      freshnessScanned: scanFreshness,
      summaryStrategy: meta?.summaryStrategy ?? config.summaryStrategy,
      summarySources,
      indexedAt,
      indexAgeMs,
      indexedFiles,
      indexedSymbols:
        meta?.indexedSymbols ??
        countRows(db, "SELECT COUNT(*) AS count FROM symbols"),
      currentFiles: drift.currentFiles,
      missingFiles: drift.missingFiles,
      changedFiles: drift.changedFiles,
      extraFiles: drift.extraFiles,
      indexedSnapshotHash,
      currentSnapshotHash: drift.currentSnapshotHash,
      staleReasons,
      readiness,
      parser: loadParserHealth(db),
      dependencyGraph,
      languageRegistry,
      watch: meta?.watch ?? createDefaultWatchDiagnostics(),
    };
  } finally {
    db.close();
  }
}

async function resolveDoctorObservability(
  repoRoot: string,
): Promise<DoctorResult["observability"]> {
  const repoConfig = await loadRepoEngineConfig(repoRoot, { repoRootResolved: true });

  if (!repoConfig.observability.enabled) {
    return {
      enabled: false,
      configuredHost: repoConfig.observability.host,
      configuredPort: repoConfig.observability.port,
      status: "disabled",
      url: null,
    };
  }

  return {
    enabled: true,
    configuredHost: repoConfig.observability.host,
    configuredPort: repoConfig.observability.port,
    status: "recording",
    url: null,
  };
}

function loadDependencyGraphHealth(
  db: IndexBackendConnection,
): DoctorResult["dependencyGraph"] {
  const brokenDependencyRows = typedAll<{
    importer_path: string;
    source: string;
  }>(
    db.prepare(`
      SELECT files.path AS importer_path, imports.source AS source
      FROM imports
      INNER JOIN files ON files.id = imports.file_id
      LEFT JOIN file_dependencies
        ON file_dependencies.importer_file_id = imports.file_id
        AND file_dependencies.source = imports.source
      WHERE (imports.source LIKE './%' OR imports.source LIKE '../%' OR imports.source LIKE '/%')
        AND file_dependencies.target_path IS NULL
      ORDER BY files.path ASC, imports.source ASC
    `),
  );
  const affectedImporters = [...new Set(
    brokenDependencyRows.map((row) => row.importer_path),
  )];
  const brokenRelativeSymbolRows = typedAll<{
    importer_path: string;
    target_path: string;
    specifiers: string;
  }>(
    db.prepare(`
      SELECT
        file_dependencies.importer_path AS importer_path,
        file_dependencies.target_path AS target_path,
        imports.specifiers AS specifiers
      FROM file_dependencies
      INNER JOIN files ON files.id = file_dependencies.importer_file_id
      INNER JOIN imports
        ON imports.file_id = files.id
        AND imports.source = file_dependencies.source
      WHERE file_dependencies.source LIKE './%'
        OR file_dependencies.source LIKE '../%'
        OR file_dependencies.source LIKE '/%'
      ORDER BY file_dependencies.importer_path ASC, file_dependencies.target_path ASC
    `),
  );

  const brokenRelativeSymbolImporters = new Set<string>();
  let brokenRelativeSymbolImportCount = 0;

  for (const row of brokenRelativeSymbolRows) {
    const missingNamedSpecifiers = parseStoredImportSpecifiers(row.specifiers)
      .filter((specifier) => specifier.kind === "named")
      .filter((specifier) => {
        const exportedSymbol = typedGet<{ id: string }>(
          db.prepare(
            `
              SELECT id
              FROM symbols
              WHERE file_path = ?
                AND exported = 1
                AND (name = ? OR qualified_name = ?)
              LIMIT 1
            `,
          ),
          row.target_path,
          specifier.importedName,
          specifier.importedName,
        );
        return !exportedSymbol;
      });

    if (missingNamedSpecifiers.length === 0) {
      continue;
    }

    brokenRelativeSymbolImportCount += missingNamedSpecifiers.length;
    brokenRelativeSymbolImporters.add(row.importer_path);
  }

  const allAffectedImporters = [...new Set([
    ...affectedImporters,
    ...brokenRelativeSymbolImporters,
  ])];
  const sampleImporterPaths = allAffectedImporters.slice(0, 5);

  return {
    brokenRelativeImportCount: brokenDependencyRows.length,
    brokenRelativeSymbolImportCount,
    affectedImporterCount: allAffectedImporters.length,
    sampleImporterPaths,
  };
}

function loadPrivacyHealth(
  db: IndexBackendConnection,
): DoctorResult["privacy"] {
  const rows = typedAll<{ file_path: string; content: string }>(
    db.prepare(`
      SELECT files.path AS file_path, content_blobs.content AS content
      FROM content_blobs
      INNER JOIN files ON files.id = content_blobs.file_id
      ORDER BY files.path ASC
    `),
  );
  const sampleFilePaths: string[] = [];
  let secretLikeFileCount = 0;

  for (const row of rows) {
    if (!containsSecretLikeText(row.content)) {
      continue;
    }

    secretLikeFileCount += 1;
    if (sampleFilePaths.length < 5) {
      sampleFilePaths.push(row.file_path);
    }
  }

  return {
    secretLikeFileCount,
    sampleFilePaths,
  };
}

function buildDoctorWarnings(result: DoctorResult): string[] {
  const warnings: string[] = [];

  if (result.indexStatus === "not-indexed") {
    warnings.push("No Astrograph index was found for this repository yet.");
  }
  if (result.indexStatus === "stale") {
    warnings.push("Indexed repository data is stale.");
  }
  if (result.parser.unknownFileCount > 0) {
    warnings.push(
      `Parser health is unavailable for ${result.parser.unknownFileCount} indexed file(s) created before parser metrics were recorded.`,
    );
  }
  if ((result.parser.fallbackRate ?? 0) > 0) {
    warnings.push(
      `Parser fallback was used for ${result.parser.fallbackFileCount} of ${result.parser.indexedFileCount} indexed file(s).`,
    );
  }
  if (result.dependencyGraph.brokenRelativeImportCount > 0) {
    warnings.push(
      `Dependency graph contains ${result.dependencyGraph.brokenRelativeImportCount} unresolved relative import(s) across ${result.dependencyGraph.affectedImporterCount} importer file(s).`,
    );
  }
  if (result.dependencyGraph.brokenRelativeSymbolImportCount > 0) {
    warnings.push(
      `Dependency graph contains ${result.dependencyGraph.brokenRelativeSymbolImportCount} unresolved relative symbol import(s).`,
    );
  }
  if (result.privacy.secretLikeFileCount > 0) {
    warnings.push(
      `Indexed source contains ${result.privacy.secretLikeFileCount} file(s) with obvious secret-like content.`,
    );
  }
  if (result.watch.status !== "watching") {
    warnings.push("Watch mode is not currently running.");
  }

  return warnings;
}

function buildMetaHealthWarnings(status: RepoMetaHealthStatus): string[] {
  switch (status) {
    case "unreadable":
      return ["Index metadata is unreadable."];
    case "missing-integrity":
      return ["Index metadata integrity file is missing."];
    case "integrity-mismatch":
      return ["Index metadata integrity check failed."];
    default:
      return [];
  }
}

function buildDoctorSuggestedActions(result: DoctorResult): string[] {
  const actions: string[] = [];

  if (result.indexStatus === "not-indexed") {
    actions.push(`Run \`pnpm exec astrograph cli index-folder --repo ${result.repoRoot}\` to create the initial index.`);
  }
  if (result.indexStatus === "stale") {
    actions.push(`Run \`pnpm exec astrograph cli index-folder --repo ${result.repoRoot}\` to refresh the stale index.`);
  }
  if (result.parser.unknownFileCount > 0) {
    actions.push("Reindex the repository to backfill parser health metrics on older indexed files.");
  }
  if (result.dependencyGraph.brokenRelativeImportCount > 0) {
    const sample = result.dependencyGraph.sampleImporterPaths[0];
    actions.push(
      sample
        ? `Fix or reindex importer paths such as \`${sample}\` so Astrograph can resolve their relative dependencies again.`
        : "Fix or reindex importer paths with unresolved relative dependencies.",
    );
  }
  if (result.dependencyGraph.brokenRelativeSymbolImportCount > 0) {
    const sample = result.dependencyGraph.sampleImporterPaths[0];
    actions.push(
      sample
        ? `Update importer paths such as \`${sample}\` or restore the expected exported symbols in their relative dependencies.`
        : "Update importer paths or restore the expected exported symbols in their relative dependencies.",
    );
  }
  if (result.privacy.secretLikeFileCount > 0) {
    const sample = result.privacy.sampleFilePaths[0];
    actions.push(
      sample
        ? `Review indexed file(s) such as \`${sample}\` and remove or rotate any real secrets that should not live in source.`
        : "Review indexed files with secret-like content and remove or rotate any real secrets that should not live in source.",
    );
  }
  if (result.watch.status !== "watching") {
    actions.push(`Run \`pnpm exec astrograph cli watch --repo ${result.repoRoot}\` if you want automatic local refresh while editing.`);
  }

  return actions;
}

function buildMetaHealthSuggestedActions(
  repoRoot: string,
  status: RepoMetaHealthStatus,
): string[] {
  switch (status) {
    case "unreadable":
    case "missing-integrity":
    case "integrity-mismatch":
      return [
        `Rebuild Astrograph metadata with \`pnpm exec astrograph cli index-folder --repo ${repoRoot}\` because the repo-local metadata sidecars are corrupted or incomplete.`,
      ];
    default:
      return [];
  }
}

export async function doctor(input: DiagnosticsOptions): Promise<DoctorResult> {
  const resolvedRepoRoot = await resolveEngineRepoRoot(input.repoRoot);
  const health = await diagnostics({
    ...input,
    repoRoot: resolvedRepoRoot,
  });
  const metaHealth = await readRepoMetaHealth(
    path.join(health.storageDir, "repo-meta.json"),
    path.join(health.storageDir, "integrity.sha256"),
  );
  const db = openDatabase(health.databasePath);

  try {
    const importCount = countRows(db, "SELECT COUNT(*) AS count FROM imports");
    const dependencyGraph = loadDependencyGraphHealth(db);
    const privacy = loadPrivacyHealth(db);
    const observability = await resolveDoctorObservability(resolvedRepoRoot);
    const result: DoctorResult = {
      repoRoot: resolvedRepoRoot,
      storageDir: health.storageDir,
      databasePath: health.databasePath,
      storageVersion: health.storageVersion,
      schemaVersion: health.schemaVersion,
      storageBackend: health.storageBackend,
      storageMode: health.storageMode,
      indexStatus:
        health.indexedAt === null && health.indexedFiles === 0
          ? "not-indexed"
          : health.staleStatus === "stale"
            ? "stale"
            : "indexed",
      freshness: {
        status: health.staleStatus,
        mode: health.freshnessMode,
        scanned: health.freshnessScanned,
        indexedAt: health.indexedAt,
        indexAgeMs: health.indexAgeMs,
        indexedFiles: health.indexedFiles,
        currentFiles: health.currentFiles,
        indexedSymbols: health.indexedSymbols,
        indexedImports: importCount,
        missingFiles: health.missingFiles,
        changedFiles: health.changedFiles,
        extraFiles: health.extraFiles,
      },
      parser: {
        ...health.parser,
      },
      dependencyGraph,
      observability,
      privacy,
      watch: health.watch,
      warnings: [],
      suggestedActions: [],
    };

    result.warnings = [
      ...buildDoctorWarnings(result),
      ...buildMetaHealthWarnings(metaHealth.status),
    ];
    result.suggestedActions = [
      ...buildDoctorSuggestedActions(result),
      ...buildMetaHealthSuggestedActions(result.repoRoot, metaHealth.status),
    ];
    return result;
  } finally {
    db.close();
  }
}
