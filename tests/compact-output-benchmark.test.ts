import { describe, expect, it } from "vitest";

import {
  measureCompactCandidate,
  measureFrozenAgc1Reference,
  type CompactCandidateCodec,
} from "../src/compact-mcp-candidates.ts";
import {
  decodeCompactMcpEnvelope,
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
  decode: decodeCompactMcpEnvelope,
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
