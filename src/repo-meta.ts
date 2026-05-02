import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { ENGINE_STORAGE_VERSION, normalizeSummaryStrategy } from "./config.ts";
import { normalizeRepoReadiness } from "./readiness.ts";
import type { RepoMetaReadinessRecord } from "./readiness.ts";
import type { SummaryStrategy, WatchDiagnostics } from "./types.ts";

export interface RepoMetaRecord {
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

export type RepoMetaHealthStatus =
  | "ok"
  | "missing"
  | "unreadable"
  | "missing-integrity"
  | "integrity-mismatch";

export interface RepoMetaHealth {
  meta: RepoMetaRecord | null;
  status: RepoMetaHealthStatus;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createDefaultWatchDiagnostics(): WatchDiagnostics {
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

function normalizeRepoMetaRecord(parsed: RepoMetaRecord): RepoMetaRecord {
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
}

export async function writeRepoMetaFiles(
  repoMetaPath: string,
  integrityPath: string,
  meta: RepoMetaRecord,
) {
  const metaJson = JSON.stringify(meta, null, 2);
  await writeFile(repoMetaPath, metaJson);
  await writeFile(integrityPath, sha256(metaJson));
}

export async function readRepoMeta(
  repoMetaPath: string,
): Promise<RepoMetaRecord | null> {
  try {
    const content = await readFile(repoMetaPath, "utf8");
    const parsed = JSON.parse(content) as RepoMetaRecord;
    return normalizeRepoMetaRecord(parsed);
  } catch {
    return null;
  }
}

export async function readRepoMetaHealth(
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

  const meta = normalizeRepoMetaRecord(parsed);
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
