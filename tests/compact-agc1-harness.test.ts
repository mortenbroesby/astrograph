import { describe, expect, it } from "vitest";

import { decodeCompactMcpEnvelope, formatMcpEnvelope } from "../src/compact-mcp.ts";
import type { McpEnvelope } from "../src/mcp-contract.ts";
import { countTokens } from "../src/tokenizer.ts";

const tree: McpEnvelope<unknown> = { ok: true, data: [{ path: "src/a.ts", language: "ts", symbolCount: 1 }], meta: { toolVersion: "1", tokenBudgetUsed: 1, dataFreshness: "fresh" } };

describe("AGC1 compact-output harness", () => {
  it("measures and losslessly decodes the real serving serializer", () => {
    const formatted = formatMcpEnvelope("get_file_tree", "compact", tree);
    expect(formatted.metrics.selectedFormat).toBe("compact");
    expect(formatted.metrics.tokens).toBe(countTokens(formatted.serialized));
    expect(decodeCompactMcpEnvelope(JSON.parse(formatted.serialized))).toEqual(tree);
  });
});
