import { ASTROGRAPH_PACKAGE_VERSION, ASTROGRAPH_VERSION_PARTS } from "./version.ts";
import { loadFilesystemSnapshot, snapshotHash } from "./filesystem-scan.ts";
import type { SnapshotEntry } from "./filesystem-scan.ts";
import { getLanguageRegistrySnapshot } from "./language-registry.ts";
import { classifyRetrievalHealth } from "./retrieval-health.ts";
import { createDefaultWatchDiagnostics } from "./repo-meta.ts";
import { ENGINE_STORAGE_VERSION } from "./config.ts";
import type { RepoMetaHealth, RepoMetaHealthStatus } from "./repo-meta.ts";
import { buildReadinessStatus, type RepoMetaReadinessRecord } from "./readiness.ts";
import { readSchemaVersion } from "./storage-schema.ts";
import { countRows, typedAll, typedGet } from "./storage-queries.ts";
import type { IndexBackendConnection } from "./index-backend.ts";
import type {
  DiagnosticsResult,
  DoctorResult,
  IndexBackendName,
  SummarySource,
  StorageMode,
  SummaryStrategy,
} from "./types.ts";

function loadMetaHealthReasons(
  status: RepoMetaHealthStatus,
): string[] {
  const staleReasons: string[] = [];

  if (status === "missing") {
    staleReasons.push("index metadata missing");
  }
  if (status === "unreadable") {
    staleReasons.push("index metadata unreadable");
  }
  if (status === "missing-integrity") {
    staleReasons.push("index metadata integrity missing");
  }
  if (status === "integrity-mismatch") {
    staleReasons.push("index metadata integrity mismatch");
  }

  return staleReasons;
}

function loadCheckoutMappingHealthReasons(
  db: IndexBackendConnection,
  repoRoot: string,
): string[] {
  const indexedFileCount = countRows(db, "SELECT COUNT(*) AS count FROM files");
  if (indexedFileCount === 0) {
    return [];
  }

  const checkout = typedGet<{ checkout_id: string }>(
    db.prepare("SELECT checkout_id FROM checkouts WHERE canonical_root = ?"),
    repoRoot,
  );
  if (!checkout) {
    return ["checkout mapping missing"];
  }

  const unmappedFiles = typedGet<{ count: number }>(
    db.prepare(`SELECT COUNT(*) AS count
     FROM files
     LEFT JOIN checkout_path_mappings
       ON checkout_path_mappings.checkout_id = ?
       AND checkout_path_mappings.relative_path = files.path
     WHERE checkout_path_mappings.relative_path IS NULL`),
    checkout.checkout_id,
  )?.count ?? 0;
  if (unmappedFiles > 0) {
    return ["checkout path mappings incomplete"];
  }

  const missingEdges = typedGet<{ count: number }>(
    db.prepare(`SELECT COUNT(*) AS count
     FROM file_dependencies
     LEFT JOIN checkout_dependencies
       ON checkout_dependencies.checkout_id = ?
       AND checkout_dependencies.importer_path = file_dependencies.importer_path
       AND checkout_dependencies.target_path = file_dependencies.target_path
       AND checkout_dependencies.source = file_dependencies.source
     WHERE checkout_dependencies.checkout_id IS NULL`),
    checkout.checkout_id,
  )?.count ?? 0;
  return missingEdges > 0 ? ["checkout dependency mappings incomplete"] : [];
}

export function loadIndexedSnapshot(db: IndexBackendConnection): SnapshotEntry[] {
  return typedAll<SnapshotEntry>(
    db.prepare(
      "SELECT path, content_hash AS contentHash FROM files ORDER BY path ASC",
    ),
  );
}

export function compareSnapshots(
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

export function loadParserHealth(db: IndexBackendConnection): DiagnosticsResult["parser"] {
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
    primaryBackend: "tree-sitter",
    fallbackBackend: null,
    indexedFileCount: parserStats.indexed_file_count ?? 0,
    fallbackFileCount,
    fallbackRate: knownFileCount > 0 ? fallbackFileCount / knownFileCount : null,
    unknownFileCount: parserStats.unknown_file_count ?? 0,
    fallbackReasons,
  };
}

