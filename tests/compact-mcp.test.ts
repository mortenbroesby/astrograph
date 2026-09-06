import { describe, expect, it } from "vitest";

import {
  decodeCompactMcpEnvelope,
  formatMcpEnvelope,
} from "../src/compact-mcp.ts";
import type { McpEnvelope } from "../src/mcp-contract.ts";

function searchEnvelope(items: Array<Record<string, unknown>>): McpEnvelope<unknown> {
  return {
    ok: true,
    data: {
      items,
      truncated: false,
      refinementHints: [],
      tokenSavings: {
        unit: "tokens",
        tokenizer: "cl100k_base",
        baseline: "all_ranked_symbol_items",
        baselineTokens: 1,
        returnedTokens: 1,
        savedTokens: 0,
        savedPercent: 0,
      },
    },
    meta: { toolVersion: "1", tokenBudgetUsed: 1, dataFreshness: "fresh" },
  };
}

function sourceEnvelope(items: Array<Record<string, unknown>>): McpEnvelope<unknown> {
  const first = items[0];
  return {
    ok: true,
    data: {
      requestedContextLines: 0,
      items,
      ...(first ? {
        symbol: first.symbol,
        source: first.source,
        verified: first.verified,
        startLine: first.startLine,
        endLine: first.endLine,
      } : {}),
    },
    meta: { toolVersion: "1", tokenBudgetUsed: null, dataFreshness: "fresh" },
  };
}

const unicodeSymbol = {
  id: "sym-π",
  name: "area✨",
  qualifiedName: null,
  kind: "function",
  filePath: "src/数学.ts",
  signature: "function area✨(radius: number): string",
  summary: "Returns an area label for café users.",
  summarySource: "doc-comment",
  startLine: 1,
  endLine: 3,
  startByte: 0,
  endByte: 99,
  exported: true,
};

const unicodeSourceItem = {
  symbol: unicodeSymbol,
  source: "export function area✨(radius: number) { return `π=${radius ** 2}`; }",
  verified: true,
  startLine: 1,
  endLine: 3,
  provenance: {
    filePath: "src/数学.ts",
    sourceHash: "hash-π",
    range: {
      encoding: "utf8",
      startByte: 0,
      endByte: 78,
      startLine: 1,
      endLine: 3,
    },
    parser: { backend: "tree-sitter", fallbackUsed: false, fallbackReason: null },
    freshness: "indexed-snapshot",
  },
};

describe("compact MCP output", () => {
  it("keeps JSON as the exact default envelope", () => {
    const envelope = searchEnvelope([unicodeSymbol]);
    const formatted = formatMcpEnvelope("search_symbols", undefined, envelope);

    expect(formatted.metrics.selectedFormat).toBe("json");
    expect(JSON.parse(formatted.serialized)).toEqual(envelope);
    expect(formatted.serialized).not.toContain("\n");
  });

  it("keeps exact-source JSON as the exact default envelope", () => {
    const envelope = sourceEnvelope([unicodeSourceItem]);
    const formatted = formatMcpEnvelope("get_symbol_source", undefined, envelope);

    expect(formatted.metrics.selectedFormat).toBe("json");
    expect(JSON.parse(formatted.serialized)).toEqual(envelope);
  });

  it("losslessly round-trips selected Unicode and empty search results", () => {
    for (const envelope of [searchEnvelope([unicodeSymbol]), searchEnvelope([])]) {
      const formatted = formatMcpEnvelope("search_symbols", "compact", envelope);

      expect(formatted.metrics.selectedFormat).toBe("compact");
      expect(formatted.metrics.savedTokens).toBeGreaterThan(0);
      expect(decodeCompactMcpEnvelope(JSON.parse(formatted.serialized))).toEqual(envelope);
    }
  });

  it("losslessly round-trips single, batched, and empty exact-source results", () => {
    const second = {
      ...unicodeSourceItem,
      symbol: { ...unicodeSymbol, id: "sym-二", name: "double✨" },
      source: "export const double✨ = (value: number) => value * 2;",
    };
    for (const envelope of [
      sourceEnvelope([unicodeSourceItem]),
      sourceEnvelope([unicodeSourceItem, second]),
      sourceEnvelope([]),
    ]) {
      const formatted = formatMcpEnvelope("get_symbol_source", "compact", envelope);

      expect(formatted.metrics.selectedFormat).toBe("compact");
      expect(decodeCompactMcpEnvelope(JSON.parse(formatted.serialized))).toEqual(envelope);
    }
  });

  it("applies the existing auto thresholds to exact-source output", () => {
    const small = formatMcpEnvelope("get_symbol_source", "auto", sourceEnvelope([]));
    const largeItem = { ...unicodeSourceItem, source: unicodeSourceItem.source.repeat(20) };
    const large = formatMcpEnvelope("get_symbol_source", "auto", sourceEnvelope([largeItem]));

    expect(small.metrics.selectedFormat).toBe("json");
    expect(large.metrics.selectedFormat).toBe("compact");
  });

  it("uses JSON for errors and unsupported auto requests", () => {
    const error: McpEnvelope<unknown> = {
      ok: false,
      data: null,
      error: { code: "invalid_argument", message: "Missing required argument: query" },
      meta: { toolVersion: "1", tokenBudgetUsed: null, dataFreshness: "unknown" },
    };
    const formattedError = formatMcpEnvelope("search_symbols", "compact", error);
    const unselectedTool: McpEnvelope<unknown> = {
      ok: true,
      data: { files: [] },
      meta: { toolVersion: "1", tokenBudgetUsed: 0, dataFreshness: "fresh" },
    };
    const formattedAuto = formatMcpEnvelope("get_repo_outline", "auto", unselectedTool);

    expect(formattedError.metrics.selectedFormat).toBe("json");
    expect(JSON.parse(formattedError.serialized)).toEqual(error);
    expect(formattedAuto.metrics.selectedFormat).toBe("json");
    expect(JSON.parse(formattedAuto.serialized)).toEqual(unselectedTool);
  });

  it("keeps nested task-context provenance on the ordinary JSON fallback", () => {
    const context: McpEnvelope<unknown> = {
      ok: true,
      data: {
        items: [{
          symbol: unicodeSymbol,
          source: "export const π = 3.14;",
          provenance: { range: { encoding: "utf8", startByte: 0, endByte: 24 } },
        }],
      },
      meta: { toolVersion: "1", tokenBudgetUsed: 12, dataFreshness: "fresh" },
    };
    const formatted = formatMcpEnvelope("get_task_context", "compact", context);

    expect(formatted.metrics.selectedFormat).toBe("json");
    expect(JSON.parse(formatted.serialized)).toEqual(context);
  });

  it("rejects unknown compact versions and malformed rows", () => {
    expect(() => decodeCompactMcpEnvelope(["agc2"])).toThrow("version");
    expect(() => decodeCompactMcpEnvelope([
      "agc1",
      "get_file_tree",
      [["src/a.ts"]],
      ["1", 0, "fresh"],
    ])).toThrow("row");
    expect(() => decodeCompactMcpEnvelope([
      "agc1",
      "get_symbol_source",
      [0, [["incomplete"]]],
      ["1", null, "fresh"],
    ])).toThrow("row");
  });
});
