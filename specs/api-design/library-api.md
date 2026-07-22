# Library API

The TypeScript API exports Astrograph's core operations for direct Node use.

## Stability Rules

- Public exports from `src/index.ts` are package-facing.
- New exported functions must have type exports when consumers need to construct inputs or inspect results.
- Internal helper modules may be split freely when `src/index.ts` remains stable.
- Breaking public type or result changes require an ADR or explicit implementation spec.

## Current Major Areas

- Indexing and refresh: `indexFolder`, `indexFile`, `watchFolder`
- Discovery and retrieval: `findFiles`, `searchText`, `searchSymbols`, `queryCode`
- Exact source and context: `getSymbolSource`, `getFileContent`, `getTaskContext`
- Health and operations: `diagnostics`, `doctor`, `getProjectStatus`

## Verification

`getSymbolSource` returns source items with a UTF-8 `provenance` envelope:
canonical file path, SHA-256 source hash, zero-based/end-exclusive byte range,
one-based line range, parser fallback metadata, and `indexed-snapshot`
freshness. `SymbolSummary` includes the same symbol byte range. The snapshot
freshness label does not claim that the current disk has been scanned; use
diagnostics when a live freshness decision is required.

Primary tests:

- `tests/engine-behavior.test.ts`
- `tests/interface.test.ts`
- `tests/engine-contract.test.ts`
