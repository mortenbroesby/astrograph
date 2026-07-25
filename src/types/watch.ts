import type { StaleStatus, SummaryStrategy } from "./config.ts";

export interface IndexSummary {
  indexedFiles: number;
  indexedSymbols: number;
  /** Files whose existing indexed analysis was reused during this refresh. */
  reusedFiles: number;
  /** Files analyzed from source rather than an existing index/artifact. */
  parsedFiles: number;
  /** Previously indexed files removed because they are no longer indexable. */
  removedFiles: number;
  staleStatus: StaleStatus;
}

export interface WatchEvent {
  type: "ready" | "reindex" | "error" | "close";
  changedPaths: string[];
  summary?: IndexSummary;
  message?: string;
}

export interface WatchOptions {
  repoRoot: string;
  debounceMs?: number;
  backend?: WatchBackendKind | "auto";
  summaryStrategy?: SummaryStrategy;
  onEvent?: (event: WatchEvent) => void | Promise<void>;
}

export interface WatchHandle {
  close(): Promise<void>;
}

export type WatchBackendKind = "parcel" | "node-fs-watch" | "polling";

export interface WatchDiagnostics {
  status: "idle" | "watching";
  backend: WatchBackendKind | null;
  debounceMs: number | null;
  pollMs: number | null;
  startedAt: string | null;
  lastEvent: WatchEvent["type"] | null;
  lastEventAt: string | null;
  lastChangedPaths: string[];
  reindexCount: number;
  lastError: string | null;
  lastSummary: IndexSummary | null;
}
