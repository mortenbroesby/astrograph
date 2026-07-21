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
  const relative = path.relative(root, status.storageDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Refusing to remove a path outside the global Astrograph cache root.");
  if (dryRun) return { schemaVersion: 1, action: "remove", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: false, message: "Would remove this repository's global cache only." };
  clearStorageProcessCaches();
  await rm(status.storageDir, { recursive: true, force: false });
  return { schemaVersion: 1, action: "remove", repoRoot: status.repoRoot, storageDir: status.storageDir, dryRun, changed: true, message: "Removed this repository's global cache." };
}
