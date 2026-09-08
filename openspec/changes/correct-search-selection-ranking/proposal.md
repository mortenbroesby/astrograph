## Why

Symbol search can exclude valid scoped matches because FTS is capped before
`filePattern` filtering, and its BM25 weights target the wrong columns. Search
ordering also lets weaker FTS evidence outrank exact lexical matches, so P2
cannot build trustworthy retrieval evidence on the current selection path.

## What Changes

- Apply language, kind, and file scope before the bounded FTS candidate cutoff.
- Weight the actual searchable FTS columns instead of the two leading
  `UNINDEXED` identity columns.
- Retain deterministic lexical candidates when FTS narrows too aggressively.
- Rank exact and heuristic lexical evidence before BM25 tie-breaking.
- Measure target recall, first-relevant rank, false positives, scoped recall,
  output tokens, and latency on deterministic fixtures.
- Preserve the existing public search schema, SQLite/FTS5 storage, ranking
  configuration, and non-search retrieval behavior; no new dependency,
  encoding, daemon behavior, or semantic-search system is included.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-retrieval-efficiency`: Make symbol selection and ordering complete,
  deterministic, scoped, and measurable before response-size optimization.

## Impact

The change is limited to the symbol candidate and ranking path in
`src/retrieval.ts`, focused behavior fixtures in
`tests/engine-behavior.test.ts`, and source-free benchmark evidence. Public MCP
and CLI request/response shapes remain compatible. No dependency or storage
schema migration is expected.
