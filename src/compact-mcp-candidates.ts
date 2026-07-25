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

const SCHEMA_ROWS_VERSION = "agc2s";
const SCHEMA_ROWS_BY_TOOL: Record<CompactCandidateToolName, string> = {
  search_symbols: "symbols/13",
  get_file_tree: "tree/3",
  get_file_outline: "outline/13",
  find_files: "files/6",
  search_text: "text/3",
};
const TOOL_BY_SCHEMA_ROWS = new Map(Object.entries(SCHEMA_ROWS_BY_TOOL).map(([toolName, schemaId]) => [schemaId, toolName as CompactCandidateToolName]));
const FIND_FILE_FIELDS = ["filePath", "fileName", "language", "supportTier", "indexed", "matchReason"] as const;
const SEARCH_TEXT_FIELDS = ["filePath", "line", "preview"] as const;

function compactSymbol(symbol: Record<string, unknown>): unknown[] {
  return SYMBOL_FIELDS.map((field) => symbol[field] ?? null);
}

function expandSymbol(row: unknown): Record<string, unknown> {
  return expandRow(row, SYMBOL_FIELDS, "symbol");
}

function compactRows(rows: Array<Record<string, unknown>>, fields: readonly string[]): unknown[][] {
  return rows.map((row) => fields.map((field) => row[field] ?? null));
}

function expandRow(row: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (!Array.isArray(row) || row.length !== fields.length) {
    throw new Error(`Invalid ${label} row width`);
  }
  return Object.fromEntries(fields.map((field, index) => [field, row[index]]));
}

/** Candidate B: declarative per-tool schema IDs with fixed-width rows. */
export function encodeSchemaRowsAgc2(
  toolName: CompactCandidateToolName,
  envelope: McpResponseEnvelope<unknown>,
): unknown[] | null {
  const data = envelope.data;
  if (!data || typeof data !== "object") return null;
  const meta = [envelope.meta.toolVersion, envelope.meta.tokenBudgetUsed, envelope.meta.dataFreshness];
  const schemaId = SCHEMA_ROWS_BY_TOOL[toolName];
  if (toolName === "search_symbols") {
    const result = data as Record<string, unknown>;
    if (!Array.isArray(result.items)) return null;
    return [SCHEMA_ROWS_VERSION, schemaId, [result.items.map((item) => compactSymbol(item as Record<string, unknown>)), result.truncated, result.refinementHints, result.tokenSavings], meta];
  }
  if (toolName === "get_file_tree") {
    if (!Array.isArray(data)) return null;
    return [SCHEMA_ROWS_VERSION, schemaId, compactRows(data as Array<Record<string, unknown>>, ["path", "language", "symbolCount"]), meta];
  }
  if (toolName === "get_file_outline") {
    const result = data as Record<string, unknown>;
    if (!Array.isArray(result.symbols)) return null;
    return [SCHEMA_ROWS_VERSION, schemaId, [result.filePath, result.symbols.map((item) => compactSymbol(item as Record<string, unknown>))], meta];
  }
  if (!Array.isArray(data)) return null;
  return [SCHEMA_ROWS_VERSION, schemaId, compactRows(data as Array<Record<string, unknown>>, toolName === "find_files" ? FIND_FILE_FIELDS : SEARCH_TEXT_FIELDS), meta];
}

export function decodeSchemaRowsAgc2(value: unknown): McpResponseEnvelope<unknown> {
  if (!Array.isArray(value) || value.length !== 4 || value[0] !== SCHEMA_ROWS_VERSION) throw new Error("Invalid schema-row header");
  const [, schemaId, payload, meta] = value;
  if (typeof schemaId !== "string" || !Array.isArray(meta) || meta.length !== 3) throw new Error("Invalid schema-row header");
  const toolName = TOOL_BY_SCHEMA_ROWS.get(schemaId);
  if (!toolName) throw new Error("Unknown schema-row schema");
  const [toolVersion, tokenBudgetUsed, dataFreshness] = meta;
  if (toolVersion !== "1" || (tokenBudgetUsed !== null && (typeof tokenBudgetUsed !== "number" || !Number.isFinite(tokenBudgetUsed))) || (dataFreshness !== "fresh" && dataFreshness !== "stale" && dataFreshness !== "unknown")) {
    throw new Error("Invalid schema-row metadata");
  }

  let data: unknown;
  if (toolName === "search_symbols") {
    if (!Array.isArray(payload) || payload.length !== 4 || !Array.isArray(payload[0])) throw new Error("Invalid symbols schema payload");
    data = { items: payload[0].map(expandSymbol), truncated: payload[1], refinementHints: payload[2], tokenSavings: payload[3] };
  } else if (toolName === "get_file_tree") {
    if (!Array.isArray(payload)) throw new Error("Invalid tree schema payload");
    data = payload.map((row) => expandRow(row, ["path", "language", "symbolCount"], "tree"));
  } else if (toolName === "get_file_outline") {
    if (!Array.isArray(payload) || payload.length !== 2 || !Array.isArray(payload[1])) throw new Error("Invalid outline schema payload");
    data = { filePath: payload[0], symbols: payload[1].map(expandSymbol) };
  } else {
    if (!Array.isArray(payload)) throw new Error("Invalid table schema payload");
    data = payload.map((row) => expandRow(row, toolName === "find_files" ? FIND_FILE_FIELDS : SEARCH_TEXT_FIELDS, toolName));
  }
  return { ok: true, data, meta: { toolVersion, tokenBudgetUsed, dataFreshness } };
}

export const schemaRowsAgc2Codec: CompactCandidateCodec = {
  id: "agc2-schema-rows",
  encode: encodeSchemaRowsAgc2,
  decode: decodeSchemaRowsAgc2,
};

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
