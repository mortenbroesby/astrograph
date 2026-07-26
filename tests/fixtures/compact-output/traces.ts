import type { CompactOutputFixture } from "./build-fixtures.ts";
import type { CompactOutputQueryCase } from "./queries.ts";

export type CompactOutputTraceOperationClass = "one-shot-exploration" | "repeat-read";

export interface CompactOutputTraceCase {
  id: string;
  operationClass: CompactOutputTraceOperationClass;
  queryIds: string[];
}

export function createCompactOutputTraceCases(
  fixture: CompactOutputFixture,
  queries: CompactOutputQueryCase[],
): CompactOutputTraceCase[] {
  const queryIds = new Set(queries.map((query) => query.id));
  const id = (suffix: string) => `${fixture.name}:${suffix}`;
  const required = ["find-files", "search-symbols", "file-outline", "task-context"];
  for (const suffix of required) {
    if (!queryIds.has(id(suffix))) throw new Error(`Missing compact-output trace query: ${id(suffix)}`);
  }

  return [
    {
      id: id("one-shot-exploration"),
      operationClass: "one-shot-exploration",
      queryIds: [id("find-files"), id("search-symbols"), id("file-outline"), id("task-context")],
    },
    {
      id: id("repeat-symbol-context"),
      operationClass: "repeat-read",
      queryIds: [id("search-symbols"), id("task-context"), id("search-symbols"), id("task-context")],
    },
  ];
}
