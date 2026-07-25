export interface TokenizerResearchCorpusCase {
  id: string;
  value: string;
}

// These strings are deliberately checked in rather than generated from the
// current implementation so a tokenizer replacement cannot silently redefine
// the research corpus.
export const TOKENIZER_RESEARCH_CORPUS: readonly TokenizerResearchCorpusCase[] = [
  {
    id: "task-context-json",
    value: JSON.stringify({
      repoRoot: "/workspace/astrograph",
      query: "debug stale cache invalidation",
      intent: "debug",
      payloadTokenBudget: 1200,
      usedPayloadTokens: 840,
      sourceTokens: 552,
      truncated: false,
      relationDepth: 1,
      exclusions: [{ reason: "duplicate", count: 2 }],
      items: [{
        role: "anchor",
        reason: "explicit_symbol_id",
        symbol: { id: "src/storage.ts:ensureStorage", name: "ensureStorage", filePath: "src/storage.ts" },
        source: "export async function ensureStorage() { return openDatabase(); }",
        provenance: { contentHash: "abc123", range: { startByte: 0, endByte: 65, encoding: "utf8" } },
        sourceTokens: 16,
      }],
    }),
  },
  {
    id: "empty-envelope",
    value: JSON.stringify({ items: [], exclusions: [], query: null, truncated: false }),
  },
  {
    id: "error-envelope",
    value: JSON.stringify({ error: { code: "INVALID_ARGUMENT", message: "payloadTokenBudget must be positive" } }),
  },
  {
    id: "provenance-heavy-json",
    value: JSON.stringify({
      items: Array.from({ length: 8 }, (_, index) => ({
        symbol: { id: `src/module-${index}.ts:handler`, name: `handler${index}`, filePath: `src/module-${index}.ts` },
        provenance: { contentHash: `hash-${index}`.repeat(8), range: { startByte: index * 17, endByte: index * 17 + 111, encoding: "utf8" } },
        reason: "dependency",
      })),
    }),
  },
  {
    id: "unicode-crlf-source",
    value: "export const greeting = 'Hej, København 👋';\r\n// 漢字, café, e\u0301, and \\u{1F680}\r\nconst regexp = /[\\p{L}]+/u;\r\n",
  },
  {
    id: "large-repeated-source",
    value: "export function format(value: number) { return `value:${value}`; }\n".repeat(600),
  },
  {
    id: "large-diverse-source",
    value: Array.from({ length: 600 }, (_, index) =>
      `export const field_${index} = { key: \"${index.toString(36)}\", emoji: \"${index % 2 === 0 ? "🚀" : "漢"}\" };`,
    ).join("\n"),
  },
];
