import { afterEach, describe, expect, it } from "vitest";

import { dispatchTool } from "../src/mcp.ts";
import { cleanupCompactOutputFixtures, createCompactOutputFixture, type CompactOutputFixtureName } from "./fixtures/compact-output/build-fixtures.ts";
import { normalizeCompactOutputEnvelope } from "./fixtures/compact-output/normalize.ts";
import { createCompactOutputQueryCases } from "./fixtures/compact-output/queries.ts";

const fixtureNames: CompactOutputFixtureName[] = ["small-frontend", "product-monorepo", "text-heavy-workspace", "dead-code-workspace"];
afterEach(cleanupCompactOutputFixtures);

describe("compact-output fixtures", () => {
  for (const name of fixtureNames) {
    it(`indexes and returns stable normalized ${name} captures`, async () => {
      const fixture = await createCompactOutputFixture(name);
      expect((await dispatchTool("index_folder", { repoRoot: fixture.repoRoot })).ok).toBe(true);
      for (const query of createCompactOutputQueryCases(fixture)) {
        const first = await dispatchTool(query.toolName, query.args);
        const second = await dispatchTool(query.toolName, query.args);
        expect(first.ok, query.id).toBe(query.expectsOk);
        expect(normalizeCompactOutputEnvelope(query.toolName, second, fixture.repoRoot)).toEqual(normalizeCompactOutputEnvelope(query.toolName, first, fixture.repoRoot));
      }
    }, 60_000);
  }
});
