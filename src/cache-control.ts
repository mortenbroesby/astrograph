import { lstat, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  loadRepoEngineConfig,
  resolveEnginePaths,
  resolveEngineRepoRoot,
  resolveGlobalCacheRoot,
} from "./config.ts";
import { getCheckoutByCanonicalRoot } from "./checkout-mapping.ts";
import { SQLITE_INDEX_BACKEND } from "./sqlite-backend.ts";
import { clearStorageProcessCaches } from "./storage.ts";
import { archiveManagedDirectory, validateManagedArchiveRestore, restoreManagedDirectory, type CacheArchiveReceipt } from "./cache-archive.ts";
import type { StorageLocation, StoragePathEnvironment } from "./types.ts";

export interface CacheStatus {
  schemaVersion: 1;
  repoRoot: string;
  storageLocation: StorageLocation;
  storageDir: string;
  storageVersion: number | null;
  bytes: number;
  exists: boolean;
  checkout: {
    mode: "git-branch" | "git-detached" | "git-worktree" | "filesystem" | "git-unavailable";
    repositoryId: string | null;
    headOid: string | null;
    branchRef: string | null;
    worktreePath: string | null;
    diagnostic: string | null;
    indexedAt: string;
  } | null;
}

export interface CacheMutationResult {
  schemaVersion: 1;
  action: "remove";
  repoRoot: string;
  storageDir: string;
  dryRun: boolean;
  changed: boolean;
  message: string;
  archive: CacheArchiveReceipt | null;
}

export interface CachePruneResult {
  schemaVersion: 1;
  action: "prune";
  cacheRoot: string;
  dryRun: boolean;
  requestedMaxBytes: number;
  bytesBefore: number;
  bytesAfter: number;
  candidates: Array<{ storageDir: string; bytes: number; active: boolean; removed: boolean; archive: CacheArchiveReceipt | null }>;
}

export interface CacheRestoreResult {
  schemaVersion: 1;
  action: "restore";
  dryRun: boolean;
  changed: boolean;
  receipt: CacheArchiveReceipt;
}

function restoreCommand(repoRoot: string, receiptPath: string): string {
  return `astrograph cache restore --repo ${JSON.stringify(repoRoot)} --receipt ${JSON.stringify(receiptPath)} --yes`;
}

function archiveRootFor(status: CacheStatus): string {
  return status.storageLocation === "global"
    ? path.join(path.dirname(status.storageDir), ".archive")
    : path.join(path.dirname(status.storageDir), ".astrograph-archive");
}

async function readVersion(storageDir: string): Promise<number | null> {
  try {
    const parsed = JSON.parse(await readFile(path.join(storageDir, "storage-version.json"), "utf8")) as { storageVersion?: unknown };
    return typeof parsed.storageVersion === "number" && Number.isInteger(parsed.storageVersion)
      ? parsed.storageVersion
      : null;
  } catch {
    return null;
  }
}

async function directoryBytes(target: string): Promise<number> {
  const entry = await lstat(target).catch(() => null);
  if (!entry) return 0;
  if (entry.isSymbolicLink()) throw new Error(`Refusing symlinked cache path: ${target}`);
  if (entry.isFile()) return entry.size;
  let total = 0;
  for (const child of await readdir(target)) total += await directoryBytes(path.join(target, child));
  return total;
}

async function hasContents(target: string): Promise<boolean> {
  return (await readdir(target).catch(() => [])).length > 0;
}

async function assertSafeCachePath(cacheRoot: string, target: string): Promise<void> {
  const relative = path.relative(cacheRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to mutate a path outside the global Astrograph cache root.");
  }
  const rootEntry = await lstat(cacheRoot).catch(() => null);
  if (rootEntry?.isSymbolicLink()) throw new Error(`Refusing symlinked cache root: ${cacheRoot}`);
  let current = cacheRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const entry = await lstat(current).catch(() => null);
    if (entry?.isSymbolicLink()) throw new Error(`Refusing symlinked cache path: ${current}`);
  }
}

async function cacheIsActive(storageDir: string): Promise<boolean> {
  const databasePath = path.join(storageDir, "index.sqlite");
  if (!await lstat(databasePath).catch(() => null)) return false;
  const db = SQLITE_INDEX_BACKEND.open(databasePath);
  try {
    db.exec("PRAGMA busy_timeout = 0");
    db.exec("BEGIN EXCLUSIVE");
    db.exec("ROLLBACK");
    return false;
  } catch {
    return true;
  } finally {
    db.close();
  }
}

