import { performance } from "node:perf_hooks";

import type { McpEnvelope, McpResponseEnvelope } from "./mcp-contract.ts";
import { BENCHMARK_TOKENIZER, countTokens } from "./tokenizer.ts";

export const COMPACT_MCP_VERSION = "agc1";
export const COMPACT_TABLE_MCP_VERSION = "agc2";
export const COMPACT_MCP_AUTO_MIN_SAVED_TOKENS = 20;
export const COMPACT_MCP_AUTO_MIN_SAVED_PERCENT = 25;

const SYMBOL_FIELDS = [
  "id",
  "name",
  "qualifiedName",
  "kind",
  "filePath",
  "signature",
  "summary",
  "summarySource",
  "startLine",
  "endLine",
  "startByte",
  "endByte",
  "exported",
] as const;

export type McpOutputFormat = "json" | "compact" | "auto";
export type CompactMcpToolName = "search_symbols" | "get_file_tree" | "get_file_outline";
export type CompactTableMcpToolName = "find_files" | "search_text";
export type CompactMcpEnvelope = readonly [
  typeof COMPACT_MCP_VERSION,
  CompactMcpToolName,
  unknown,
  readonly ["1", number | null, "fresh" | "stale" | "unknown"],
];

export type CompactTableMcpEnvelope = readonly [
  typeof COMPACT_TABLE_MCP_VERSION,
  CompactTableMcpToolName,
  readonly [readonly string[], readonly unknown[][], readonly unknown[][]],
  readonly ["1", number | null, "fresh" | "stale" | "unknown"],
];

export interface McpOutputMetrics {
  requestedFormat: McpOutputFormat;
  selectedFormat: "json" | "compact";
  bytes: number;
  tokens: number;
  savedBytes: number;
  savedTokens: number;
  savedPercent: number;
  encodeMs: number;
  referenceDecodeMs: number | null;
  tokenizer: typeof BENCHMARK_TOKENIZER;
}

export interface FormattedMcpEnvelope {
  serialized: string;
  metrics: McpOutputMetrics;
}

function isCompactToolName(value: string): value is CompactMcpToolName {
  return value === "search_symbols" || value === "get_file_tree" || value === "get_file_outline";
}

function isCompactTableToolName(value: string): value is CompactTableMcpToolName {
  return value === "find_files" || value === "search_text";
}

function compactSymbol(symbol: Record<string, unknown>): unknown[] {
  return SYMBOL_FIELDS.map((field) => symbol[field] ?? null);
}

function expandSymbol(row: unknown): Record<string, unknown> {
  if (!Array.isArray(row) || row.length !== SYMBOL_FIELDS.length) {
    throw new Error("Invalid compact SymbolSummary row");
  }
  return Object.fromEntries(SYMBOL_FIELDS.map((field, index) => [field, row[index]]));
}

function compactSuccessEnvelope(
  toolName: CompactMcpToolName,
  envelope: McpResponseEnvelope<unknown>,
): CompactMcpEnvelope | null {
  const meta = [
    envelope.meta.toolVersion,
    envelope.meta.tokenBudgetUsed,
    envelope.meta.dataFreshness,
  ] as const;
  const data = envelope.data;
  if (!data || typeof data !== "object") {
    return null;
  }

  if (toolName === "search_symbols") {
    const result = data as Record<string, unknown>;
    if (!Array.isArray(result.items)) return null;
    return [
      COMPACT_MCP_VERSION,
      toolName,
      [
        result.items.map((item) => compactSymbol(item as Record<string, unknown>)),
        result.truncated,
        result.refinementHints,
        result.tokenSavings,
      ],
      meta,
    ];
  }

  if (toolName === "get_file_tree") {
    if (!Array.isArray(data)) return null;
    return [
      COMPACT_MCP_VERSION,
      toolName,
      data.map((item) => {
        const entry = item as Record<string, unknown>;
        return [entry.path, entry.language, entry.symbolCount];
      }),
      meta,
    ];
  }

  const result = data as Record<string, unknown>;
  if (!Array.isArray(result.symbols)) return null;
  return [
    COMPACT_MCP_VERSION,
    toolName,
    [result.filePath, result.symbols.map((item) => compactSymbol(item as Record<string, unknown>))],
    meta,
  ];
}

