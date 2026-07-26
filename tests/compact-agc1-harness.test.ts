import { afterEach, describe, expect, it } from "vitest";

import { decodeCompactMcpEnvelope, formatMcpEnvelope } from "../src/compact-mcp.ts";
import { dispatchTool } from "../src/mcp.ts";
import type { McpEnvelope } from "../src/mcp-contract.ts";
import { countTokens } from "../src/tokenizer.ts";
import { cleanupCompactOutputFixtures, createCompactOutputFixture, type CompactOutputFixtureName } from "./fixtures/compact-output/build-fixtures.ts";
import { normalizeCompactOutputEnvelope } from "./fixtures/compact-output/normalize.ts";
import { createCompactOutputQueryCases } from "./fixtures/compact-output/queries.ts";

const tree: McpEnvelope<unknown> = { ok: true, data: [{ path: "src/a.ts", language: "ts", symbolCount: 1 }], meta: { toolVersion: "1", tokenBudgetUsed: 1, dataFreshness: "fresh" } };
const fixtureNames: CompactOutputFixtureName[] = ["small-frontend", "product-monorepo", "text-heavy-workspace", "dead-code-workspace"];
afterEach(cleanupCompactOutputFixtures);

describe("AGC1 compact-output harness", () => {
  it("measures and losslessly decodes the real serving serializer", () => {
    const formatted = formatMcpEnvelope("get_file_tree", "compact", tree);
    expect(formatted.metrics.selectedFormat).toBe("compact");
    expect(formatted.metrics.tokens).toBe(countTokens(formatted.serialized));
    expect(decodeCompactMcpEnvelope(JSON.parse(formatted.serialized))).toEqual(tree);
  });

  it("keeps every eligible serving capture lossless across the fixture corpus", async () => {
    for (const name of fixtureNames) {
      const fixture = await createCompactOutputFixture(name);
      expect((await dispatchTool("index_folder", { repoRoot: fixture.repoRoot })).ok).toBe(true);
      for (const query of createCompactOutputQueryCases(fixture)) {
        const envelope = normalizeCompactOutputEnvelope(query.toolName, await dispatchTool(query.toolName, query.args), fixture.repoRoot) as McpEnvelope<unknown>;
        const formatted = formatMcpEnvelope(query.toolName, "compact", envelope);
        if (formatted.metrics.selectedFormat !== "compact") continue;
        expect(decodeCompactMcpEnvelope(JSON.parse(formatted.serialized)), query.id).toEqual(envelope);
        expect(formatted.metrics.tokens, query.id).toBe(countTokens(formatted.serialized));
      }
    }
  }, 120_000);
});
