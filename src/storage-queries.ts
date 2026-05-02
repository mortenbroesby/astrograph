import type {
  IndexBackendConnection,
  IndexBackendValue,
  IndexStatement,
} from "./index-backend.ts";
import type {
  SummarySource,
  SymbolSummary,
} from "./types.ts";

export interface DbSymbolRow {
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

export interface DbFileContentRow extends DbSymbolRow {
  content_hash: string;
  integrity_hash: string | null;
  content: string;
}

export interface TrackedFileRow {
  id: number;
  content_hash: string;
  integrity_hash: string | null;
  size_bytes: number | null;
  mtime_ms: number | null;
}

export function mapSymbolRow(row: DbSymbolRow): SymbolSummary {
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

export function typedAll<TRow>(
  statement: IndexStatement,
  ...params: IndexBackendValue[]
): TRow[] {
  return statement.all(...params) as unknown as TRow[];
}

export function typedGet<TRow>(
  statement: IndexStatement,
  ...params: IndexBackendValue[]
): TRow | undefined {
  return statement.get(...params) as unknown as TRow | undefined;
}

export function countRows(db: IndexBackendConnection, sql: string): number {
  const row = db.prepare(sql).get() as { count: number };
  return row.count;
}