function dictionaryColumn(rows: Array<Record<string, unknown>>, field: string): [unknown[], number[]] {
  const dictionary: unknown[] = [];
  const indexes = new Map<unknown, number>();
  const encoded = rows.map((row) => {
    const value = row[field] ?? null;
    const existing = indexes.get(value);
    if (existing !== undefined) return existing;
    const index = dictionary.length;
    dictionary.push(value);
    indexes.set(value, index);
    return index;
  });
  return [dictionary, encoded];
}

function compactTableSuccessEnvelope(
  toolName: CompactTableMcpToolName,
  envelope: McpResponseEnvelope<unknown>,
): CompactTableMcpEnvelope | null {
  if (!Array.isArray(envelope.data)) return null;
  const rows = envelope.data as Array<Record<string, unknown>>;
  const meta = [
    envelope.meta.toolVersion,
    envelope.meta.tokenBudgetUsed,
    envelope.meta.dataFreshness,
  ] as const;
  const columns = toolName === "find_files"
    ? ["filePath", "fileName", "language", "supportTier", "indexed", "matchReason"]
    : ["filePath", "line", "preview"];
  const dictionaryFields = toolName === "find_files"
    ? ["language", "supportTier", "indexed", "matchReason"]
    : ["filePath"];
  const dictionaries: unknown[][] = [];
  const dictionaryValues = new Map<string, number[]>();
  for (const field of dictionaryFields) {
    const [dictionary, values] = dictionaryColumn(rows, field);
    dictionaries.push(dictionary);
    dictionaryValues.set(field, values);
  }
  return [
    COMPACT_TABLE_MCP_VERSION,
    toolName,
    [
      columns,
      dictionaries,
      rows.map((row, rowIndex) => columns.map((field) =>
        dictionaryValues.get(field)?.[rowIndex] ?? row[field] ?? null,
      )),
    ],
    meta,
  ];
}

/** Restores an `agc1` successful result to the ordinary strict v1 envelope. */
export function decodeCompactMcpEnvelope(value: unknown): McpResponseEnvelope<unknown> {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error("Invalid compact MCP envelope version");
  }
  const [, toolName, payload, meta] = value;
  if ((!isCompactToolName(String(toolName)) && !isCompactTableToolName(String(toolName))) || !Array.isArray(meta) || meta.length !== 3) {
    throw new Error("Invalid compact MCP envelope header");
  }
  const [toolVersion, tokenBudgetUsed, dataFreshness] = meta;
  if (
    toolVersion !== "1"
    || (tokenBudgetUsed !== null && (typeof tokenBudgetUsed !== "number" || !Number.isFinite(tokenBudgetUsed)))
    || (dataFreshness !== "fresh" && dataFreshness !== "stale" && dataFreshness !== "unknown")
  ) {
    throw new Error("Invalid compact MCP envelope metadata");
  }

  let data: unknown;
  if (value[0] === COMPACT_TABLE_MCP_VERSION) {
    if (!isCompactTableToolName(String(toolName)) || !Array.isArray(payload) || payload.length !== 3) {
      throw new Error("Invalid compact table payload");
    }
    const [columns, dictionaries, rows] = payload;
    if (!Array.isArray(columns) || !Array.isArray(dictionaries) || !Array.isArray(rows)) {
      throw new Error("Invalid compact table payload");
    }
    const dictionaryFields = toolName === "find_files"
      ? new Set(["language", "supportTier", "indexed", "matchReason"])
      : new Set(["filePath"]);
    let dictionaryIndex = 0;
    const dictionaryByField = new Map<string, unknown[]>();
    for (const column of columns) {
      if (!dictionaryFields.has(String(column))) continue;
      const dictionary = dictionaries[dictionaryIndex];
      if (!Array.isArray(dictionary)) throw new Error("Invalid compact table dictionary");
      dictionaryByField.set(String(column), dictionary);
      dictionaryIndex += 1;
    }
    if (dictionaryIndex !== dictionaries.length) throw new Error("Invalid compact table dictionary");
    data = rows.map((row) => {
      if (!Array.isArray(row) || row.length !== columns.length) throw new Error("Invalid compact table row");
      return Object.fromEntries(columns.map((column, index) => {
        const dictionary = dictionaryByField.get(String(column));
        const cell = row[index];
        if (!dictionary) return [column, cell];
        if (!Number.isInteger(cell) || cell < 0 || cell >= dictionary.length) {
          throw new Error("Invalid compact table dictionary index");
        }
        return [column, dictionary[cell]];
      }));
    });
  } else if (value[0] !== COMPACT_MCP_VERSION) {
    throw new Error("Invalid compact MCP envelope version");
  } else if (toolName === "search_symbols") {
    if (!Array.isArray(payload) || payload.length !== 4 || !Array.isArray(payload[0])) {
      throw new Error("Invalid compact search_symbols payload");
    }
    data = {
      items: payload[0].map(expandSymbol),
      truncated: payload[1],
      refinementHints: payload[2],
      tokenSavings: payload[3],
    };
  } else if (toolName === "get_file_tree") {
    if (!Array.isArray(payload)) throw new Error("Invalid compact get_file_tree payload");
    data = payload.map((row) => {
      if (!Array.isArray(row) || row.length !== 3) {
        throw new Error("Invalid compact get_file_tree row");
      }
      return { path: row[0], language: row[1], symbolCount: row[2] };
    });
  } else {
    if (!Array.isArray(payload) || payload.length !== 2 || !Array.isArray(payload[1])) {
      throw new Error("Invalid compact get_file_outline payload");
    }
    data = { filePath: payload[0], symbols: payload[1].map(expandSymbol) };
  }

  return {
    ok: true,
    data,
    meta: { toolVersion, tokenBudgetUsed, dataFreshness },
  };
}

