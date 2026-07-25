import { afterEach, describe, expect, it } from "vitest";

import { dispatchTool } from "../src/mcp.ts";
import {
  cleanupCompactOutputFixtures,
  createCompactOutputFixture,
  type CompactOutputFixtureName,
} from "./fixtures/compact-output/build-fixtures.ts";

const fixtureNames: CompactOutputFixtureName[] = [
  "small-frontend",
  "product-monorepo",
  "text-heavy-workspace",
  "dead-code-workspace",
];

function normalizeFixtureValue(value: unknown, repoRoot: string): unknown {
  if (typeof value === "string") return value.split(repoRoot).join("/fixture");
  if (Array.isArray(value)) return value.map((item) => normalizeFixtureValue(item, repoRoot));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeFixtureValue(item, repoRoot)]));
  }
  return value;
}

function normalizeFixtureEnvelope(toolName: string, value: unknown, repoRoot: string): unknown {
  const normalized = normalizeFixtureValue(value, repoRoot);
  if (
    toolName === "search_text"
    && normalized
    && typeof normalized === "object"
    && "data" in normalized
    && Array.isArray(normalized.data)
  ) {
    return {
      ...normalized,
      data: [...normalized.data].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    };
  }
  return normalized;
}

afterEach(cleanupCompactOutputFixtures);

describe("compact output research fixtures", () => {
  for (const name of fixtureNames) {
    it(`indexes and stably queries ${name}`, async () => {
      const fixture = await createCompactOutputFixture(name);
      const indexed = await dispatchTool("index_folder", { repoRoot: fixture.repoRoot });
      expect(indexed.ok).toBe(true);

      const calls: Array<[string, Record<string, unknown>]> = [
        ["find_files", { repoRoot: fixture.repoRoot, query: "src" }],
        ["search_text", { repoRoot: fixture.repoRoot, query: fixture.textQuery, limit: 50 }],
        ["search_symbols", { repoRoot: fixture.repoRoot, query: fixture.symbolQuery, limit: 50 }],
        ["get_file_tree", { repoRoot: fixture.repoRoot }],
        ["get_file_outline", { repoRoot: fixture.repoRoot, filePath: fixture.outlinePath }],
      ];
      for (const [toolName, args] of calls) {
        const first = await dispatchTool(toolName, args);
        const second = await dispatchTool(toolName, args);
        expect(first.ok, `${name} ${toolName} should succeed`).toBe(true);
        expect(JSON.stringify(normalizeFixtureEnvelope(toolName, second, fixture.repoRoot))).toBe(
          JSON.stringify(normalizeFixtureEnvelope(toolName, first, fixture.repoRoot)),
        );
      }
    }, 60_000);
  }
});
