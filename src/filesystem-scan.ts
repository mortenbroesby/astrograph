import { execFileSync, spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fdir } from "fdir";

import { createDefaultEngineConfig } from "./config.ts";
import { hashString } from "./hash.ts";
import { supportedLanguageForFile } from "./language-registry.ts";
import { createPathMatcher } from "./path-matcher.ts";
import type { SupportedLanguage } from "./types.ts";

export interface SnapshotEntry {
  path: string;
  contentHash: string;
}

export interface FilesystemStateEntry {
  path: string;
  mtimeMs: number;
  size: number;
}

export interface DirectoryStateEntry {
  path: string;
  mtimeMs: number;
}

interface SupportedFileCandidate {
  absolutePath: string;
  relativePath: string;
}

export interface DiscoveredSourceFile {
  absolutePath: string;
  relativePath: string;
  language: SupportedLanguage;
  sizeBytes: number;
}

export interface DiscoveryLimits {
  include?: string[];
  exclude?: string[];
  maxFilesDiscovered?: number;
  maxFileBytes?: number;
}

const SKIP_SEGMENTS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".astrograph",
  ".codeintel",
  "coverage",
  "dist",
  "node_modules",
]);

export function snapshotHash(entries: SnapshotEntry[]): string {
  return hashString(
    entries
      .slice()
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((entry) => `${entry.path}:${entry.contentHash}`)
      .join("\n"),
    "directory_snapshot",
  );
}

export function isGitIgnored(repoRoot: string, filePath: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "--quiet", filePath], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch (error) {
    return (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: unknown }).status === 0
    );
  }
}

export function resolveGitIgnoredPaths(
  repoRoot: string,
  filePaths: string[],
): Set<string> {
  if (filePaths.length === 0) {
    return new Set();
  }

  const input = Buffer.from(
    `${filePaths.join("\u0000")}\u0000`,
    "utf8",
  );
  const result = spawnSync(
    "git",
    ["check-ignore", "--stdin", "-z", "-v", "-n"],
    {
      cwd: repoRoot,
      input,
      encoding: "buffer",
      stdio: ["pipe", "pipe", "ignore"],
    },
  );

  if (result.status !== 0) {
    return new Set(filePaths.filter((filePath) => isGitIgnored(repoRoot, filePath)));
  }

  const fields = result.stdout.toString("utf8").split("\u0000");
  const ignoredPaths = new Set<string>();

  for (let index = 0; index + 3 < fields.length; index += 4) {
    const source = fields[index];
    const line = fields[index + 1];
    const pattern = fields[index + 2];
    const filePath = fields[index + 3];
    if (!filePath) {
      continue;
    }
    if (source || line || pattern) {
      ignoredPaths.add(filePath);
    }
  }

  return ignoredPaths;
}

export async function scanSupportedFileCandidates(
  rootDir: string,
  currentDir = rootDir,
): Promise<SupportedFileCandidate[]> {
  const results = await discoverSourceFiles({
    repoRoot: rootDir,
    startRelativePath: path.relative(rootDir, currentDir),
    respectGitIgnore: false,
  });
  return results.map(({ absolutePath, relativePath }) => ({
    absolutePath,
    relativePath,
  }));
}

export async function discoverSourceFiles(options: {
  repoRoot: string;
  startRelativePath?: string;
  respectGitIgnore?: boolean;
  include?: string[];
  exclude?: string[];
  maxFilesDiscovered?: number;
  maxFileBytes?: number;
}): Promise<DiscoveredSourceFile[]> {
  const startRelativePath = options.startRelativePath ?? "";
  const startDir = startRelativePath
    ? path.join(options.repoRoot, startRelativePath)
    : options.repoRoot;
  const pathMatcher = createPathMatcher({
    include: options.include,
    exclude: options.exclude,
  });

  const crawledPaths = await new fdir()
    .withFullPaths()
    .exclude((dirName) => SKIP_SEGMENTS.has(dirName))
    .crawl(startDir)
    .withPromise();

  const discoveredFiles = await Promise.all(
    crawledPaths.map(async (absolutePath) => {
      const relativePath = path.relative(options.repoRoot, absolutePath);
      if (relativePath.startsWith(`..${path.sep}`) || relativePath === "..") {
        return null;
      }

      const language = supportedLanguageForFile(relativePath);
      if (!language) {
        return null;
      }
      if (!pathMatcher.matches(relativePath)) {
        return null;
      }

      const fileStat = await stat(absolutePath).catch(() => null);
      if (!fileStat?.isFile()) {
        return null;
      }

      return {
        absolutePath,
        relativePath,
        language,
        sizeBytes: fileStat.size,
      };
    }),
  );

  const filteredDiscoveredFiles: DiscoveredSourceFile[] = discoveredFiles.filter(
    (entry): entry is DiscoveredSourceFile => entry !== null,
  );
  const respectGitIgnore = options.respectGitIgnore ?? true;
  const maxFilesDiscovered = options.maxFilesDiscovered ?? Infinity;
  const maxFileBytes = options.maxFileBytes ?? Infinity;
  const ignoredPaths = respectGitIgnore
    ? resolveGitIgnoredPaths(
        options.repoRoot,
        filteredDiscoveredFiles.map((entry) => entry.relativePath),
      )
    : new Set<string>();

  const limitedDiscoveredFiles = filteredDiscoveredFiles
    .filter((entry) => entry.sizeBytes <= maxFileBytes)
    .filter((entry) => !ignoredPaths.has(entry.relativePath))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  if (limitedDiscoveredFiles.length > maxFilesDiscovered) {
    throw new Error(
      `Discovered ${limitedDiscoveredFiles.length} supported files, exceeding maxFilesDiscovered=${maxFilesDiscovered}`,
    );
  }

  return limitedDiscoveredFiles;
}

