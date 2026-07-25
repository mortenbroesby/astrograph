import { afterEach, describe, expect, it } from "vitest";

import { dispatchTool } from "../src/mcp.ts";
import { countTokens } from "../src/tokenizer.ts";
import {
  cleanupCompactOutputFixtures,
  createCompactOutputFixture,
  type CompactOutputFixtureName,
} from "./fixtures/compact-output/build-fixtures.ts";
import { createCompactOutputQueryCases } from "./fixtures/compact-output/queries.ts";

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
  let normalized = normalizeFixtureValue(value, repoRoot);
  if (
    toolName === "search_text"
    && normalized
    && typeof normalized === "object"
    && "data" in normalized
    && Array.isArray(normalized.data)
  ) {
    normalized = {
      ...normalized,
      data: [...normalized.data].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    };
  }
  if (normalized && typeof normalized === "object" && "data" in normalized && "meta" in normalized) {
    const envelope = normalized as { data: unknown; meta: Record<string, unknown> };
    return {
      ...envelope,
      // MCP telemetry samples token estimates periodically. The corpus uses an
      // exact deterministic value instead of benchmarking that sampling cadence.
      meta: { ...envelope.meta, tokenBudgetUsed: countTokens(JSON.stringify(envelope.data)) },
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

      const queryCases = createCompactOutputQueryCases(fixture);
      expect(new Set(queryCases.map((queryCase) => queryCase.category))).toEqual(new Set([
        "small", "medium", "broad", "empty", "error", "unicode", "truncated", "mixed-type",
      ]));
      for (const queryCase of queryCases) {
        const first = await dispatchTool(queryCase.toolName, queryCase.args);
        const second = await dispatchTool(queryCase.toolName, queryCase.args);
        expect(first.ok, `${queryCase.id} should match its expected result`).toBe(queryCase.expectsOk);
        expect(normalizeFixtureEnvelope(queryCase.toolName, second, fixture.repoRoot), queryCase.id).toEqual(
          normalizeFixtureEnvelope(queryCase.toolName, first, fixture.repoRoot),
        );
      }
    }, 60_000);
  }
});
