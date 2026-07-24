# Compact Output v2 API

## Summary

`agc2` is an Astrograph-owned, lossless JSON representation for selected MCP
success results with repetitive tabular data. It is not compatible with any
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

`table` is an Astrograph compact table:

```ts
{
  columns: string[],
  dictionaries?: Record<string, string[]>,
  rows: Array<Array<string | number | boolean | null>>,
  scalars?: Record<string, string | number | boolean | null>,
}
```

Columns named in `dictionaries` contain zero-based dictionary indexes. All
other cells retain their JSON scalar value. Each selected tool owns its ordered
column list and any scalar fields; the reference decoder rejects unknown tools,
versions, invalid dictionary indexes, and malformed row widths.

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
