import { ENGINE_SCHEMA_VERSION } from "./config.ts";
import type { IndexBackendConnection } from "./index-backend.ts";
import {
  typedAll,
  typedGet,
} from "./storage-queries.ts";

interface SchemaMigration {
  toVersion: number;
  run(db: IndexBackendConnection): void;
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

export function readSchemaVersion(db: IndexBackendConnection): number {
  return readMetaNumber(db, "schemaVersion") ?? ENGINE_SCHEMA_VERSION;
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

export function initializeDatabase(db: IndexBackendConnection) {
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
