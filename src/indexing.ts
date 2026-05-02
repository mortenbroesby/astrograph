import { snapshotHash } from "./filesystem-scan.ts";
import type { SnapshotEntry } from "./filesystem-scan.ts";
import type { FileAnalysisTaskOutput } from "./file-analysis.ts";
import type { IndexBackendConnection } from "./index-backend.ts";
import {
  countRows,
  typedAll,
  typedGet,
} from "./storage-queries.ts";
import type { TrackedFileRow } from "./storage-queries.ts";
import type {
  DoctorResult,
  SummaryStrategy,
} from "./types.ts";

export type StaleStatus = "fresh" | "stale";

export type FileIndexContent = {
  relativePath: string;
  language: FileAnalysisTaskOutput["parsed"]["language"];
  content: string;
  mtimeMs: number;
  size: number;
};

export type AnalyzedFileIndexResult =
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
    file: FileIndexContent;
    reparsed: FileAnalysisTaskOutput["parsed"];
    symbolSignatureHash: string;
    importHash: string;
  }
  | {
    kind: "reindexed";
    existing: TrackedFileRow | undefined;
    file: FileIndexContent;
    reparsed: FileAnalysisTaskOutput["parsed"];
    symbolSignatureHash: string;
    importHash: string;
  };

function persistedSymbolCount(db: IndexBackendConnection, fileId: number): number {
  const countRow = typedGet<{ count: number }>(
    db.prepare("SELECT COUNT(*) AS count FROM symbols WHERE file_id = ?"),
    fileId,
  );
  return countRow?.count ?? 0;
}

function clearFileSearchRows(
  db: IndexBackendConnection,
  fileId: number,
) {
  db.prepare("DELETE FROM symbol_search WHERE file_id = ?").run(fileId);
  db.prepare("DELETE FROM content_search WHERE file_id = ?").run(fileId);
}

export function persistFileIndexResult(
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

export function removeFileIndex(
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

function loadIndexedSnapshot(
  db: IndexBackendConnection,
): SnapshotEntry[] {
  return typedAll<SnapshotEntry>(
    db.prepare(
      "SELECT path, content_hash AS contentHash FROM files ORDER BY path ASC",
    ),
  );
}

export async function finalizeIndex(input: {
  db: IndexBackendConnection;
  repoRoot: string;
  indexedAt: string;
  summaryStrategy: SummaryStrategy;
  discoveredFiles?: number;
  rebuildFileDependencies(db: IndexBackendConnection): void;
  loadDependencyGraphHealth(
    db: IndexBackendConnection,
  ): DoctorResult["dependencyGraph"];
  writeSidecars(input: {
    repoRoot: string;
    indexedAt: string;
    indexedFiles: number;
    totalSymbols: number;
    indexedSnapshotHash: string;
    staleStatus: "fresh" | "stale" | "unknown";
    summaryStrategy: SummaryStrategy;
    readiness?: {
      discoveryIndexedAt: string | null;
      discoveredFiles: number;
      deepIndexedAt: string | null;
      deepening: {
        startedAt: string;
        totalFiles: number;
        processedFiles: number;
        pendingFiles: number;
      } | null;
    };
  }): Promise<void>;
}): Promise<StaleStatus> {
  input.rebuildFileDependencies(input.db);
  const dependencyGraph = input.loadDependencyGraphHealth(input.db);
  const totalFiles = countRows(input.db, "SELECT COUNT(*) AS count FROM files");
  const totalSymbols = countRows(input.db, "SELECT COUNT(*) AS count FROM symbols");
  const indexedSnapshotHash = snapshotHash(loadIndexedSnapshot(input.db));
  const staleStatus =
    dependencyGraph.brokenRelativeImportCount > 0
    || dependencyGraph.brokenRelativeSymbolImportCount > 0
      ? "stale"
      : "fresh";
  input.db.prepare(
    "INSERT INTO meta (key, value) VALUES ('staleStatus', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(staleStatus);
  await input.writeSidecars({
    repoRoot: input.repoRoot,
    indexedAt: input.indexedAt,
    indexedFiles: totalFiles,
    totalSymbols,
    indexedSnapshotHash,
    staleStatus,
    summaryStrategy: input.summaryStrategy,
    readiness: {
      discoveryIndexedAt: input.indexedAt,
      discoveredFiles: input.discoveredFiles ?? totalFiles,
      deepIndexedAt: input.indexedAt,
      deepening: null,
    },
  });
  return staleStatus;
}
