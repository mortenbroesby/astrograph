import type { CompactOutputFixture } from "./build-fixtures.ts";

export type CompactOutputToolName = "find_files" | "search_text" | "search_symbols" | "get_file_tree" | "get_file_outline";
export interface CompactOutputQueryCase { id: string; toolName: CompactOutputToolName; args: Record<string, unknown>; expectsOk: boolean; }
export function createCompactOutputQueryCases(fixture: CompactOutputFixture): CompactOutputQueryCase[] {
  const repoRoot = fixture.repoRoot;
  return [
    { id: `${fixture.name}:find-files`, toolName: "find_files", args: { repoRoot, query: "src" }, expectsOk: true },
    { id: `${fixture.name}:search-text`, toolName: "search_text", args: { repoRoot, query: fixture.textQuery, limit: 50 }, expectsOk: true },
    { id: `${fixture.name}:search-symbols`, toolName: "search_symbols", args: { repoRoot, query: fixture.symbolQuery, limit: 50 }, expectsOk: true },
    { id: `${fixture.name}:file-tree`, toolName: "get_file_tree", args: { repoRoot }, expectsOk: true },
    { id: `${fixture.name}:file-outline`, toolName: "get_file_outline", args: { repoRoot, filePath: fixture.outlinePath }, expectsOk: true },
    { id: `${fixture.name}:empty-symbols`, toolName: "search_symbols", args: { repoRoot, query: " " }, expectsOk: true },
    { id: `${fixture.name}:error-files`, toolName: "find_files", args: { repoRoot, query: " " }, expectsOk: false },
  ];
}
