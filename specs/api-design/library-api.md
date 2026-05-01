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
- Exact source and context: `getSymbolSource`, `getFileContent`, `getContextBundle`, `getRankedContext`
- Health and operations: `diagnostics`, `doctor`, `getProjectStatus`

## Verification

Primary tests:

- `tests/engine-behavior.test.ts`
- `tests/interface.test.ts`
- `tests/engine-contract.test.ts`