export async function loadFilesystemSnapshot(
  repoRoot: string,
  limits: DiscoveryLimits = {},
): Promise<SnapshotEntry[]> {
  const files = await listSupportedFiles(repoRoot, repoRoot, limits);
  const entries: SnapshotEntry[] = [];

  for (const filePath of files) {
    const content = await readFile(path.join(repoRoot, filePath), "utf8");
    entries.push({
      path: filePath,
      contentHash: hashString(content, "content_fingerprint"),
    });
  }

  return entries;
}

export async function scanDirectoryStateSnapshot(
  rootDir: string,
  currentDir = rootDir,
): Promise<DirectoryStateEntry[]> {
  const currentStat = await stat(currentDir);
  const results: DirectoryStateEntry[] = [
    {
      path: path.relative(rootDir, currentDir),
      mtimeMs: currentStat.mtimeMs,
    },
  ];
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isDirectory() || SKIP_SEGMENTS.has(entry.name)) {
      continue;
    }

    results.push(
      ...(await scanDirectoryStateSnapshot(rootDir, path.join(currentDir, entry.name))),
    );
  }

  return results.sort((left, right) => left.path.localeCompare(right.path));
}

export async function loadKnownDirectoryStateSnapshot(
  rootDir: string,
  knownPaths: string[],
): Promise<DirectoryStateEntry[]> {
  const results: DirectoryStateEntry[] = [];

  for (const knownPath of knownPaths) {
    const absolutePath = knownPath ? path.join(rootDir, knownPath) : rootDir;
    const directoryStat = await stat(absolutePath)
      .then((entry) => (entry.isDirectory() ? entry : null))
      .catch(() => null);
    if (!directoryStat) {
      continue;
    }

    results.push({
      path: knownPath,
      mtimeMs: directoryStat.mtimeMs,
    });
  }

  return results.sort((left, right) => left.path.localeCompare(right.path));
}

export async function loadSupportedFileStatesForSubtree(
  rootDir: string,
  startRelativePath = "",
  limits: DiscoveryLimits = {},
): Promise<FilesystemStateEntry[]> {
  const config = createDefaultEngineConfig({
    repoRoot: rootDir,
    indexInclude: limits.include,
    indexExclude: limits.exclude,
    maxFilesDiscovered: limits.maxFilesDiscovered,
    maxFileBytes: limits.maxFileBytes,
  });
  const discoveredFiles = await discoverSourceFiles({
    repoRoot: rootDir,
    startRelativePath,
    respectGitIgnore: config.respectGitIgnore,
    include: config.indexInclude,
    exclude: config.indexExclude,
    maxFilesDiscovered: config.maxFilesDiscovered,
    maxFileBytes: config.maxFileBytes,
  });
  const results: FilesystemStateEntry[] = [];

  for (const discoveredFile of discoveredFiles) {
    const fileStat = await stat(discoveredFile.absolutePath);
    results.push({
      path: discoveredFile.relativePath,
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
    });
  }

  return results.sort((left, right) => left.path.localeCompare(right.path));
}

export async function loadFilesystemStateSnapshot(
  rootDir: string,
  limits: DiscoveryLimits = {},
): Promise<FilesystemStateEntry[]> {
  return loadSupportedFileStatesForSubtree(rootDir, "", limits);
}

export function compareDirectoryStates(
  previousEntries: DirectoryStateEntry[],
  currentEntries: DirectoryStateEntry[],
) {
  const previousMap = new Map(previousEntries.map((entry) => [entry.path, entry]));
  const currentMap = new Map(currentEntries.map((entry) => [entry.path, entry]));
  const missingDirectories = previousEntries.filter((entry) => !currentMap.has(entry.path));
  const changedDirectories = currentEntries.filter((entry) => {
    const previousEntry = previousMap.get(entry.path);
    return Boolean(previousEntry && previousEntry.mtimeMs !== entry.mtimeMs);
  });

  return {
    missingPaths: missingDirectories.map((entry) => entry.path),
    changedPaths: changedDirectories.map((entry) => entry.path),
  };
}

export function parentDirectoryPath(fileOrDirectoryPath: string): string {
  const parent = path.dirname(fileOrDirectoryPath);
  return parent === "." ? "" : parent;
}

export function compactDirectoryRescanPaths(paths: string[]): string[] {
  return [...new Set(paths)]
    .sort((left, right) => left.length - right.length || left.localeCompare(right))
    .filter((candidate, index, allPaths) =>
      !allPaths.slice(0, index).some((parent) =>
        candidate !== parent &&
        candidate.startsWith(parent === "" ? "" : `${parent}${path.sep}`),
      )
    );
}

export async function listSupportedFiles(
  rootDir: string,
  currentDir = rootDir,
  limits: DiscoveryLimits = {},
): Promise<string[]> {
  const config = createDefaultEngineConfig({
    repoRoot: rootDir,
    indexInclude: limits.include,
    indexExclude: limits.exclude,
    maxFilesDiscovered: limits.maxFilesDiscovered,
    maxFileBytes: limits.maxFileBytes,
  });
  const discoveredFiles = await discoverSourceFiles({
    repoRoot: rootDir,
    startRelativePath: path.relative(rootDir, currentDir),
    respectGitIgnore: config.respectGitIgnore,
    include: config.indexInclude,
    exclude: config.indexExclude,
    maxFilesDiscovered: config.maxFilesDiscovered,
    maxFileBytes: config.maxFileBytes,
  });
  return discoveredFiles.map((entry) => entry.relativePath);
}
