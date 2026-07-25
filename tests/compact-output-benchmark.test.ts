import { describe, expect, it } from "vitest";

import {
  measureCompactCandidate,
  measureFrozenAgc1Reference,
  prefixLegendAgc2Codec,
  genericRowsAgc2Codec,
  typedRowsAgc2Codec,
  schemaRowsAgc2Codec,
  type CompactCandidateCodec,
} from "../src/compact-mcp-candidates.ts";
import {
  decodePackedRowsAgc2,
  encodePackedRowsAgc2,
} from "../src/compact-mcp.ts";
import type { McpEnvelope } from "../src/mcp-contract.ts";

const treeEnvelope: McpEnvelope<unknown> = {
  ok: true,
  data: [
    { path: "src/app.ts", language: "ts", symbolCount: 3 },
    { path: "src/components/Button.tsx", language: "tsx", symbolCount: 2 },
  ],
  meta: { toolVersion: "1", tokenBudgetUsed: 5, dataFreshness: "fresh" },
};

const packedRowsCodec: CompactCandidateCodec = {
  id: "agc2-packed-rows-baseline",
  encode: encodePackedRowsAgc2,
  decode: decodePackedRowsAgc2,
};

const symbol = {
  id: "symbol-1", name: "area", qualifiedName: null, kind: "function",
  filePath: "src/math.ts", signature: "function area()", summary: "Calculates area.",
  summarySource: "doc-comment", startLine: 1, endLine: 2, startByte: 0,
  endByte: 42, exported: true,
};

