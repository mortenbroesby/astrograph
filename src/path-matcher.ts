import path from "node:path";

import picomatch from "picomatch";

export interface PathMatcherConfig {
  include?: string[];
  exclude?: string[];
}

export interface PathMatcher {
  matches(relativePath: string): boolean;
}

export function normalizeRepoRelativePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "");
}

export function resolveRepoRelativePath(repoRoot: string, filePath: string) {
  if (!filePath || filePath.trim().length === 0) {
    throw new Error("File path is required");
  }

  const normalizedPath = path.normalize(filePath.replaceAll("\\", path.sep));
  if (
    path.isAbsolute(filePath)
    || normalizedPath === ".."
    || normalizedPath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`File path escapes repository root: ${filePath}`);
  }

  const absolutePath = path.resolve(repoRoot, normalizedPath);
  const relativePath = normalizeRepoRelativePath(path.relative(repoRoot, absolutePath));
  if (
    relativePath === ".."
    || relativePath.startsWith("../")
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`File path escapes repository root: ${filePath}`);
  }

  return { absolutePath, relativePath };
}

function normalizePathForMatch(value: string): string {
  return normalizeRepoRelativePath(value);
}

function normalizePatterns(patterns?: string[]): string[] {
  return (patterns ?? [])
    .map((pattern) => normalizePathForMatch(pattern.trim()))
    .filter((pattern) => pattern.length > 0);
}

export function createPathMatcher(config: PathMatcherConfig): PathMatcher {
  const includePatterns = normalizePatterns(config.include);
  const excludePatterns = normalizePatterns(config.exclude);
  const includeMatcher =
    includePatterns.length > 0
      ? picomatch(includePatterns, { dot: true })
      : null;
  const excludeMatcher =
    excludePatterns.length > 0
      ? picomatch(excludePatterns, { dot: true })
      : null;

  return {
    matches(relativePath: string): boolean {
      const normalizedPath = normalizePathForMatch(relativePath);
      if (excludeMatcher?.(normalizedPath)) {
        return false;
      }
      if (!includeMatcher) {
        return true;
      }
      return includeMatcher(normalizedPath);
    },
  };
}
