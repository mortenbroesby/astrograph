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

const PREFIX_LEGEND_VERSION = "agc2p";

/** Candidate C: one path-prefix legend, used only when exact tokens decrease. */
export function encodePrefixLegendAgc2(
  toolName: CompactCandidateToolName,
  envelope: McpResponseEnvelope<unknown>,
): unknown[] | null {
  const schemaValue = encodeSchemaRowsAgc2(toolName, envelope);
  if (!schemaValue) return null;
  const [, schemaId, payload, meta] = schemaValue;
  const paths = pathsForSchemaPayload(toolName, payload);
  const prefix = commonPathPrefix(paths);
  if (!prefix) return null;
  const encoded = [PREFIX_LEGEND_VERSION, schemaId, prefix, encodeSchemaPaths(toolName, payload, prefix), meta];
  return countTokens(JSON.stringify(encoded)) < countTokens(JSON.stringify(schemaValue)) ? encoded : null;
}

export function decodePrefixLegendAgc2(value: unknown): McpResponseEnvelope<unknown> {
  if (!Array.isArray(value) || value.length !== 5 || value[0] !== PREFIX_LEGEND_VERSION) {
    throw new Error("Invalid prefix-legend header");
  }
  const [, schemaId, prefix, payload, meta] = value;
  if (typeof schemaId !== "string" || typeof prefix !== "string" || prefix.length === 0) {
    throw new Error("Invalid prefix-legend header");
  }
  const toolName = TOOL_BY_SCHEMA_ROWS.get(schemaId);
  if (!toolName) throw new Error("Unknown prefix-legend schema");
  return decodeSchemaRowsAgc2([SCHEMA_ROWS_VERSION, schemaId, decodeSchemaPaths(toolName, payload, prefix), meta]);
}

export const prefixLegendAgc2Codec: CompactCandidateCodec = {
  id: "agc2-prefix-legend",
  encode: encodePrefixLegendAgc2,
  decode: decodePrefixLegendAgc2,
};

const TYPED_ROWS_VERSION = "agc2t";

/** Candidate D: escaped typed-delimited rows, with explicit scalar tags. */
export function encodeTypedRowsAgc2(
  toolName: CompactCandidateToolName,
  envelope: McpResponseEnvelope<unknown>,
): unknown[] | null {
  const schemaValue = encodeSchemaRowsAgc2(toolName, envelope);
  if (!schemaValue) return null;
  const [, schemaId, payload, meta] = schemaValue;
  try {
    if (toolName === "search_symbols") {
      const value = payload as unknown[];
      return [TYPED_ROWS_VERSION, schemaId, [(value[0] as unknown[]).map(encodeTypedRow), value[1], value[2], value[3]], meta];
    }
    if (toolName === "get_file_tree") return [TYPED_ROWS_VERSION, schemaId, (payload as unknown[]).map(encodeTypedRow), meta];
    if (toolName === "get_file_outline") {
      const value = payload as unknown[];
      return [TYPED_ROWS_VERSION, schemaId, [value[0], (value[1] as unknown[]).map(encodeTypedRow)], meta];
    }
    return [TYPED_ROWS_VERSION, schemaId, (payload as unknown[]).map(encodeTypedRow), meta];
  } catch {
    return null;
  }
}

export function decodeTypedRowsAgc2(value: unknown): McpResponseEnvelope<unknown> {
  if (!Array.isArray(value) || value.length !== 4 || value[0] !== TYPED_ROWS_VERSION) throw new Error("Invalid typed-row header");
  const [, schemaId, payload, meta] = value;
  if (typeof schemaId !== "string") throw new Error("Invalid typed-row schema");
  const toolName = TOOL_BY_SCHEMA_ROWS.get(schemaId);
  if (!toolName) throw new Error("Unknown typed-row schema");
  let decodedPayload: unknown;
  if (toolName === "search_symbols") {
    if (!Array.isArray(payload) || payload.length !== 4 || !Array.isArray(payload[0])) throw new Error("Invalid typed symbols payload");
    decodedPayload = [payload[0].map(decodeTypedRow), payload[1], payload[2], payload[3]];
  } else if (toolName === "get_file_tree") {
    if (!Array.isArray(payload)) throw new Error("Invalid typed tree payload");
    decodedPayload = payload.map(decodeTypedRow);
  } else if (toolName === "get_file_outline") {
    if (!Array.isArray(payload) || payload.length !== 2 || !Array.isArray(payload[1])) throw new Error("Invalid typed outline payload");
    decodedPayload = [payload[0], payload[1].map(decodeTypedRow)];
  } else {
    if (!Array.isArray(payload)) throw new Error("Invalid typed table payload");
    decodedPayload = payload.map(decodeTypedRow);
  }
  return decodeSchemaRowsAgc2([SCHEMA_ROWS_VERSION, schemaId, decodedPayload, meta]);
}

export const typedRowsAgc2Codec: CompactCandidateCodec = {
  id: "agc2-typed-rows",
  encode: encodeTypedRowsAgc2,
  decode: decodeTypedRowsAgc2,
};

function encodeTypedRow(row: unknown): string {
  if (!Array.isArray(row)) throw new Error("Typed row must be an array");
  return row.map(encodeTypedScalar).join("\t");
}

