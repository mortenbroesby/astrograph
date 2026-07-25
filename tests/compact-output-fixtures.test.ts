import { afterEach, describe, expect, it } from "vitest";

import { dispatchTool } from "../src/mcp.ts";
import {
  cleanupCompactOutputFixtures,
  createCompactOutputFixture,
  type CompactOutputFixtureName,
} from "./fixtures/compact-output/build-fixtures.ts";
import { createCompactOutputQueryCases } from "./fixtures/compact-output/queries.ts";
import { normalizeCompactOutputEnvelope } from "./fixtures/compact-output/normalize.ts";

const fixtureNames: CompactOutputFixtureName[] = [
  "small-frontend",
  "product-monorepo",
  "text-heavy-workspace",
  "dead-code-workspace",
];

afterEach(cleanupCompactOutputFixtures);

describe("compact output research fixtures", () => {
  for (const name of fixtureNames) {
    it(`indexes and stably queries ${name}`, async () => {
      const fixture = await createCompactOutputFixture(name);
      const indexed = await dispatchTool("index_folder", { repoRoot: fixture.repoRoot });
      expect(indexed.ok).toBe(true);

      const queryCases = createCompactOutputQueryCases(fixture);
      expect(new Set(queryCases.map((queryCase) => queryCase.category))).toEqual(new Set([
        "small", "medium", "broad", "empty", "error", "unicode", "truncated", "mixed-type",
      ]));
      for (const queryCase of queryCases) {
        const first = await dispatchTool(queryCase.toolName, queryCase.args);
        const second = await dispatchTool(queryCase.toolName, queryCase.args);
        expect(first.ok, `${queryCase.id} should match its expected result`).toBe(queryCase.expectsOk);
        expect(normalizeCompactOutputEnvelope(queryCase.toolName, second, fixture.repoRoot), queryCase.id).toEqual(
          normalizeCompactOutputEnvelope(queryCase.toolName, first, fixture.repoRoot),
        );
      }
    }, 60_000);
  }
});