export interface DiagnosticsAssemblyInput {
  db: IndexBackendConnection;
  repoRoot: string;
  storageDir: string;
  databasePath: string;
  storageMode: StorageMode;
  summaryStrategy: SummaryStrategy;
  storageBackend: IndexBackendName;
  metaHealth: RepoMetaHealth;
  dependencyGraph: DoctorResult["dependencyGraph"];
  scanFreshness?: boolean;
  indexInclude: string[];
  indexExclude: string[];
  maxFilesDiscovered: number;
  maxFileBytes: number;
  readiness?: RepoMetaReadinessRecord | null;
}

export async function buildDiagnosticsResult(
  input: DiagnosticsAssemblyInput,
): Promise<DiagnosticsResult> {
  const metaHealthStatus: RepoMetaHealthStatus = input.metaHealth.status;
  const meta = input.metaHealth.meta;
  const indexedEntries = loadIndexedSnapshot(input.db);
  const indexedSnapshotHash =
    meta?.indexedSnapshotHash ?? (indexedEntries.length > 0 ? snapshotHash(indexedEntries) : null);
  const scanFreshness = input.scanFreshness === true;

  const drift = scanFreshness
    ? compareSnapshots(
        indexedEntries,
        await loadFilesystemSnapshot(input.repoRoot, {
          include: input.indexInclude,
          exclude: input.indexExclude,
          maxFilesDiscovered: input.maxFilesDiscovered,
          maxFileBytes: input.maxFileBytes,
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
  const staleReasons: string[] = [
    ...loadMetaHealthReasons(metaHealthStatus),
    ...loadCheckoutMappingHealthReasons(input.db, input.repoRoot),
    ...(input.dependencyGraph.brokenRelativeImportCount > 0
      ? ["unresolved relative imports"]
      : []),
    ...(input.dependencyGraph.brokenRelativeSymbolImportCount > 0
      ? ["unresolved relative symbol imports"]
      : []),
  ];

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
      input.db.prepare(
        `
          SELECT summary_source, COUNT(*) AS count
          FROM symbols
          GROUP BY summary_source
        `,
      ),
    ).map((row) => [row.summary_source, row.count]),
  ) as DiagnosticsResult["summarySources"];
  const languageRegistry = getLanguageRegistrySnapshot();
  const indexedFiles = meta?.indexedFiles ?? drift.indexedFiles;
  const readiness = buildReadinessStatus({
    readiness: input.readiness ?? meta?.readiness,
    indexedFiles,
  });

  const result = {
    engineVersion: ASTROGRAPH_PACKAGE_VERSION,
    engineVersionParts: ASTROGRAPH_VERSION_PARTS,
    storageDir: input.storageDir,
    databasePath: input.databasePath,
    storageVersion: meta?.storageVersion ?? ENGINE_STORAGE_VERSION,
    schemaVersion: readSchemaVersion(input.db),
    storageMode: input.storageMode,
    storageBackend: input.storageBackend,
    staleStatus,
    freshnessMode: scanFreshness ? "scan" : "metadata",
    freshnessScanned: scanFreshness,
    summaryStrategy: meta?.summaryStrategy ?? input.summaryStrategy,
    summarySources,
    indexedAt,
    indexAgeMs,
    indexedFiles,
    indexedSymbols:
      meta?.indexedSymbols ??
      countRows(input.db, "SELECT COUNT(*) AS count FROM symbols"),
    currentFiles: drift.currentFiles,
    missingFiles: drift.missingFiles,
    changedFiles: drift.changedFiles,
    extraFiles: drift.extraFiles,
    indexedSnapshotHash,
    currentSnapshotHash: drift.currentSnapshotHash,
    staleReasons,
    readiness,
    parser: loadParserHealth(input.db),
    dependencyGraph: input.dependencyGraph,
    languageRegistry: {
      byLanguage: languageRegistry.byLanguage,
      byFallbackExtension: languageRegistry.byFallbackExtension,
    },
    watch: meta?.watch ?? createDefaultWatchDiagnostics(),
  } satisfies Omit<DiagnosticsResult, "retrievalHealth">;

  return {
    ...result,
    retrievalHealth: classifyRetrievalHealth(result),
  };
}