describe("compact output benchmark candidates", () => {
  it("measures a lossless packed-rows candidate with exact token evidence", () => {
    const measurement = measureCompactCandidate(packedRowsCodec, "get_file_tree", treeEnvelope);

    expect(measurement.rejectionReason).toBeNull();
    expect(measurement.tokens).toBeGreaterThan(0);
    expect(measurement.bytes).toBeGreaterThan(0);
    expect(measurement.decodeMs).not.toBeNull();
    expect(measurement.decoded).toEqual(treeEnvelope);
  });

  it("keeps AGC1 as an encoder-only frozen reference", () => {
    const reference = measureFrozenAgc1Reference("get_file_tree", treeEnvelope);

    expect(reference.rejectionReason).toBe("reference_encoder_only");
    expect(reference.encoded).toContain("agc1");
    expect(reference.tokens).toBeGreaterThan(0);
    expect(reference.decoded).toBeNull();
  });

  it("rejects unknown schemas and producer row-width mismatches", () => {
    const measurement = measureCompactCandidate(schemaRowsAgc2Codec, "get_file_tree", treeEnvelope);
    expect(measurement.decoded).toEqual(treeEnvelope);
    expect(() => schemaRowsAgc2Codec.decode(["agc2s", "unknown/1", [], ["1", 0, "fresh"]])).toThrow("Unknown schema");
    expect(() => schemaRowsAgc2Codec.decode(["agc2s", "tree/3", [["src/a.ts", "ts"]], ["1", 0, "fresh"]])).toThrow("row width");
  });

  it("round-trips every schema-row producer shape", () => {
    const envelopes: Array<["search_symbols" | "get_file_outline" | "find_files" | "search_text", McpEnvelope<unknown>]> = [
      ["search_symbols", { ok: true, data: { items: [symbol], truncated: false, refinementHints: [], tokenSavings: { unit: "tokens", tokenizer: "cl100k_base", baseline: "all_ranked_symbol_items", baselineTokens: 20, returnedTokens: 10, savedTokens: 10, savedPercent: 50 } }, meta: { toolVersion: "1", tokenBudgetUsed: 10, dataFreshness: "fresh" } }],
      ["get_file_outline", { ok: true, data: { filePath: "src/math.ts", symbols: [symbol] }, meta: { toolVersion: "1", tokenBudgetUsed: 10, dataFreshness: "fresh" } }],
      ["find_files", { ok: true, data: [{ filePath: "src/math.ts", fileName: "math.ts", language: "ts", supportTier: "graph", indexed: true, matchReason: "path" }], meta: { toolVersion: "1", tokenBudgetUsed: 10, dataFreshness: "fresh" } }],
      ["search_text", { ok: true, data: [{ filePath: "src/math.ts", line: 1, preview: "export function area() {}" }], meta: { toolVersion: "1", tokenBudgetUsed: 10, dataFreshness: "fresh" } }],
    ];
    for (const [toolName, envelope] of envelopes) {
      expect(measureCompactCandidate(schemaRowsAgc2Codec, toolName, envelope).decoded).toEqual(envelope);
    }
  });

  it("uses a prefix legend only when it has enough repeated paths to repay it", () => {
    const repeatedTree: McpEnvelope<unknown> = {
      ...treeEnvelope,
      data: Array.from({ length: 12 }, (_, index) => ({ path: `src/features/feature-${index}.ts`, language: "ts", symbolCount: 1 })),
    };
    const compact = measureCompactCandidate(prefixLegendAgc2Codec, "get_file_tree", repeatedTree);
    expect(compact.rejectionReason).toBeNull();
    expect(compact.decoded).toEqual(repeatedTree);

    const onePath: McpEnvelope<unknown> = { ...treeEnvelope, data: [(treeEnvelope.data as Array<unknown>)[0]] };
    expect(measureCompactCandidate(prefixLegendAgc2Codec, "get_file_tree", onePath).rejectionReason).toBe("unsupported_shape");
  });

  it("round-trips typed scalars, including escaped delimiters and Unicode", () => {
    const typedEnvelope: McpEnvelope<unknown> = {
      ok: true,
      data: [{ filePath: "src/café\t✨.ts", line: 2, preview: "quoted \\\"text\\\"\nnext line" }],
      meta: { toolVersion: "1", tokenBudgetUsed: 1.5, dataFreshness: "fresh" },
    };
    expect(measureCompactCandidate(typedRowsAgc2Codec, "search_text", typedEnvelope).decoded).toEqual(typedEnvelope);
    expect(() => typedRowsAgc2Codec.decode(["agc2t", "text/3", ["xwat"], ["1", 1, "fresh"]])).toThrow("Invalid typed scalar");
  });

  it("uses generic rows only for homogeneous scalar lists and preserves unknown fields", () => {
    const genericEnvelope: McpEnvelope<unknown> = {
      ok: true,
      data: [
        { filePath: "src/a.ts", custom: "α", enabled: true, rank: 1, optional: null },
        { filePath: "src/b.ts", custom: "β", enabled: false, rank: 2, optional: null },
      ],
      meta: { toolVersion: "1", tokenBudgetUsed: 5, dataFreshness: "fresh" },
    };
    expect(measureCompactCandidate(genericRowsAgc2Codec, "find_files", genericEnvelope).decoded).toEqual(genericEnvelope);
    const heterogeneous: McpEnvelope<unknown> = { ...genericEnvelope, data: [{ filePath: "src/a.ts" }, { filePath: "src/b.ts", extra: true }] };
    expect(measureCompactCandidate(genericRowsAgc2Codec, "find_files", heterogeneous).rejectionReason).toBe("unsupported_shape");
  });

  it("rejects malformed headers, legends, rows, tags, and generic producer shapes", () => {
    const malformed: Array<() => unknown> = [
      () => schemaRowsAgc2Codec.decode(["agc2s", "missing/9", [], ["1", 0, "fresh"]]),
      () => prefixLegendAgc2Codec.decode(["agc2p", "tree/3", "src/", [["only-path"]], ["1", 0, "fresh"]]),
      () => typedRowsAgc2Codec.decode(["agc2t", "text/3", ["squoted \\\"value\\\"\tbad-tag\tsline\\nnext"], ["1", 0, "fresh"]]),
      () => genericRowsAgc2Codec.decode(["agc2g", "find_files", ["path"], [["src/a.ts", "unexpected"]], ["1", 0, "fresh"]]),
    ];
    for (const decode of malformed) expect(decode).toThrow();
  });

  it("reports the fixture, query, and codec for a reviewed regression", () => {
    const empty: McpEnvelope<unknown> = {
      ok: true,
      data: { items: [], truncated: false, refinementHints: [], tokenSavings: { unit: "tokens", tokenizer: "cl100k_base", baseline: "all_ranked_symbol_items", baselineTokens: 1, returnedTokens: 1, savedTokens: 0, savedPercent: 0 } },
      meta: { toolVersion: "1", tokenBudgetUsed: 1, dataFreshness: "fresh" },
    };
    const agc1 = measureFrozenAgc1Reference("search_symbols", empty);
    const packed = measureCompactCandidate(packedRowsCodec, "search_symbols", empty);
    const regression = packed.tokens !== null && agc1.tokens !== null && packed.tokens >= agc1.tokens
      ? "small-frontend:empty:search-symbols:agc2-packed-rows-baseline"
      : null;
    expect(regression).toBe("small-frontend:empty:search-symbols:agc2-packed-rows-baseline");
  });

  it("records explicit rejections instead of silently measuring unsupported shapes", () => {
    const error: McpEnvelope<unknown> = {
      ok: false,
      data: null,
      error: { code: "invalid_argument", message: "missing query" },
      meta: { toolVersion: "1", tokenBudgetUsed: null, dataFreshness: "unknown" },
    };
    const malformedCodec: CompactCandidateCodec = {
      id: "malformed",
      encode: () => ["bad"],
      decode: () => { throw new Error("invalid header"); },
    };

    expect(measureCompactCandidate(packedRowsCodec, "get_file_tree", error).rejectionReason).toBe("error_envelope");
    expect(measureCompactCandidate(malformedCodec, "get_file_tree", treeEnvelope).rejectionReason).toBe("decode_error:invalid header");
  });
});