function serializeJson(envelope: McpEnvelope<unknown>): string {
  return JSON.stringify(envelope, null, 2);
}

function metricsForJson(
  serialized: string,
  requestedFormat: McpOutputFormat,
  encodeMs: number,
): FormattedMcpEnvelope {
  const bytes = Buffer.byteLength(serialized);
  return {
    serialized,
    metrics: {
      requestedFormat,
      selectedFormat: "json",
      bytes,
      tokens: countTokens(serialized),
      savedBytes: 0,
      savedTokens: 0,
      savedPercent: 0,
      encodeMs,
      referenceDecodeMs: null,
      tokenizer: BENCHMARK_TOKENIZER,
    },
  };
}

/** Serializes a validated v1 envelope with the requested safe output format. */
export function formatMcpEnvelope(
  toolName: string,
  requestedFormat: McpOutputFormat | undefined,
  envelope: McpEnvelope<unknown>,
): FormattedMcpEnvelope {
  const format = requestedFormat ?? "json";
  const startedAt = performance.now();
  const json = serializeJson(envelope);
  if (format === "json" || !envelope.ok || (!isCompactToolName(toolName) && !isCompactTableToolName(toolName))) {
    return metricsForJson(json, format, performance.now() - startedAt);
  }

  try {
    const compact = isCompactToolName(toolName)
      ? compactSuccessEnvelope(toolName, envelope)
      : compactTableSuccessEnvelope(toolName, envelope);
    if (!compact) return metricsForJson(json, format, performance.now() - startedAt);
    const compactSerialized = JSON.stringify(compact);
    const jsonTokens = countTokens(json);
    const compactTokens = countTokens(compactSerialized);
    const savedTokens = jsonTokens - compactTokens;
    const savedPercent = jsonTokens === 0 ? 0 : (savedTokens / jsonTokens) * 100;
    const useCompact = format === "compact"
      || (savedTokens >= COMPACT_MCP_AUTO_MIN_SAVED_TOKENS
        && savedPercent >= COMPACT_MCP_AUTO_MIN_SAVED_PERCENT);
    if (!useCompact) return metricsForJson(json, format, performance.now() - startedAt);

    const decodeStartedAt = performance.now();
    decodeCompactMcpEnvelope(compact);
    const referenceDecodeMs = performance.now() - decodeStartedAt;
    return {
      serialized: compactSerialized,
      metrics: {
        requestedFormat: format,
        selectedFormat: "compact",
        bytes: Buffer.byteLength(compactSerialized),
        tokens: compactTokens,
        savedBytes: Buffer.byteLength(json) - Buffer.byteLength(compactSerialized),
        savedTokens,
        savedPercent,
        encodeMs: performance.now() - startedAt,
        referenceDecodeMs,
        tokenizer: BENCHMARK_TOKENIZER,
      },
    };
  } catch {
    return metricsForJson(json, format, performance.now() - startedAt);
  }
}
