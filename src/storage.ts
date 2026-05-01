import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
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
  ENGINE_SCHEMA_VERSION,
  ENGINE_STORAGE_VERSION,
  loadRepoEngineConfig,
  normalizeSummaryStrategy,
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
import { hashString } from "./hash.ts";
import type {
  IndexBackendConnection,
  IndexBackendValue,
  IndexStatement,
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
import { getLogger } from "./logger.ts";
import { SQLITE_INDEX_BACKEND } from "./sqlite-backend.ts";
import { subscribeRepo } from "./watch-backend.ts";
import {
  ASTROGRAPH_PACKAGE_VERSION,
  ASTROGRAPH_VERSION_PARTS,
} from "./version.ts";
import {
  validateContextBundleOptions,
  validateFindFilesOptions,
  validateFileSummaryOptions,
  validateProjectStatusOptions,
  validateRankedContextOptions,
  validateSearchTextOptions,
  validateSearchSymbolsOptions,
  validateSymbolSourceOptions,
} from "./validation.ts";
import type {
  DiagnosticsOptions,
  DiagnosticsResult,
  DoctorResult,
  ContextBundle,
  ContextBundleItem,
  ContextBundleItemRole,
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
  IndexSummary,
  ProjectStatusOptions,
  ProjectStatusResult,
  QueryCodeAssembleResult,
  QueryCodeDiscoverResult,
  QueryCodeIntent,
  QueryCodeMatchReason,
  QueryCodeSymbolMatch,
  QueryCodeTextMatch,
  QueryCodeOptions,
  QueryCodeResult,
  QueryCodeSourceResult,
  ImportSpecifier,
  RankingWeights,
  RankedContextCandidate,
  RankedContextResult,
  RepoOutline,
  SearchSymbolsOptions,
  SearchTextOptions,
  SearchTextMatch,
  SymbolSourceResult,
  SymbolSourceItem,
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

interface DbSymbolRow {
  file_id?: number;
  id: string;
  name: string;
  qualified_name: string | null;
  kind: SymbolSummary["kind"];
  file_path: string;
  signature: string;
  summary: string;
  summary_source: SummarySource;
  start_line: number;
  end_line: number;
  start_byte: number;
  end_byte: number;
  exported: number;
}

interface DbFileContentRow extends DbSymbolRow {
  content_hash: string;
  integrity_hash: string | null;
  content: string;
}

interface TrackedFileRow {
  id: number;
  content_hash: string;
  integrity_hash: string | null;
  size_bytes: number | null;
  mtime_ms: number | null;
}

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

type AnalyzedFileIndexResult =
  | {
    kind: "unchanged";
    existing: TrackedFileRow;
  }
  | {
    kind: "symbol-limit-exceeded";
    existing: TrackedFileRow | undefined;
    symbolCount: number;
  }
  | {
    kind: "content-unchanged";
    existing: TrackedFileRow;
    file: Awaited<ReturnType<typeof readRepoFile>>;
    reparsed: FileAnalysisTaskOutput["parsed"];
    symbolSignatureHash: string;
    importHash: string;
  }
  | {
    kind: "reindexed";
    existing: TrackedFileRow | undefined;
    file: Awaited<ReturnType<typeof readRepoFile>>;
    reparsed: FileAnalysisTaskOutput["parsed"];
    symbolSignatureHash: string;
    importHash: string;
  };

interface RepoMetaRecord {
  repoRoot: string;
  storageVersion?: number;
  indexedAt: string;
  indexedFiles: number;
  indexedSymbols: number;
  indexedSnapshotHash: string;
  storageMode: string;
  storageBackend?: string;
  staleStatus: "fresh" | "stale" | "unknown";
  summaryStrategy?: SummaryStrategy;
  readiness?: RepoMetaReadinessRecord;
  watch?: WatchDiagnostics;
}

type RepoMetaHealthStatus =
  | "ok"
  | "missing"
  | "unreadable"
  | "missing-integrity"
  | "integrity-mismatch";

interface RepoMetaHealth {
  meta: RepoMetaRecord | null;
  status: RepoMetaHealthStatus;
}

interface SchemaMigration {
  toVersion: number;
  run(db: IndexBackendConnection): void;
}

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

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

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

function mapSymbolRow(row: DbSymbolRow): SymbolSummary {
  return {
    id: row.id,
    name: row.name,
    qualifiedName: row.qualified_name,
    kind: row.kind,
    filePath: row.file_path,
    signature: row.signature,
    summary: row.summary,
    summarySource: row.summary_source,
    startLine: row.start_line,
    endLine: row.end_line,
    exported: Boolean(row.exported),
  };
}

function typedAll<TRow>(
  statement: IndexStatement,
  ...params: IndexBackendValue[]
): TRow[] {
  return statement.all(...params) as unknown as TRow[];
}

function typedGet<TRow>(
  statement: IndexStatement,
  ...params: IndexBackendValue[]
): TRow | undefined {
  return statement.get(...params) as unknown as TRow | undefined;
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

function readMetaNumber(
  db: IndexBackendConnection,
  key: string,
): number | null {
  const row = typedGet<{ value: string }>(
    db.prepare("SELECT value FROM meta WHERE key = ?"),
    key,
  );
  if (!row) {
    return null;
  }

  const parsed = Number.parseInt(row.value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function writeMetaNumber(
  db: IndexBackendConnection,
  key: string,
  value: number,
) {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, String(value));
}

function hasTableColumn(
  db: IndexBackendConnection,
  tableName: string,
  columnName: string,
) {
  return typedAll<{ name: string }>(
    db.prepare(`PRAGMA table_info(${tableName})`),
  ).some((column) => column.name === columnName);
}

const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    toVersion: 1,
    run(db) {
      if (!hasTableColumn(db, "symbols", "summary_source")) {
        db.exec(
          "ALTER TABLE symbols ADD COLUMN summary_source TEXT NOT NULL DEFAULT 'signature'",
        );
      }
      if (!hasTableColumn(db, "files", "parser_backend")) {
        db.exec("ALTER TABLE files ADD COLUMN parser_backend TEXT");
      }
      if (!hasTableColumn(db, "files", "parser_fallback_used")) {
        db.exec(
          "ALTER TABLE files ADD COLUMN parser_fallback_used INTEGER NOT NULL DEFAULT 0",
        );
      }
      if (!hasTableColumn(db, "files", "parser_fallback_reason")) {
        db.exec("ALTER TABLE files ADD COLUMN parser_fallback_reason TEXT");
      }
    },
  },
  {
    toVersion: 2,
    run(db) {
      if (!hasTableColumn(db, "files", "size_bytes")) {
        db.exec("ALTER TABLE files ADD COLUMN size_bytes INTEGER");
      }
      if (!hasTableColumn(db, "files", "mtime_ms")) {
        db.exec("ALTER TABLE files ADD COLUMN mtime_ms INTEGER");
      }
      if (!hasTableColumn(db, "files", "symbol_signature_hash")) {
        db.exec("ALTER TABLE files ADD COLUMN symbol_signature_hash TEXT");
      }
      if (!hasTableColumn(db, "files", "import_hash")) {
        db.exec("ALTER TABLE files ADD COLUMN import_hash TEXT");
      }
    },
  },
  {
    toVersion: 3,
    run(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS file_dependencies (
          importer_file_id INTEGER NOT NULL,
          importer_path TEXT NOT NULL,
          target_path TEXT NOT NULL,
          source TEXT NOT NULL,
          PRIMARY KEY(importer_file_id, target_path, source),
          FOREIGN KEY(importer_file_id) REFERENCES files(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    toVersion: 4,
    run(db) {
      if (!hasTableColumn(db, "files", "integrity_hash")) {
        db.exec("ALTER TABLE files ADD COLUMN integrity_hash TEXT");
      }
    },
  },
];

function runSchemaMigrations(db: IndexBackendConnection) {
  const currentVersion = readMetaNumber(db, "schemaVersion") ?? 0;

  for (const migration of SCHEMA_MIGRATIONS) {
    if (migration.toVersion <= currentVersion) {
      continue;
    }
    migration.run(db);
    writeMetaNumber(db, "schemaVersion", migration.toVersion);
  }

  const resolvedVersion = readMetaNumber(db, "schemaVersion") ?? 0;
  if (resolvedVersion !== ENGINE_SCHEMA_VERSION) {
    throw new Error(
      `Astrograph schema migration mismatch. Expected ${ENGINE_SCHEMA_VERSION}, got ${resolvedVersion}.`,
    );
  }
}

function initializeDatabase(db: IndexBackendConnection) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      language TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      integrity_hash TEXT,
      size_bytes INTEGER,
      mtime_ms INTEGER,
      symbol_signature_hash TEXT,
      import_hash TEXT,
      parser_backend TEXT,
      parser_fallback_used INTEGER NOT NULL DEFAULT 0,
      parser_fallback_reason TEXT,
      symbol_count INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS symbols (
      id TEXT PRIMARY KEY,
      file_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      name TEXT NOT NULL,
      qualified_name TEXT,
      kind TEXT NOT NULL,
      signature TEXT NOT NULL,
      summary TEXT NOT NULL,
      summary_source TEXT NOT NULL DEFAULT 'signature',
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      start_byte INTEGER NOT NULL,
      end_byte INTEGER NOT NULL,
      exported INTEGER NOT NULL,
      FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS imports (
      file_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      specifiers TEXT NOT NULL,
      FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS file_dependencies (
      importer_file_id INTEGER NOT NULL,
      importer_path TEXT NOT NULL,
      target_path TEXT NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY(importer_file_id, target_path, source),
      FOREIGN KEY(importer_file_id) REFERENCES files(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS content_blobs (
      file_id INTEGER PRIMARY KEY,
      content TEXT NOT NULL,
      FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS symbol_search USING fts5(
      symbol_id UNINDEXED,
      file_id UNINDEXED,
      name,
      qualified_name,
      signature,
      summary,
      file_path UNINDEXED,
      kind UNINDEXED,
      tokenize = 'unicode61'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS content_search USING fts5(
      file_id UNINDEXED,
      file_path UNINDEXED,
      content,
      tokenize = 'unicode61'
    );
    CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
    CREATE INDEX IF NOT EXISTS idx_symbols_file_path ON symbols(file_path);
  `);
  runSchemaMigrations(db);
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

function createDefaultWatchDiagnostics(): WatchDiagnostics {
  return {
    status: "idle",
    backend: null,
    debounceMs: null,
    pollMs: null,
    startedAt: null,
    lastEvent: null,
    lastEventAt: null,
    lastChangedPaths: [],
    reindexCount: 0,
    lastError: null,
    lastSummary: null,
  };
}

function normalizeWatchDiagnostics(value: unknown): WatchDiagnostics {
  if (typeof value !== "object" || value === null) {
    return createDefaultWatchDiagnostics();
  }

  const candidate = value as Partial<WatchDiagnostics>;
  return {
    status: candidate.status === "watching" ? "watching" : "idle",
    backend:
      candidate.backend === "parcel" ||
      candidate.backend === "node-fs-watch" ||
      candidate.backend === "polling"
        ? candidate.backend
        : null,
    debounceMs:
      typeof candidate.debounceMs === "number" ? candidate.debounceMs : null,
    pollMs: typeof candidate.pollMs === "number" ? candidate.pollMs : null,
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : null,
    lastEvent:
      candidate.lastEvent === "ready" ||
      candidate.lastEvent === "reindex" ||
      candidate.lastEvent === "error" ||
      candidate.lastEvent === "close"
        ? candidate.lastEvent
        : null,
    lastEventAt:
      typeof candidate.lastEventAt === "string" ? candidate.lastEventAt : null,
    lastChangedPaths: Array.isArray(candidate.lastChangedPaths)
      ? candidate.lastChangedPaths.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    reindexCount:
      typeof candidate.reindexCount === "number" ? candidate.reindexCount : 0,
    lastError: typeof candidate.lastError === "string" ? candidate.lastError : null,
    lastSummary:
      typeof candidate.lastSummary === "object" &&
      candidate.lastSummary !== null &&
      typeof candidate.lastSummary.indexedFiles === "number" &&
      typeof candidate.lastSummary.indexedSymbols === "number" &&
      (candidate.lastSummary.staleStatus === "fresh" ||
        candidate.lastSummary.staleStatus === "stale" ||
        candidate.lastSummary.staleStatus === "unknown")
        ? candidate.lastSummary
        : null,
  };
}

async function writeRepoMetaFiles(
  repoMetaPath: string,
  integrityPath: string,
  meta: RepoMetaRecord,
) {
  const metaJson = JSON.stringify(meta, null, 2);
  await writeFile(repoMetaPath, metaJson);
  await writeFile(integrityPath, sha256(metaJson));
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

async function readRepoMeta(
  repoMetaPath: string,
): Promise<RepoMetaRecord | null> {
  try {
    const content = await readFile(repoMetaPath, "utf8");
    const parsed = JSON.parse(content) as RepoMetaRecord;
    return {
      ...parsed,
      storageVersion:
        typeof parsed.storageVersion === "number" &&
        Number.isInteger(parsed.storageVersion)
          ? parsed.storageVersion
          : ENGINE_STORAGE_VERSION,
      summaryStrategy: normalizeSummaryStrategy(parsed.summaryStrategy),
      readiness: normalizeRepoReadiness(parsed.readiness),
      watch: normalizeWatchDiagnostics(parsed.watch),
    };
  } catch {
    return null;
  }
}

async function readRepoMetaHealth(
  repoMetaPath: string,
  integrityPath: string,
): Promise<RepoMetaHealth> {
  const metaContents = await readFile(repoMetaPath, "utf8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  });

  if (metaContents === null) {
    return {
      meta: null,
      status: "missing",
    };
  }

  let parsed: RepoMetaRecord;
  try {
    parsed = JSON.parse(metaContents) as RepoMetaRecord;
  } catch {
    return {
      meta: null,
      status: "unreadable",
    };
  }

  const meta: RepoMetaRecord = {
    ...parsed,
    storageVersion:
      typeof parsed.storageVersion === "number" &&
      Number.isInteger(parsed.storageVersion)
        ? parsed.storageVersion
        : ENGINE_STORAGE_VERSION,
    summaryStrategy: normalizeSummaryStrategy(parsed.summaryStrategy),
    readiness: normalizeRepoReadiness(parsed.readiness),
    watch: normalizeWatchDiagnostics(parsed.watch),
  };
  const integrityContents = await readFile(integrityPath, "utf8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  });

  if (integrityContents === null) {
    return {
      meta,
      status: "missing-integrity",
    };
  }

  return {
    meta,
    status:
      integrityContents.trim() === sha256(metaContents)
        ? "ok"
        : "integrity-mismatch",
  };
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

function countRows(db: IndexBackendConnection, sql: string): number {
  const row = db.prepare(sql).get() as { count: number };
  return row.count;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function queryTokens(value: string): string[] {
  return normalizeQuery(value)
    .split(/[^a-z0-9_]+/g)
    .filter(Boolean);
}

function uniqueQueryTerms(value: string): string[] {
  return [...new Set([
    normalizeQuery(value),
    ...queryTokens(value),
  ].filter(Boolean))];
}

function persistedSymbolCount(db: IndexBackendConnection, fileId: number): number {
  const countRow = typedGet<{ count: number }>(
    db.prepare("SELECT COUNT(*) AS count FROM symbols WHERE file_id = ?"),
    fileId,
  );
  return countRow?.count ?? 0;
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

function persistFileIndexResult(
  db: IndexBackendConnection,
  analyzed: AnalyzedFileIndexResult,
): { indexed: boolean; symbolCount: number } {
  if (analyzed.kind === "unchanged") {
    return {
      indexed: false,
      symbolCount: persistedSymbolCount(db, analyzed.existing.id),
    };
  }

  if (analyzed.kind === "symbol-limit-exceeded") {
    if (analyzed.existing) {
      clearFileSearchRows(db, analyzed.existing.id);
      db.prepare("DELETE FROM files WHERE id = ?").run(analyzed.existing.id);
    }

    return {
      indexed: false,
      symbolCount: 0,
    };
  }

  if (analyzed.kind === "content-unchanged") {
    db.prepare(
      `
        UPDATE files
        SET size_bytes = ?, mtime_ms = ?, integrity_hash = ?, symbol_signature_hash = ?, import_hash = ?, updated_at = ?
        WHERE id = ?
      `,
    ).run(
      analyzed.file.size,
      Math.trunc(analyzed.file.mtimeMs),
      analyzed.reparsed.integrityHash,
      analyzed.symbolSignatureHash,
      analyzed.importHash,
      new Date().toISOString(),
      analyzed.existing.id,
    );
    return {
      indexed: false,
      symbolCount: persistedSymbolCount(db, analyzed.existing.id),
    };
  }

  const { existing, file, reparsed, symbolSignatureHash, importHash } = analyzed;

  if (existing) {
    clearFileSearchRows(db, existing.id);
    db.prepare("DELETE FROM imports WHERE file_id = ?").run(existing.id);
    db.prepare("DELETE FROM symbols WHERE file_id = ?").run(existing.id);
    db.prepare("DELETE FROM content_blobs WHERE file_id = ?").run(existing.id);
    db.prepare(
      `
        UPDATE files
        SET language = ?, content_hash = ?, integrity_hash = ?, parser_backend = ?, parser_fallback_used = ?, parser_fallback_reason = ?, symbol_count = ?, updated_at = ?
        WHERE id = ?
      `,
    ).run(
      reparsed.language,
      reparsed.contentHash,
      reparsed.integrityHash,
      reparsed.backend,
      reparsed.fallbackUsed ? 1 : 0,
      reparsed.fallbackReason,
      reparsed.symbols.length,
      new Date().toISOString(),
      existing.id,
    );
    db.prepare(
      `
        UPDATE files
        SET size_bytes = ?, mtime_ms = ?, symbol_signature_hash = ?, import_hash = ?, updated_at = ?
        WHERE id = ?
      `,
    ).run(
      file.size,
      Math.trunc(file.mtimeMs),
      symbolSignatureHash,
      importHash,
      new Date().toISOString(),
      existing.id,
    );
  } else {
    db.prepare(
      `
        INSERT INTO files (
          path, language, content_hash, integrity_hash, size_bytes, mtime_ms,
          symbol_signature_hash, import_hash, parser_backend, parser_fallback_used,
          parser_fallback_reason, symbol_count, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      file.relativePath,
      reparsed.language,
      reparsed.contentHash,
      reparsed.integrityHash,
      file.size,
      Math.trunc(file.mtimeMs),
      symbolSignatureHash,
      importHash,
      reparsed.backend,
      reparsed.fallbackUsed ? 1 : 0,
      reparsed.fallbackReason,
      reparsed.symbols.length,
      new Date().toISOString(),
    );
  }

  const fileRow = db
    .prepare("SELECT id FROM files WHERE path = ?")
    .get(file.relativePath) as { id: number };
  db.prepare(
    "INSERT INTO content_blobs (file_id, content) VALUES (?, ?)",
  ).run(fileRow.id, file.content);
  db.prepare(
    "INSERT INTO content_search (file_id, file_path, content) VALUES (?, ?, ?)",
  ).run(fileRow.id, file.relativePath, file.content);
  const insertSymbol = db.prepare(`
    INSERT INTO symbols (
      id, file_id, file_path, name, qualified_name, kind, signature,
      summary, summary_source, start_line, end_line, start_byte, end_byte, exported
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSymbolSearch = db.prepare(`
    INSERT INTO symbol_search (
      symbol_id, file_id, name, qualified_name, signature, summary, file_path, kind
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const symbol of reparsed.symbols) {
    insertSymbol.run(
      symbol.id,
      fileRow.id,
      file.relativePath,
      symbol.name,
      symbol.qualifiedName,
      symbol.kind,
      symbol.signature,
      symbol.summary,
      symbol.summarySource,
      symbol.startLine,
      symbol.endLine,
      symbol.startByte,
      symbol.endByte,
      symbol.exported ? 1 : 0,
    );
    insertSymbolSearch.run(
      symbol.id,
      fileRow.id,
      symbol.name,
      symbol.qualifiedName ?? "",
      symbol.signature,
      symbol.summary,
      file.relativePath,
      symbol.kind,
    );
  }
  const insertImport = db.prepare(
    "INSERT INTO imports (file_id, source, specifiers) VALUES (?, ?, ?)",
  );
  for (const dependency of reparsed.imports) {
    insertImport.run(
      fileRow.id,
      dependency.source,
      JSON.stringify(dependency.specifiers),
    );
  }

  return {
    indexed: true,
    symbolCount: reparsed.symbols.length,
  };
}

function quoteFtsTerm(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

function buildFtsMatchQuery(value: string): string | null {
  const terms = uniqueQueryTerms(value)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  if (terms.length === 0) {
    return null;
  }

  return terms
    .map((term) => `${quoteFtsTerm(term)}*`)
    .join(" OR ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function rowText(row: DbSymbolRow): string {
  return [
    row.name,
    row.qualified_name ?? "",
    row.signature,
    row.summary,
    row.summary_source,
    row.file_path,
    row.kind,
  ]
    .join(" ")
    .toLowerCase();
}

function scoreSymbolRow(
  row: DbSymbolRow,
  query: string,
  weights: RankingWeights,
): number {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return 0;
  }

  const name = row.name.toLowerCase();
  const qualifiedName = row.qualified_name?.toLowerCase() ?? "";
  const signature = row.signature.toLowerCase();
  const summary = row.summary.toLowerCase();
  const filePath = row.file_path.toLowerCase();
  const haystack = rowText(row);
  const tokens = queryTokens(query);
  let score = 0;

  if (name === normalized) {
    score += weights.exactName;
  }
  if (qualifiedName === normalized) {
    score += weights.exactQualifiedName;
  }
  if (name.startsWith(normalized)) {
    score += weights.prefixName;
  }
  if (qualifiedName.startsWith(normalized)) {
    score += weights.prefixQualifiedName;
  }
  if (name.includes(normalized)) {
    score += weights.containsName;
  }
  if (qualifiedName.includes(normalized)) {
    score += weights.containsQualifiedName;
  }
  if (signature.includes(normalized)) {
    score += weights.signatureContains;
  }
  if (summary.includes(normalized)) {
    score += weights.summaryContains;
  }
  if (filePath.includes(normalized)) {
    score += weights.filePathContains;
  }

  const exactWord = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i");
  if (exactWord.test(rowText(row))) {
    score += weights.exactWord;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += weights.tokenMatch;
    }
  }

  if (score > 0 && row.exported) {
    score += weights.exportedBonus;
  }

  return score;
}

function clearFileSearchRows(
  db: IndexBackendConnection,
  fileId: number,
) {
  db.prepare("DELETE FROM symbol_search WHERE file_id = ?").run(fileId);
  db.prepare("DELETE FROM content_search WHERE file_id = ?").run(fileId);
}

function loadSymbolRows(
  db: IndexBackendConnection,
  input: {
    query?: string;
    kind?: SearchSymbolsOptions["kind"];
    language?: SearchSymbolsOptions["language"];
    filePattern?: SearchSymbolsOptions["filePattern"];
  } = {},
): DbSymbolRow[] {
  const whereClauses: string[] = [];
  const params: IndexBackendValue[] = [];
  const ftsQuery = buildFtsMatchQuery(input.query ?? "");
  let candidateIds: string[] | null = null;

  if (input.kind) {
    whereClauses.push("symbols.kind = ?");
    params.push(input.kind);
  }

  if (input.language) {
    whereClauses.push("files.language = ?");
    params.push(input.language);
  }

  const queryTerms = uniqueQueryTerms(input.query ?? "");

  if (ftsQuery) {
    const ftsParams: IndexBackendValue[] = [ftsQuery, ...params];

    const ftsRows = typedAll<{ symbol_id: string }>(
      db.prepare(
        `
          SELECT DISTINCT symbol_search.symbol_id
          FROM symbol_search
          INNER JOIN symbols ON symbols.id = symbol_search.symbol_id
          INNER JOIN files ON files.id = symbols.file_id
          WHERE symbol_search MATCH ?
          ${whereClauses.length > 0 ? `AND ${whereClauses.join(" AND ")}` : ""}
          LIMIT 400
        `,
      ),
      ...ftsParams,
    );

    candidateIds = ftsRows
      .map((row) => row.symbol_id)
      .filter(Boolean);
  }

  if (queryTerms.length > 0) {
    const tokenClauses = queryTerms.map(() =>
      `(
        lower(symbols.name) LIKE ?
        OR lower(COALESCE(symbols.qualified_name, '')) LIKE ?
        OR lower(symbols.signature) LIKE ?
        OR lower(symbols.summary) LIKE ?
        OR lower(symbols.file_path) LIKE ?
      )`,
    );
    whereClauses.push(`(${tokenClauses.join(" OR ")})`);

    for (const term of queryTerms) {
      const wildcard = `%${term}%`;
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }
  }

  if (candidateIds && candidateIds.length > 0) {
    const placeholders = candidateIds.map(() => "?").join(", ");
    whereClauses.push(`symbols.id IN (${placeholders})`);
    params.push(...candidateIds);
  }

  const rows = typedAll<DbSymbolRow>(
    db.prepare(
      `
        SELECT
          symbols.id, symbols.name, symbols.qualified_name, symbols.kind,
          symbols.file_path, symbols.signature, symbols.summary,
          symbols.summary_source,
          symbols.start_line, symbols.end_line, symbols.start_byte,
          symbols.end_byte, symbols.exported
        FROM symbols
        INNER JOIN files ON files.id = symbols.file_id
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
      `,
    ),
    ...params,
  );

  return rows
    .filter((row) => matchesFilePattern(row.file_path, input.filePattern));
}

function loadSymbolSourceRow(
  db: IndexBackendConnection,
  symbolId: string,
) {
  return typedGet<DbFileContentRow>(
    db.prepare(
      `
        SELECT
          symbols.id, symbols.name, symbols.qualified_name, symbols.kind, symbols.file_path,
          symbols.signature, symbols.summary, symbols.summary_source,
          symbols.start_line, symbols.end_line, symbols.start_byte, symbols.end_byte,
          symbols.exported,
          files.content_hash, files.integrity_hash, content_blobs.content
        FROM symbols
        INNER JOIN files ON files.id = symbols.file_id
        INNER JOIN content_blobs ON content_blobs.file_id = files.id
        WHERE symbols.id = ?
      `,
    ),
    symbolId,
  );
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

function pickDependencyRows(
  db: IndexBackendConnection,
  seedRow: DbSymbolRow,
): Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> {
  const imports = typedAll<{
    target_path: string;
    source: string;
    specifiers: string;
  }>(
    db.prepare(
      `
        SELECT file_dependencies.target_path AS target_path, file_dependencies.source AS source, imports.specifiers AS specifiers
        FROM file_dependencies
        INNER JOIN files ON files.id = file_dependencies.importer_file_id
        INNER JOIN imports ON imports.file_id = files.id AND imports.source = file_dependencies.source
        WHERE file_dependencies.importer_path = ?
        ORDER BY file_dependencies.target_path ASC, file_dependencies.source ASC
      `,
    ),
    seedRow.file_path,
  );

  const matches: Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> = [];
  const seen = new Set<string>();

  for (const importRow of imports) {
    const specifiers = parseStoredImportSpecifiers(importRow.specifiers);

    const picked: DbSymbolRow[] = [];

    for (const specifier of specifiers) {
      const row = typedGet<DbSymbolRow>(
        db.prepare(
          `
            SELECT
              id, name, qualified_name, kind, file_path, signature, summary,
              summary_source,
              start_line, end_line, start_byte, end_byte, exported
            FROM symbols
            WHERE file_path = ? AND (name = ? OR qualified_name = ?)
            ORDER BY exported DESC, start_line ASC
            LIMIT 1
          `,
        ),
        importRow.target_path,
        specifier.importedName,
        specifier.importedName,
      );
      if (row) {
        picked.push(row);
      }
    }

    if (picked.length === 0) {
      const row = typedGet<DbSymbolRow>(
        db.prepare(
          `
            SELECT
              id, name, qualified_name, kind, file_path, signature, summary,
              summary_source,
              start_line, end_line, start_byte, end_byte, exported
            FROM symbols
            WHERE file_path = ?
            ORDER BY exported DESC, kind = 'class' DESC, kind = 'function' DESC, start_line ASC
            LIMIT 1
          `,
        ),
        importRow.target_path,
      );
      if (row) {
        picked.push(row);
      }
    }

    for (const row of picked) {
      if (seen.has(row.id)) {
        continue;
      }
      seen.add(row.id);
      matches.push({
        row,
        reason: importRow.source.startsWith(".")
          ? "imports_matched_file"
          : "reexport_match",
      });
    }
  }

  return matches;
}

function pickImporterRows(
  db: IndexBackendConnection,
  seedRow: DbSymbolRow,
): Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> {
  const importers = typedAll<{
    importer_path: string;
  }>(
    db.prepare(
      `
        SELECT importer_path
        FROM file_dependencies
        WHERE target_path = ?
        ORDER BY importer_path ASC
      `,
    ),
    seedRow.file_path,
  );

  const matches: Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> = [];
  const seen = new Set<string>();

  for (const importer of importers) {
    const row = typedGet<DbSymbolRow>(
      db.prepare(
        `
          SELECT
            id, name, qualified_name, kind, file_path, signature, summary,
            summary_source,
            start_line, end_line, start_byte, end_byte, exported
          FROM symbols
          WHERE file_path = ?
          ORDER BY exported DESC, kind = 'class' DESC, kind = 'function' DESC, start_line ASC
          LIMIT 1
        `,
      ),
      importer.importer_path,
    );
    if (!row || seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    matches.push({
      row,
      reason: "imported_by_match",
    });
  }

  return matches;
}

function pickReferenceRows(
  db: IndexBackendConnection,
  seedRow: DbSymbolRow,
): Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> {
  const importers = typedAll<{
    importer_path: string;
    specifiers: string;
  }>(
    db.prepare(
      `
        SELECT file_dependencies.importer_path AS importer_path, imports.specifiers AS specifiers
        FROM file_dependencies
        INNER JOIN files ON files.id = file_dependencies.importer_file_id
        INNER JOIN imports ON imports.file_id = files.id AND imports.source = file_dependencies.source
        WHERE file_dependencies.target_path = ?
        ORDER BY file_dependencies.importer_path ASC
      `,
    ),
    seedRow.file_path,
  );

  const matches: Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> = [];
  const seen = new Set<string>();

  for (const importer of importers) {
    const specifiers = parseStoredImportSpecifiers(importer.specifiers);
    if (!specifiers.some((specifier) => specifier.importedName === seedRow.name)) {
      continue;
    }

    const row = typedGet<DbSymbolRow>(
      db.prepare(
        `
          SELECT
            id, name, qualified_name, kind, file_path, signature, summary,
            summary_source,
            start_line, end_line, start_byte, end_byte, exported
          FROM symbols
          WHERE file_path = ?
          ORDER BY exported DESC, kind = 'class' DESC, kind = 'function' DESC, start_line ASC
          LIMIT 1
        `,
      ),
      importer.importer_path,
    );
    if (!row || seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    matches.push({
      row,
      reason: "references_match",
    });
  }

  return matches;
}

function makeContextBundleItem(
  row: DbSymbolRow,
  source: string,
  role: ContextBundleItemRole,
  reason: string,
): ContextBundleItem {
  return {
    role,
    reason,
    symbol: mapSymbolRow(row),
    source,
    tokenCount: estimateTokens(source) + 8,
  };
}

function buildSymbolSourceItem(
  row: DbFileContentRow,
  verify: boolean,
  contextLines = 0,
): SymbolSourceItem {
  const normalizedContextLines = Math.max(0, Math.floor(contextLines));
  const lines = row.content.split("\n");
  const startLine = Math.max(1, row.start_line - normalizedContextLines);
  const endLine = Math.min(lines.length, row.end_line + normalizedContextLines);
  return {
    symbol: mapSymbolRow(row),
    source: lines.slice(startLine - 1, endLine).join("\n"),
    verified: verify
      ? row.integrity_hash === hashString(row.content, "integrity")
        || sha256(row.content) === row.content_hash
      : false,
    startLine,
    endLine,
  };
}

interface RankedSeedCandidate {
  row: DbFileContentRow;
  reason: QueryCodeMatchReason;
  score: number;
}

function sortRankedSymbolEntries(
  left: { row: DbSymbolRow; score: number },
  right: { row: DbSymbolRow; score: number },
) {
  return (
    right.score - left.score ||
    Number(right.row.exported) - Number(left.row.exported) ||
    left.row.file_path.localeCompare(right.row.file_path) ||
    left.row.start_line - right.row.start_line ||
    left.row.name.localeCompare(right.row.name)
  );
}

function resolveRankedSeedCandidates(
  context: EngineContext,
  input: ContextBundleOptions,
): RankedSeedCandidate[] {
  if (input.symbolIds?.length) {
    return input.symbolIds
      .map((symbolId) => loadSymbolSourceRow(context.db, symbolId))
      .filter(
        (row): row is DbFileContentRow => Boolean(row),
      )
      .map((row, index) => ({
        row,
        reason: "explicit_symbol_id",
        score: Math.max(1, input.symbolIds!.length - index),
      }));
  }

  if (!input.query) {
    return [];
  }

  return loadSymbolRows(context.db, { query: input.query })
    .map((row) => ({
      row,
      score: scoreSymbolRow(row, input.query ?? "", context.config.rankingWeights),
    }))
    .filter((entry) => entry.score > 0)
    .sort(sortRankedSymbolEntries)
    .slice(0, 5)
    .map((entry) => ({
      row: loadSymbolSourceRow(context.db, entry.row.id),
      reason:
        normalizeQuery(input.query ?? "") === normalizeQuery(entry.row.name)
        || normalizeQuery(input.query ?? "") === normalizeQuery(entry.row.qualified_name ?? "")
          ? "exact_symbol_match"
          : "query_match",
      score: entry.score,
    }))
    .filter(
      (
        entry,
      ): entry is RankedSeedCandidate => Boolean(entry.row),
    );
}

function buildContextBundleFromSeeds(
  db: IndexBackendConnection,
  input: ContextBundleOptions & Pick<QueryCodeOptions, "includeDependencies" | "includeImporters" | "includeReferences" | "relationDepth">,
  seedCandidates: RankedSeedCandidate[],
): ContextBundle {
  const bundleCandidates: Array<ContextBundleItem> = [];
  const seen = new Set<string>();

  for (const seed of seedCandidates) {
    if (seen.has(seed.row.id)) {
      continue;
    }
    seen.add(seed.row.id);
    bundleCandidates.push(
      makeContextBundleItem(
        seed.row,
        seed.row.content.slice(seed.row.start_byte, seed.row.end_byte),
        "target",
        seed.reason,
      ),
    );
  }

  const relationDepth = Math.min(3, Math.max(1, input.relationDepth ?? 1));
  const includeDependencies = input.includeDependencies ?? true;
  const includeImporters = input.includeImporters ?? false;
  const includeReferences = input.includeReferences ?? false;
  let frontier = seedCandidates.map((seed) => seed.row as DbSymbolRow);
  const visited = new Set(frontier.map((row) => row.id));

  for (let depth = 0; depth < relationDepth; depth += 1) {
    const nextFrontier: DbSymbolRow[] = [];

    for (const seedRow of frontier) {
      const relatedRows = [
        ...(includeDependencies ? pickDependencyRows(db, seedRow) : []),
        ...(includeReferences ? pickReferenceRows(db, seedRow) : []),
        ...(includeImporters ? pickImporterRows(db, seedRow) : []),
      ];

      for (const related of relatedRows) {
        if (seen.has(related.row.id)) {
          continue;
        }
        seen.add(related.row.id);
        const sourceRow = loadSymbolSourceRow(db, related.row.id);
        if (!sourceRow) {
          continue;
        }
        bundleCandidates.push(
          makeContextBundleItem(
            related.row,
            sourceRow.content.slice(sourceRow.start_byte, sourceRow.end_byte),
            "dependency",
            related.reason,
          ),
        );
        if (!visited.has(related.row.id)) {
          visited.add(related.row.id);
          nextFrontier.push(related.row);
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) {
      break;
    }
  }

  const tokenBudget = input.tokenBudget ?? 1200;
  const estimatedTokens = bundleCandidates.reduce(
    (total, item) => total + item.tokenCount,
    0,
  );
  const items: ContextBundleItem[] = [];
  let usedTokens = 0;

  for (const item of bundleCandidates) {
    if (usedTokens + item.tokenCount > tokenBudget) {
      break;
    }
    items.push(item);
    usedTokens += item.tokenCount;
  }

  return {
    repoRoot: input.repoRoot,
    query: input.query ?? null,
    tokenBudget,
    estimatedTokens,
    usedTokens,
    truncated: estimatedTokens > tokenBudget,
    items,
  };
}

function buildDiscoverGraphMatches(
  db: IndexBackendConnection,
  seedSymbols: SymbolSummary[],
  input: Pick<QueryCodeOptions, "query" | "includeDependencies" | "includeImporters" | "includeReferences" | "relationDepth" | "includeTextMatches">,
): {
  matches: QueryCodeSymbolMatch[];
  textMatchResults: QueryCodeTextMatch[];
} {
  const matches = new Map<string, QueryCodeSymbolMatch>();
  const query = normalizeQuery(input.query ?? "");
  const seedRows = seedSymbols
    .map((symbol) => loadSymbolSourceRow(db, symbol.id))
    .filter((row): row is DbFileContentRow => Boolean(row));

  for (const symbol of seedSymbols) {
    matches.set(symbol.id, {
      symbol,
      reasons: [
        query === normalizeQuery(symbol.name) || query === normalizeQuery(symbol.qualifiedName ?? "")
          ? "exact_symbol_match"
          : "query_match",
      ],
      depth: 0,
    });
  }

  const relationDepth = Math.min(3, Math.max(1, input.relationDepth ?? 1));
  let frontier = seedRows.map((row) => ({ row: row as DbSymbolRow, depth: 0 }));
  const visited = new Set(frontier.map((entry) => entry.row.id));

  while (frontier.length > 0) {
    const nextFrontier: Array<{ row: DbSymbolRow; depth: number }> = [];

    for (const entry of frontier) {
      if (entry.depth >= relationDepth) {
        continue;
      }

      const relatedRows = [
        ...(input.includeDependencies ? pickDependencyRows(db, entry.row) : []),
        ...(input.includeReferences ? pickReferenceRows(db, entry.row) : []),
        ...(input.includeImporters ? pickImporterRows(db, entry.row) : []),
      ];

      for (const related of relatedRows) {
        const existing = matches.get(related.row.id);
        if (existing) {
          if (!existing.reasons.includes(related.reason)) {
            existing.reasons.push(related.reason);
          }
          existing.depth = Math.min(existing.depth, entry.depth + 1);
        } else {
          matches.set(related.row.id, {
            symbol: mapSymbolRow(related.row),
            reasons: [related.reason],
            depth: entry.depth + 1,
          });
        }

        if (!visited.has(related.row.id)) {
          visited.add(related.row.id);
          nextFrontier.push({
            row: related.row,
            depth: entry.depth + 1,
          });
        }
      }
    }

    frontier = nextFrontier;
  }

  return {
    matches: [...matches.values()].sort(
      (left, right) =>
        left.depth - right.depth ||
        Number(right.symbol.exported) - Number(left.symbol.exported) ||
        left.symbol.filePath.localeCompare(right.symbol.filePath) ||
        left.symbol.startLine - right.symbol.startLine,
    ),
    textMatchResults: [],
  };
}

function buildTextMatchResults(
  textMatches: SearchTextMatch[],
): QueryCodeTextMatch[] {
  return textMatches.map((match) => ({
    match,
    reasons:
      match.reason === "ripgrep_fallback"
        ? ["ripgrep_fallback"]
        : ["text_match"],
  }));
}

async function shouldUseLiveTextSearchFallback(input: {
  repoRoot: string;
  summaryStrategy?: SummaryStrategy;
}): Promise<boolean> {
  const config = await ensureStorage(input.repoRoot, input.summaryStrategy);
  const meta = await readRepoMeta(config.paths.repoMetaPath);
  return !meta || meta.staleStatus !== "fresh";
}

function buildRankedContextResult(
  input: ContextBundleOptions & { query: string },
  seedCandidates: RankedSeedCandidate[],
  bundle: ContextBundle,
): RankedContextResult {
  const selectedSeedIds = bundle.items
    .filter((item) => item.role === "target")
    .map((item) => item.symbol.id);

  const candidates: RankedContextCandidate[] = seedCandidates.map((candidate, index) => ({
    rank: index + 1,
    score: candidate.score,
    reason: candidate.reason,
    symbol: mapSymbolRow(candidate.row),
    selected: selectedSeedIds.includes(candidate.row.id),
  }));

  return {
    repoRoot: input.repoRoot,
    query: input.query,
    tokenBudget: bundle.tokenBudget,
    candidateCount: candidates.length,
    selectedSeedIds,
    candidates,
    bundle,
  };
}

function removeFileIndex(
  db: IndexBackendConnection,
  filePath: string,
): boolean {
  const fileRow = typedGet<{ id: number }>(
    db.prepare("SELECT id FROM files WHERE path = ?"),
    filePath,
  );
  if (!fileRow) {
    return false;
  }
  clearFileSearchRows(db, fileRow.id);
  const result = db.prepare("DELETE FROM files WHERE path = ?").run(filePath);
  return Number(result.changes ?? 0) > 0;
}

async function finalizeIndex(
  db: IndexBackendConnection,
  repoRoot: string,
  indexedAt: string,
  summaryStrategy: SummaryStrategy,
  discoveredFiles?: number,
): Promise<"fresh" | "stale"> {
  rebuildFileDependencies(db);
  const dependencyGraph = loadDependencyGraphHealth(db);
  const totalFiles = countRows(db, "SELECT COUNT(*) AS count FROM files");
  const totalSymbols = countRows(db, "SELECT COUNT(*) AS count FROM symbols");
  const indexedSnapshotHash = snapshotHash(loadIndexedSnapshot(db));
  const staleStatus =
    dependencyGraph.brokenRelativeImportCount > 0
    || dependencyGraph.brokenRelativeSymbolImportCount > 0
      ? "stale"
      : "fresh";
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('staleStatus', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(staleStatus);
  await writeSidecars({
    repoRoot,
    indexedAt,
    indexedFiles: totalFiles,
    totalSymbols,
    indexedSnapshotHash,
    staleStatus,
    summaryStrategy,
    readiness: {
      discoveryIndexedAt: indexedAt,
      discoveredFiles: discoveredFiles ?? totalFiles,
      deepIndexedAt: indexedAt,
      deepening: null,
    },
  });
  return staleStatus;
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
    const staleStatus = await finalizeIndex(
      db,
      repoRoot,
      indexedAt,
      config.summaryStrategy,
      supportedFiles.length,
    );

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
    const staleStatus = await finalizeIndex(db, repoRoot, indexedAt, config.summaryStrategy);

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
        const staleStatus = await finalizeIndex(db, repoRoot, indexedAt, config.summaryStrategy);

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

function searchSymbolsInContext(
  context: EngineContext,
  input: SearchSymbolsOptions,
): SymbolSummary[] {
  const resultLimit = Math.min(
    input.limit ?? context.config.maxSymbolResults,
    context.config.maxSymbolResults,
  );
  const rows = loadSymbolRows(context.db, {
    query: input.query,
    kind: input.kind,
    language: input.language,
    filePattern: input.filePattern,
  });
  const normalizedQuery = normalizeQuery(input.query);

  return rows
    .map((row) => ({
      row,
      score: scoreSymbolRow(row, normalizedQuery, context.config.rankingWeights),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.row.exported) - Number(left.row.exported) ||
        left.row.file_path.localeCompare(right.row.file_path) ||
        left.row.start_line - right.row.start_line ||
        left.row.name.localeCompare(right.row.name),
    )
    .slice(0, resultLimit)
    .map((entry) => mapSymbolRow(entry.row));
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

function searchTextInContext(
  context: EngineContext,
  input: SearchTextOptions,
): SearchTextMatch[] {
  validateSearchTextOptions(input);
  const whereClauses: string[] = [];
  const params: IndexBackendValue[] = [];
  const ftsQuery = buildFtsMatchQuery(input.query);
  const resultLimit = Math.min(
    input.limit ?? context.config.maxTextResults,
    context.config.maxTextResults,
  );

  if (ftsQuery) {
    const ftsRows = typedAll<{ file_id: number }>(
      context.db.prepare(
        `
          SELECT DISTINCT file_id
          FROM content_search
          WHERE content_search MATCH ?
          LIMIT 200
        `,
      ),
      ftsQuery,
    );
    if (ftsRows.length > 0) {
      const placeholders = ftsRows.map(() => "?").join(", ");
      whereClauses.push(`files.id IN (${placeholders})`);
      params.push(...ftsRows.map((row) => row.file_id));
    }
  }

  const rows = typedAll<{ file_path: string; content: string }>(
    context.db.prepare(
      `
        SELECT files.path AS file_path, content_blobs.content AS content
        FROM content_blobs
        INNER JOIN files ON files.id = content_blobs.file_id
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
        ORDER BY files.path ASC
      `,
    ),
    ...params,
  );
  const lowerQuery = input.query.toLowerCase();
  const matches: SearchTextMatch[] = [];

  for (const row of rows) {
    if (!matchesFilePattern(row.file_path, input.filePattern)) {
      continue;
    }
    const lines = row.content.split("\n");
    lines.forEach((line, index) => {
      if (matches.length >= resultLimit) {
        return;
      }
      if (line.toLowerCase().includes(lowerQuery)) {
        matches.push({
          filePath: row.file_path,
          line: index + 1,
          preview: line.trim(),
        });
      }
    });
    if (matches.length >= resultLimit) {
      break;
    }
  }

  return matches;
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
    switch (resolvedIntent) {
      case "discover": {
        const symbolMatches = searchSymbolsInContext(context, {
          repoRoot: context.config.repoRoot,
          query: input.query ?? "",
          kind: input.kind,
          language: input.language,
          filePattern: input.filePattern,
          limit: input.limit,
        });
        const textMatches = input.includeTextMatches
          ? searchTextInContext(context, {
              repoRoot: context.config.repoRoot,
              query: input.query ?? "",
              filePattern: input.filePattern,
            })
          : [];
        const graphMatches = buildDiscoverGraphMatches(
          context.db,
          symbolMatches,
          input,
        );

        const result: QueryCodeDiscoverResult = {
          intent: "discover",
          query: input.query ?? "",
          symbolMatches,
          textMatches,
          matches: graphMatches.matches,
          textMatchResults: buildTextMatchResults(textMatches),
        };
        return result;
      }
      case "source": {
        const fileContent = input.filePath
          ? getFileContentFromContext(context, input.filePath)
          : null;
        const hasSymbolRequest = Boolean(input.symbolId) || Boolean(input.symbolIds?.length);
        const symbolSource = hasSymbolRequest
          ? getSymbolSourceFromContext(context, {
              symbolId: input.symbolId,
              symbolIds: input.symbolIds,
              contextLines: input.contextLines,
              verify: input.verify,
            })
          : null;

        const result: QueryCodeSourceResult = {
          intent: "source",
          fileContent,
          symbolSource,
        };
        return result;
      }
      case "assemble": {
        const ranked = input.includeRankedCandidates && input.query
          ? getRankedContextFromContext(context, {
              repoRoot: context.config.repoRoot,
              query: input.query,
              tokenBudget: input.tokenBudget,
              includeDependencies: input.includeDependencies,
              includeImporters: input.includeImporters,
              relationDepth: input.relationDepth,
            })
          : null;
        const bundle = ranked
          ? ranked.bundle
          : getContextBundleFromContext(context, {
              repoRoot: context.config.repoRoot,
              query: input.query,
              symbolIds: input.symbolIds,
              tokenBudget: input.tokenBudget,
              includeDependencies: input.includeDependencies,
              includeImporters: input.includeImporters,
              relationDepth: input.relationDepth,
            });

        const result: QueryCodeAssembleResult = {
          intent: "assemble",
          bundle,
          ranked,
        };
        return result;
      }
      default:
        throw new Error(`Unsupported query_code intent: ${String(input.intent)}`);
    }
  } finally {
    closeEngineContext(context);
  }
}

function resolveQueryCodeIntent(
  input: Pick<
    QueryCodeOptions,
    "intent" | "symbolId" | "symbolIds" | "filePath" | "tokenBudget" | "includeRankedCandidates"
  >,
): Exclude<QueryCodeIntent, "auto"> {
  if (input.intent && input.intent !== "auto") {
    return input.intent;
  }

  if (input.filePath || input.symbolId) {
    return "source";
  }

  if (input.tokenBudget !== undefined || input.includeRankedCandidates) {
    return "assemble";
  }

  if (input.symbolIds && input.symbolIds.length > 0) {
    return "source";
  }

  return "discover";
}

function getContextBundleFromContext(
  context: EngineContext,
  input: ContextBundleOptions,
): ContextBundle {
  const normalizedSeeds = validateContextBundleOptions(input);
  const normalizedInput = {
    ...input,
    repoRoot: context.config.repoRoot,
    ...normalizedSeeds,
  };
  const seedCandidates = resolveRankedSeedCandidates(context, normalizedInput).slice(0, 3);
  return buildContextBundleFromSeeds(context.db, normalizedInput, seedCandidates);
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

function getRankedContextFromContext(context: EngineContext, input: {
  repoRoot: string;
  query: string;
  tokenBudget?: number;
  includeDependencies?: boolean;
  includeImporters?: boolean;
  includeReferences?: boolean;
  relationDepth?: number;
}): RankedContextResult {
  validateRankedContextOptions(input);
  const normalizedInput = {
    ...input,
    repoRoot: context.config.repoRoot,
  };
  const seedCandidates = resolveRankedSeedCandidates(context, normalizedInput);
  const bundle = buildContextBundleFromSeeds(context.db, normalizedInput, seedCandidates.slice(0, 3));
  return buildRankedContextResult(normalizedInput, seedCandidates, bundle);
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

function getFileContentFromContext(
  context: EngineContext,
  filePath: string,
): FileContentResult {
  const { relativePath } = normalizeRepoRelativePath(context.config.repoRoot, filePath);
  const row = context.db.prepare(
      `
        SELECT content_blobs.content AS content
        FROM content_blobs
        INNER JOIN files ON files.id = content_blobs.file_id
        WHERE files.path = ?
      `,
    ).get(relativePath) as { content: string } | undefined;

  if (!row) {
    throw new Error(`File not indexed: ${relativePath}`);
  }

  return {
    filePath: relativePath,
    content: row.content,
  };
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

function getSymbolSourceFromContext(context: EngineContext, input: {
  symbolId?: string;
  symbolIds?: string[];
  verify?: boolean;
  contextLines?: number;
}): SymbolSourceResult {
  validateSymbolSourceOptions(input);
  const requestedIds = [
    ...(input.symbolId ? [input.symbolId] : []),
    ...(input.symbolIds ?? []),
  ];
  const symbolIds = [...new Set(requestedIds.filter(Boolean))];

  if (symbolIds.length === 0) {
    throw new Error("At least one symbol id is required");
  }

  const rows = symbolIds.map((symbolId) => {
    const row = context.db.prepare(
      `
        SELECT
          symbols.id, symbols.name, symbols.qualified_name, symbols.kind, symbols.file_path,
          symbols.signature, symbols.summary, symbols.summary_source,
          symbols.start_line, symbols.end_line, symbols.start_byte, symbols.end_byte,
          symbols.exported,
          files.content_hash, files.integrity_hash, content_blobs.content
        FROM symbols
        INNER JOIN files ON files.id = symbols.file_id
        INNER JOIN content_blobs ON content_blobs.file_id = files.id
        WHERE symbols.id = ?
      `,
    ).get(symbolId) as DbFileContentRow | undefined;

    if (!row) {
      throw new Error(`Symbol not indexed: ${symbolId}`);
    }
    return row;
  });

  const items = rows.map((row) =>
    buildSymbolSourceItem(row, input.verify === true, input.contextLines),
  );
  const first = items[0];

  return {
    requestedContextLines: Math.max(0, Math.floor(input.contextLines ?? 0)),
    items,
    symbol: first?.symbol,
    source: first?.source,
    verified: first?.verified,
    startLine: first?.startLine,
    endLine: first?.endLine,
  };
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
      schemaVersion: readMetaNumber(db, "schemaVersion") ?? ENGINE_SCHEMA_VERSION,
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
