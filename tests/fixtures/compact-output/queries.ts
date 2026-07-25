import type { CompactOutputFixture } from "./build-fixtures.ts";

export type CompactOutputToolName =
  | "find_files"
  | "search_text"
  | "search_symbols"
  | "get_file_tree"
  | "get_file_outline";

export type CompactOutputQueryCategory =
  | "small"
  | "medium"
  | "broad"
  | "empty"
  | "error"
  | "unicode"
  | "truncated"
  | "mixed-type";

export interface CompactOutputQueryCase {
  id: string;
  category: CompactOutputQueryCategory;
  toolName: CompactOutputToolName;
  args: Record<string, unknown>;
  expectsOk: boolean;
}

export function createCompactOutputQueryCases(
  fixture: CompactOutputFixture,
): CompactOutputQueryCase[] {
  const repoRoot = fixture.repoRoot;
  return [
    { id: `${fixture.name}:small:find-files`, category: "small", toolName: "find_files", args: { repoRoot, query: "src" }, expectsOk: true },
    { id: `${fixture.name}:medium:search-text`, category: "medium", toolName: "search_text", args: { repoRoot, query: fixture.textQuery, limit: 50 }, expectsOk: true },
    { id: `${fixture.name}:broad:search-symbols`, category: "broad", toolName: "search_symbols", args: { repoRoot, query: fixture.symbolQuery, limit: 50 }, expectsOk: true },
    { id: `${fixture.name}:broad:file-tree`, category: "broad", toolName: "get_file_tree", args: { repoRoot }, expectsOk: true },
    { id: `${fixture.name}:small:file-outline`, category: "small", toolName: "get_file_outline", args: { repoRoot, filePath: fixture.outlinePath }, expectsOk: true },
    { id: `${fixture.name}:empty:search-symbols`, category: "empty", toolName: "search_symbols", args: { repoRoot, query: " " }, expectsOk: true },
    { id: `${fixture.name}:error:find-files`, category: "error", toolName: "find_files", args: { repoRoot, query: " " }, expectsOk: false },
    { id: `${fixture.name}:unicode:search-text`, category: "unicode", toolName: "search_text", args: { repoRoot, query: "café", limit: 50 }, expectsOk: true },
    { id: `${fixture.name}:truncated:search-text`, category: "truncated", toolName: "search_text", args: { repoRoot, query: fixture.textQuery, limit: 1 }, expectsOk: true },
    { id: `${fixture.name}:mixed-type:find-files`, category: "mixed-type", toolName: "find_files", args: { repoRoot, query: "src", limit: 50 }, expectsOk: true },
  ];
}
