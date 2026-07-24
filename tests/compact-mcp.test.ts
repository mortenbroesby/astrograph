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

describe("compact MCP output", () => {
  it("keeps JSON as the exact default envelope", () => {
    const envelope = searchEnvelope([unicodeSymbol]);
    const formatted = formatMcpEnvelope("search_symbols", undefined, envelope);

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

  it("emits agc2 for every former agc1 tool", () => {
    const envelopes: Array<["search_symbols" | "get_file_tree" | "get_file_outline", McpEnvelope<unknown>]> = [
      ["search_symbols", searchEnvelope([unicodeSymbol])],
      ["get_file_tree", {
        ok: true,
        data: [{ path: "src/math.ts", language: "ts", symbolCount: 1 }],
        meta: { toolVersion: "1", tokenBudgetUsed: 1, dataFreshness: "fresh" },
      }],
      ["get_file_outline", {
        ok: true,
        data: { filePath: "src/math.ts", symbols: [unicodeSymbol] },
        meta: { toolVersion: "1", tokenBudgetUsed: 1, dataFreshness: "fresh" },
      }],
    ];

    for (const [toolName, envelope] of envelopes) {
      const formatted = formatMcpEnvelope(toolName, "compact", envelope);
      expect(JSON.parse(formatted.serialized)[0]).toBe("agc2");
      expect(decodeCompactMcpEnvelope(JSON.parse(formatted.serialized))).toEqual(envelope);
    }
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
    expect(() => decodeCompactMcpEnvelope(["agc1"])).toThrow("version");
    expect(() => decodeCompactMcpEnvelope([
      "agc2",
      "get_file_tree",
      [["src/a.ts"]],
      ["1", 0, "fresh"],
    ])).toThrow("row");
  });

  it("losslessly compacts discovery tables with dictionary-backed columns", () => {
    const envelope: McpEnvelope<unknown> = {
      ok: true,
      data: [
        {
          filePath: "src/math.ts",
          fileName: "math.ts",
          language: "ts",
          supportTier: "graph",
          indexed: true,
          matchReason: "path",
        },
        {
          filePath: "src/strings.ts",
          fileName: "strings.ts",
          language: "ts",
          supportTier: "graph",
          indexed: true,
          matchReason: "path",
        },
      ],
      meta: { toolVersion: "1", tokenBudgetUsed: 81, dataFreshness: "fresh" },
    };
    const formatted = formatMcpEnvelope("find_files", "compact", envelope);

    expect(formatted.metrics.selectedFormat).toBe("compact");
    expect(JSON.parse(formatted.serialized)[0]).toBe("agc2");
    expect(decodeCompactMcpEnvelope(JSON.parse(formatted.serialized))).toEqual(envelope);
  });

  it("rejects malformed compact table dictionary indexes", () => {
    expect(() => decodeCompactMcpEnvelope([
      "agc2",
      "search_text",
      [["filePath", "line", "preview"], [["src/math.ts"]], [[2, 1, "export const PI = 3.14;"]]],
      ["1", 10, "fresh"],
    ])).toThrow("dictionary index");
  });
});
