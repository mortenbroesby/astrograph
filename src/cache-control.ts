import { cp, lstat, mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import {
  ENGINE_STORAGE_VERSION,
  loadRepoEngineConfig,
  resolveEnginePaths,
  resolveEngineRepoRoot,
  resolveGlobalCacheRoot,
} from "./config.ts";
import { readRepoMeta } from "./repo-meta.ts";
import { SQLITE_INDEX_BACKEND } from "./sqlite-backend.ts";
import { clearStorageProcessCaches } from "./storage.ts";
import type { StorageLocation, StoragePathEnvironment } from "./types.ts";

export interface CacheStatus {
  schemaVersion: 1;
  repoRoot: string;
  storageLocation: StorageLocation;
  storageDir: string;
  storageVersion: number | null;
  bytes: number;
  exists: boolean;
  migration: "not-needed" | "available" | "already-migrated" | "source-unverified";
}

export interface CacheMutationResult {
  schemaVersion: 1;
  action: "migrate" | "remove";
  repoRoot: string;
  storageDir: string;
  dryRun: boolean;
  changed: boolean;
  message: string;
}

export interface CachePruneResult {
  schemaVersion: 1;
  action: "prune";
  cacheRoot: string;
  dryRun: boolean;
  requestedMaxBytes: number;
  bytesBefore: number;
  bytesAfter: number;
  candidates: Array<{ storageDir: string; bytes: number; active: boolean; removed: boolean }>;
}

async function readVersion(storageDir: string): Promise<number | null> {
  try {
    const parsed = JSON.parse(await readFile(path.join(storageDir, "storage-version.json"), "utf8")) as { version?: unknown };
    return typeof parsed.version === "number" && Number.isInteger(parsed.version) ? parsed.version : null;
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

async function validateCache(storageDir: string, repoRoot: string): Promise<void> {
  const version = await readVersion(storageDir);
  if (version !== ENGINE_STORAGE_VERSION) {
    throw new Error(`Cache at ${storageDir} has incompatible storage version ${version ?? "missing"}; expected ${ENGINE_STORAGE_VERSION}.`);
  }
  const meta = await readRepoMeta(path.join(storageDir, "repo-meta.json"));
  if (!meta || meta.repoRoot !== repoRoot) {
    throw new Error(`Cache at ${storageDir} is not verified for repository ${repoRoot}.`);
  }
  const dbPath = path.join(storageDir, "index.sqlite");
  await stat(dbPath);
  const db = SQLITE_INDEX_BACKEND.open(dbPath);
  try { db.prepare("PRAGMA quick_check").get(); } finally { db.close(); }
}

export async function cacheStatus(
  repoRoot: string,
  environment?: StoragePathEnvironment,
): Promise<CacheStatus> {
  const canonicalRoot = await resolveEngineRepoRoot(repoRoot);
  const config = await loadRepoEngineConfig(canonicalRoot, { repoRootResolved: true, environment });
  const selected = resolveEnginePaths(canonicalRoot, { storageLocation: config.storageLocation, environment });
  const local = resolveEnginePaths(canonicalRoot);
  const selectedExists = await hasContents(selected.storageDir);
  const localExists = await hasContents(local.storageDir);
  const migration = config.storageLocation !== "global"
    ? "not-needed"
    : selectedExists ? "already-migrated"
    : !localExists ? "not-needed"
    : (await readRepoMeta(local.repoMetaPath))?.repoRoot === canonicalRoot ? "available" : "source-unverified";
  return {
    schemaVersion: 1,
    repoRoot: canonicalRoot,
    storageLocation: config.storageLocation,
    storageDir: selected.storageDir,
    storageVersion: await readVersion(selected.storageDir),
    bytes: await directoryBytes(selected.storageDir),
    exists: selectedExists,
    migration,
  };
}

export async function migrateLocalCache(
  repoRoot: string,
  dryRun = true,
  environment?: StoragePathEnvironment,
): Promise<CacheMutationResult> {
  const status = await cacheStatus(repoRoot, environment);
  if (status.storageLocation !== "global") throw new Error("Global cache migration requires storageLocation: \"global\".");
  const source = resolveEnginePaths(status.repoRoot).storageDir;
  if (!await hasContents(source)) return { schemaVersion: 1, action: "migrate", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: false, message: "No repository-local cache exists." };
  await validateCache(source, status.repoRoot);
  if (status.exists) {
    await validateCache(status.storageDir, status.repoRoot);
    return { schemaVersion: 1, action: "migrate", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: false, message: "Verified global cache already exists; local cache was preserved." };
  }
  const stagingPrefix = `${path.basename(status.storageDir)}.migrating-`;
  const staleStaging = (await readdir(path.dirname(status.storageDir)).catch(() => []))
    .find((entry) => entry.startsWith(stagingPrefix));
  if (staleStaging) {
    throw new Error(
      `A previous global cache migration is incomplete at ${path.join(path.dirname(status.storageDir), staleStaging)}. ` +
      "The repository-local cache was preserved; inspect or remove the staging directory, then retry.",
    );
  }
  if (dryRun) return { schemaVersion: 1, action: "migrate", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: false, message: "Would copy the verified repository-local cache; source would remain intact." };
  const staging = `${status.storageDir}.migrating-${process.pid}-${Date.now()}`;
  await mkdir(path.dirname(status.storageDir), { recursive: true, mode: 0o700 });
  try {
    await cp(source, staging, { recursive: true, errorOnExist: true, force: false });
    await validateCache(staging, status.repoRoot);
    await rename(staging, status.storageDir);
    clearStorageProcessCaches();
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(`Global cache migration did not complete; the repository-local cache was preserved. ${error instanceof Error ? error.message : String(error)}`);
  }
  return { schemaVersion: 1, action: "migrate", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: true, message: "Copied verified local cache to global storage; repository-local cache was preserved." };
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
  if (dryRun) return { schemaVersion: 1, action: "remove", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: false, message: "Would remove this repository's global cache only." };
  clearStorageProcessCaches();
  await rm(status.storageDir, { recursive: true, force: false });
  return { schemaVersion: 1, action: "remove", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: true, message: "Removed this repository's global cache." };
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
    resultCandidates.push({ storageDir: candidate.storageDir, bytes: candidate.bytes, active, removed });
    if (active) continue;
    if (removed) {
      await rm(candidate.storageDir, { recursive: true, force: false });
      bytesAfter -= candidate.bytes;
    } else {
      bytesAfter -= candidate.bytes;
    }
  }
  return { schemaVersion: 1, action: "prune", cacheRoot, dryRun, requestedMaxBytes, bytesBefore, bytesAfter, candidates: resultCandidates };
}
