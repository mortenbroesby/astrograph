import picomatch from "picomatch";

export interface PathMatcherConfig {
  include?: string[];
  exclude?: string[];
}

export interface PathMatcher {
  matches(relativePath: string): boolean;
}

function normalizePathForMatch(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "");
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