function encodeTypedScalar(value: unknown): string {
  if (value === null) return "n";
  if (value === true) return "b1";
  if (value === false) return "b0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Typed rows reject non-finite numbers");
    return Number.isInteger(value) ? `i${value}` : `f${value}`;
  }
  if (typeof value === "string") return `s${escapeTypedString(value)}`;
  throw new Error("Typed rows reject non-scalar values");
}

function decodeTypedRow(row: unknown): unknown[] {
  if (typeof row !== "string") throw new Error("Typed row must be a string");
  return row.split("\t").map(decodeTypedScalar);
}

function decodeTypedScalar(token: string): unknown {
  if (token === "n") return null;
  if (token === "b1") return true;
  if (token === "b0") return false;
  if (token.startsWith("i") && /^-?\d+$/.test(token.slice(1))) return Number(token.slice(1));
  if (token.startsWith("f") && /^-?(?:\d+\.\d*|\d*\.\d+|\d+)(?:e[+-]?\d+)?$/i.test(token.slice(1))) return Number(token.slice(1));
  if (token.startsWith("s")) return unescapeTypedString(token.slice(1));
  throw new Error("Invalid typed scalar");
}

function escapeTypedString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\t", "\\t").replaceAll("\n", "\\n").replaceAll("\r", "\\r");
}

function unescapeTypedString(value: string): string {
  return value.replace(/\\([\\tnr])/g, (_match, escape: string) => ({ "\\": "\\", t: "\t", n: "\n", r: "\r" })[escape] ?? "");
}

function pathsForSchemaPayload(toolName: CompactCandidateToolName, payload: unknown): string[] {
  if (toolName === "search_symbols") {
    return Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0].map((row) => Array.isArray(row) && typeof row[4] === "string" ? row[4] : "").filter(Boolean) : [];
  }
  if (toolName === "get_file_tree") return Array.isArray(payload) ? payload.map((row) => Array.isArray(row) && typeof row[0] === "string" ? row[0] : "").filter(Boolean) : [];
  if (toolName === "get_file_outline") {
    return Array.isArray(payload) && Array.isArray(payload[1]) ? [payload[0], ...payload[1].map((row) => Array.isArray(row) ? row[4] : "")].filter((path): path is string => typeof path === "string") : [];
  }
  return Array.isArray(payload) ? payload.map((row) => Array.isArray(row) && typeof row[0] === "string" ? row[0] : "").filter(Boolean) : [];
}

function commonPathPrefix(paths: string[]): string | null {
  if (paths.length < 2) return null;
  const first = paths[0].split("/");
  let length = first.length - 1;
  for (const path of paths.slice(1)) {
    const parts = path.split("/");
    let shared = 0;
    while (shared < length && first[shared] === parts[shared]) shared += 1;
    length = shared;
  }
  return length > 0 ? `${first.slice(0, length).join("/")}/` : null;
}

function pathReference(path: unknown, prefix: string): unknown {
  if (typeof path !== "string" || !path.startsWith(prefix)) throw new Error("Path does not match prefix legend");
  return path.slice(prefix.length);
}

function restorePath(value: unknown, prefix: string): string {
  if (typeof value !== "string") throw new Error("Invalid prefix-legend path reference");
  return `${prefix}${value}`;
}

function encodeSchemaPaths(toolName: CompactCandidateToolName, payload: unknown, prefix: string): unknown {
  if (toolName === "search_symbols") {
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) throw new Error("Invalid symbols schema payload");
    return [payload[0].map((row) => { const copy = [...(row as unknown[])]; copy[4] = pathReference(copy[4], prefix); return copy; }), payload[1], payload[2], payload[3]];
  }
  if (toolName === "get_file_tree") return (payload as unknown[]).map((row) => { const copy = [...(row as unknown[])]; copy[0] = pathReference(copy[0], prefix); return copy; });
  if (toolName === "get_file_outline") {
    const outline = payload as unknown[];
    return [pathReference(outline[0], prefix), (outline[1] as unknown[]).map((row) => { const copy = [...(row as unknown[])]; copy[4] = pathReference(copy[4], prefix); return copy; })];
  }
  return (payload as unknown[]).map((row) => { const copy = [...(row as unknown[])]; copy[0] = pathReference(copy[0], prefix); return copy; });
}

function decodeSchemaPaths(toolName: CompactCandidateToolName, payload: unknown, prefix: string): unknown {
  if (toolName === "search_symbols") {
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) throw new Error("Invalid prefix-legend symbols payload");
    return [payload[0].map((row) => { const copy = [...(row as unknown[])]; copy[4] = restorePath(copy[4], prefix); return copy; }), payload[1], payload[2], payload[3]];
  }
  if (toolName === "get_file_tree") return (payload as unknown[]).map((row) => { const copy = [...(row as unknown[])]; copy[0] = restorePath(copy[0], prefix); return copy; });
  if (toolName === "get_file_outline") {
    const outline = payload as unknown[];
    return [restorePath(outline[0], prefix), (outline[1] as unknown[]).map((row) => { const copy = [...(row as unknown[])]; copy[4] = restorePath(copy[4], prefix); return copy; })];
  }
  return (payload as unknown[]).map((row) => { const copy = [...(row as unknown[])]; copy[0] = restorePath(copy[0], prefix); return copy; });
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
