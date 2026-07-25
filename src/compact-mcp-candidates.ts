import { performance } from "node:perf_hooks";

import type { McpEnvelope, McpResponseEnvelope } from "./mcp-contract.ts";
import { BENCHMARK_TOKENIZER, countTokens } from "./tokenizer.ts";

const SYMBOL_FIELDS = [
  "id", "name", "qualifiedName", "kind", "filePath", "signature", "summary",
  "summarySource", "startLine", "endLine", "startByte", "endByte", "exported",
] as const;

export type CompactCandidateToolName =
  | "search_symbols"
  | "get_file_tree"
  | "get_file_outline"
  | "find_files"
  | "search_text";

export interface CompactCandidateCodec {
  id: string;
  encode: (toolName: CompactCandidateToolName, envelope: McpResponseEnvelope<unknown>) => unknown | null;
  decode: (encoded: unknown) => McpResponseEnvelope<unknown>;
}

export interface CompactCandidateMeasurement {
  candidateId: string;
  encoded: string | null;
  decoded: McpResponseEnvelope<unknown> | null;
  bytes: number | null;
  tokens: number | null;
  encodeMs: number;
  decodeMs: number | null;
  tokenizer: typeof BENCHMARK_TOKENIZER;
  rejectionReason: string | null;
}

function compactSymbol(symbol: Record<string, unknown>): unknown[] {
  return SYMBOL_FIELDS.map((field) => symbol[field] ?? null);
}

/** Frozen AGC1 reference encoder. It exists solely for corpus comparison. */
export function encodeFrozenAgc1Reference(
  toolName: CompactCandidateToolName,
  envelope: McpResponseEnvelope<unknown>,
): unknown[] | null {
  const data = envelope.data;
  if (!data || typeof data !== "object") return null;
  const meta = [envelope.meta.toolVersion, envelope.meta.tokenBudgetUsed, envelope.meta.dataFreshness];
  if (toolName === "search_symbols") {
    const result = data as Record<string, unknown>;
    if (!Array.isArray(result.items)) return null;
    return ["agc1", toolName, [result.items.map((item) => compactSymbol(item as Record<string, unknown>)), result.truncated, result.refinementHints, result.tokenSavings], meta];
  }
  if (toolName === "get_file_tree") {
    if (!Array.isArray(data)) return null;
    return ["agc1", toolName, data.map((item) => {
      const entry = item as Record<string, unknown>;
      return [entry.path, entry.language, entry.symbolCount];
    }), meta];
  }
  if (toolName !== "get_file_outline") return null;
  const result = data as Record<string, unknown>;
  if (!Array.isArray(result.symbols)) return null;
  return ["agc1", toolName, [result.filePath, result.symbols.map((item) => compactSymbol(item as Record<string, unknown>))], meta];
}

export function measureCompactCandidate(
  codec: CompactCandidateCodec,
  toolName: string,
  envelope: McpEnvelope<unknown>,
): CompactCandidateMeasurement {
  if (!envelope.ok) {
    return rejectedMeasurement(codec.id, "error_envelope");
  }
  if (!isCompactCandidateToolName(toolName)) {
    return rejectedMeasurement(codec.id, "unsupported_tool");
  }
  const encodeStartedAt = performance.now();
  let value: unknown;
  try {
    value = codec.encode(toolName, envelope);
  } catch (error) {
    return rejectedMeasurement(codec.id, `encode_error:${errorMessage(error)}`, performance.now() - encodeStartedAt);
  }
  const encodeMs = performance.now() - encodeStartedAt;
  if (value === null) return rejectedMeasurement(codec.id, "unsupported_shape", encodeMs);
  const encoded = JSON.stringify(value);
  const decodeStartedAt = performance.now();
  try {
    const decoded = codec.decode(value);
    return {
      candidateId: codec.id,
      encoded,
      decoded,
      bytes: Buffer.byteLength(encoded),
      tokens: countTokens(encoded),
      encodeMs,
      decodeMs: performance.now() - decodeStartedAt,
      tokenizer: BENCHMARK_TOKENIZER,
      rejectionReason: null,
    };
  } catch (error) {
    return {
      ...rejectedMeasurement(codec.id, `decode_error:${errorMessage(error)}`, encodeMs),
      encoded,
      bytes: Buffer.byteLength(encoded),
      tokens: countTokens(encoded),
    };
  }
}

export function measureFrozenAgc1Reference(
  toolName: string,
  envelope: McpEnvelope<unknown>,
): CompactCandidateMeasurement {
  if (!envelope.ok) return rejectedMeasurement("agc1-reference", "error_envelope");
  if (!isCompactCandidateToolName(toolName)) return rejectedMeasurement("agc1-reference", "unsupported_tool");
  const startedAt = performance.now();
  const value = encodeFrozenAgc1Reference(toolName, envelope);
  const encodeMs = performance.now() - startedAt;
  if (!value) return rejectedMeasurement("agc1-reference", "unsupported_tool", encodeMs);
  const encoded = JSON.stringify(value);
  return {
    candidateId: "agc1-reference",
    encoded,
    decoded: null,
    bytes: Buffer.byteLength(encoded),
    tokens: countTokens(encoded),
    encodeMs,
    decodeMs: null,
    tokenizer: BENCHMARK_TOKENIZER,
    rejectionReason: "reference_encoder_only",
  };
}

function isCompactCandidateToolName(value: string): value is CompactCandidateToolName {
  return value === "search_symbols" || value === "get_file_tree" || value === "get_file_outline"
    || value === "find_files" || value === "search_text";
}

function rejectedMeasurement(candidateId: string, rejectionReason: string, encodeMs = 0): CompactCandidateMeasurement {
  return { candidateId, encoded: null, decoded: null, bytes: null, tokens: null, encodeMs, decodeMs: null, tokenizer: BENCHMARK_TOKENIZER, rejectionReason };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
