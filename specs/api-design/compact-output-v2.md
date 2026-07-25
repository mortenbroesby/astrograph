# Compact Output v2 API

## Summary

`agc2` is an Astrograph-owned, lossless JSON representation for selected MCP
success results with repetitive fixed-width rows. It is not compatible with any
third-party format. Ordinary MCP v1 JSON remains the default and the only
format used for errors.

## Surface

Selected MCP tools continue to accept the existing optional `format` argument:

- omitted or `"json"`: return the ordinary strict v1 JSON envelope;
- `"compact"`: return the best supported Astrograph compact version for that
  successful tool result;
- `"auto"`: return compact only when the candidate saves at least 20 exact
  `cl100k_base` tokens and 25% of ordinary JSON tokens.

`agc2` replaces `agc1`. Every successful compact-capable tool emits `agc2`;
the former `agc1` encoder and decoder are removed. This is an intentional
breaking contract change paired with the storage/cache v2 boundary.

## `agc2` envelope

```ts
[
  "agc2",
  toolName,
  table,
  ["1", tokenBudgetUsed, dataFreshness],
]
```

`payload` uses a documented, tool-specific packed-row mapping. Symbol rows use
the fixed `SymbolSummary` field order, so they can be emitted as one flat array
without per-row JSON brackets:

```ts
// search_symbols
[flatSymbolRows, truncated, refinementHints, tokenSavings]

// get_file_tree
[path, language, symbolCount, path, language, symbolCount, ...]

// get_file_outline
[filePath, ...flatSymbolRows]
```

`find_files` and `search_text` retain their dictionary-backed table mappings.
Each selected tool owns its ordered fields; the reference decoder rejects
unknown tools, versions, invalid dictionary indexes, and malformed row widths.

For the three migrated AGC1 tools, Astrograph emits AGC2 only when the exact
`cl100k_base` token count is strictly lower than the equivalent AGC1 encoding.
A tie or loss falls back to ordinary JSON, including when callers request
`format: "compact"`.

## Compatibility

- `agc2` is the only supported compact decoder contract. Clients that require
  ordinary objects request `json`.
- `auto` is deliberately polymorphic. Clients that require a single compact
  version request `compact` only after supporting the documented tool mapping.
- Failed calls never use a compact envelope.

## Verification

- `tests/compact-mcp.test.ts` covers round trips, malformed data, errors, and
  default JSON compatibility.
- `tests/interface.test.ts` proves MCP stdio behavior.
- `pnpm bench:mcp-envelopes` records complete result bytes, exact tokens, and
  encode/decode latency for every selected tool.