async function readIndexedCheckout(
  databasePath: string,
  canonicalRoot: string,
): Promise<CacheStatus["checkout"]> {
  const database = await lstat(databasePath).catch(() => null);
  if (!database?.isFile()) return null;

  let db: ReturnType<typeof SQLITE_INDEX_BACKEND.open> | null = null;
  try {
    db = SQLITE_INDEX_BACKEND.open(databasePath);
    db.exec("PRAGMA busy_timeout = 0");
    const checkout = getCheckoutByCanonicalRoot(db, canonicalRoot);
    return checkout && {
      mode: checkout.gitMode,
      repositoryId: checkout.repositoryId,
      headOid: checkout.headOid,
      branchRef: checkout.branchRef,
      worktreePath: checkout.worktreePath,
      diagnostic: checkout.gitDiagnostic,
      indexedAt: checkout.updatedAt,
    };
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function cacheStatus(
  repoRoot: string,
  environment?: StoragePathEnvironment,
): Promise<CacheStatus> {
  const canonicalRoot = await resolveEngineRepoRoot(repoRoot);
  const config = await loadRepoEngineConfig(canonicalRoot, { repoRootResolved: true, environment });
  const selected = resolveEnginePaths(canonicalRoot, { storageLocation: config.storageLocation, environment });
  const selectedExists = await hasContents(selected.storageDir);
  return {
    schemaVersion: 1,
    repoRoot: canonicalRoot,
    storageLocation: config.storageLocation,
    storageDir: selected.storageDir,
    storageVersion: await readVersion(selected.storageDir),
    bytes: await directoryBytes(selected.storageDir),
    exists: selectedExists,
    checkout: await readIndexedCheckout(selected.databasePath, canonicalRoot),
  };
}

export async function removeGlobalCache(
  repoRoot: string,
  dryRun = true,
  environment?: StoragePathEnvironment,
): Promise<CacheMutationResult> {
  const status = await cacheStatus(repoRoot, environment);
  if (status.storageLocation !== "global") throw new Error("Global cache removal requires storageLocation: \"global\".");
  const root = resolveGlobalCacheRoot(environment);
  await assertSafeCachePath(root, status.storageDir);
  if (await cacheIsActive(status.storageDir)) throw new Error("Refusing to remove an active global Astrograph cache.");
  if (dryRun) return { schemaVersion: 1, action: "remove", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: false, message: "Would archive this repository's global cache only.", archive: null };
  clearStorageProcessCaches();
  const archive = await archiveManagedDirectory({
    target: status.storageDir,
    archiveRoot: archiveRootFor(status),
    reason: "explicit-remove",
    recoveryCommand: (receiptPath) => restoreCommand(status.repoRoot, receiptPath),
  });
  return { schemaVersion: 1, action: "remove", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: true, message: "Archived this repository's global cache.", archive };
}

export async function pruneGlobalCaches(
  requestedMaxBytes: number,
  dryRun = true,
  environment?: StoragePathEnvironment,
): Promise<CachePruneResult> {
  if (!Number.isSafeInteger(requestedMaxBytes) || requestedMaxBytes < 0) {
    throw new Error("--max-bytes must be a non-negative safe integer.");
  }
  const cacheRoot = resolveGlobalCacheRoot(environment);
  const reposRoot = path.join(cacheRoot, "repos");
  const entries = await readdir(reposRoot, { withFileTypes: true }).catch(() => []);
  const candidates = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name))
    .map(async (entry) => {
      const storageDir = path.join(reposRoot, entry.name);
      await assertSafeCachePath(cacheRoot, storageDir);
      return { storageDir, bytes: await directoryBytes(storageDir), modifiedAt: (await stat(storageDir)).mtimeMs };
    }));
  candidates.sort((left, right) => left.modifiedAt - right.modifiedAt || left.storageDir.localeCompare(right.storageDir));
  const bytesBefore = candidates.reduce((total, entry) => total + entry.bytes, 0);
  let bytesAfter = bytesBefore;
  const resultCandidates: CachePruneResult["candidates"] = [];
  for (const candidate of candidates) {
    if (bytesAfter <= requestedMaxBytes) break;
    const active = await cacheIsActive(candidate.storageDir);
    const removed = !active && !dryRun;
    let archive: CacheArchiveReceipt | null = null;
    resultCandidates.push({ storageDir: candidate.storageDir, bytes: candidate.bytes, active, removed, archive });
    if (active) continue;
    if (removed) {
      archive = await archiveManagedDirectory({
        target: candidate.storageDir,
        archiveRoot: path.join(path.dirname(candidate.storageDir), ".archive"),
        reason: "prune",
        recoveryCommand: (receiptPath) => `astrograph cache restore --repo <repository-root> --receipt ${JSON.stringify(receiptPath)} --yes`,
      });
      resultCandidates[resultCandidates.length - 1]!.archive = archive;
      bytesAfter -= candidate.bytes;
    } else {
      bytesAfter -= candidate.bytes;
    }
  }
  return { schemaVersion: 1, action: "prune", cacheRoot, dryRun, requestedMaxBytes, bytesBefore, bytesAfter, candidates: resultCandidates };
}

export async function restoreCache(
  repoRoot: string,
  receiptPath: string,
  dryRun = true,
  environment?: StoragePathEnvironment,
): Promise<CacheRestoreResult> {
  const status = await cacheStatus(repoRoot, environment);
  const archiveRoot = archiveRootFor(status);
  const originalRoot = path.dirname(status.storageDir);
  const input = { receiptPath, archiveRoot, originalRoot };
  const receipt = dryRun
    ? await validateManagedArchiveRestore(input)
    : await restoreManagedDirectory(input);
  if (dryRun) return { schemaVersion: 1, action: "restore", dryRun, changed: false, receipt };
  const restored = receipt;
  return { schemaVersion: 1, action: "restore", dryRun, changed: true, receipt: restored };
}

/** @deprecated Use restoreCache; this name is retained for library callers. */
export const restoreGlobalCache = restoreCache;
