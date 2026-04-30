import { createRequire } from "node:module";
import type BetterSqlite3 from "better-sqlite3";

import type {
  EngineIndexBackend,
  IndexBackendConnection,
  IndexBackendValue,
  IndexStatement,
  IndexStatementRunResult,
} from "./index-backend.ts";

const require = createRequire(import.meta.url);
const BetterSqlite3Database = require("better-sqlite3") as typeof BetterSqlite3;

class SqliteStatement implements IndexStatement {
  private readonly statement: BetterSqlite3.Statement;

  constructor(statement: BetterSqlite3.Statement) {
    this.statement = statement;
  }

  all(...params: IndexBackendValue[]): unknown[] {
    return this.statement.all(...params as Parameters<BetterSqlite3.Statement["all"]>) as unknown[];
  }

  get(...params: IndexBackendValue[]): unknown {
    return this.statement.get(...params as Parameters<BetterSqlite3.Statement["get"]>);
  }

  run(...params: IndexBackendValue[]): IndexStatementRunResult {
    const result = this.statement.run(...params as Parameters<BetterSqlite3.Statement["run"]>);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }
}

class SqliteConnection implements IndexBackendConnection {
  readonly backendName = "sqlite";
  private readonly db: BetterSqlite3.Database;
  private readonly statementCache = new Map<string, SqliteStatement>();

  constructor(db: BetterSqlite3.Database) {
    this.db = db;
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): IndexStatement {
    let statement = this.statementCache.get(sql);
    if (!statement) {
      statement = new SqliteStatement(this.db.prepare(sql));
      this.statementCache.set(sql, statement);
    }

    return statement;
  }

  close(): void {
    this.statementCache.clear();
    this.db.close();
  }
}

class SqliteIndexBackend implements EngineIndexBackend {
  readonly backendName = "sqlite";

  open(databasePath: string): IndexBackendConnection {
    return new SqliteConnection(new BetterSqlite3Database(databasePath));
  }
}

export const SQLITE_INDEX_BACKEND: EngineIndexBackend = new SqliteIndexBackend();
