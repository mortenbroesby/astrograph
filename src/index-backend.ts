import type { IndexBackendName } from "./types.ts";

export type IndexBackendValue =
  | string
  | number
  | bigint
  | Uint8Array
  | null;

export interface IndexStatementRunResult {
  changes: number | bigint;
  lastInsertRowid?: number | bigint;
}

export interface IndexStatement {
  all(...params: IndexBackendValue[]): unknown[];
  get(...params: IndexBackendValue[]): unknown;
  run(...params: IndexBackendValue[]): IndexStatementRunResult;
}

export interface IndexBackendConnection {
  readonly backendName: IndexBackendName;
  exec(sql: string): void;
  prepare(sql: string): IndexStatement;
  close(): void;
}

export interface EngineIndexBackend {
  readonly backendName: IndexBackendName;
  open(databasePath: string): IndexBackendConnection;
}
