## Why

Astrograph currently promotes file-level import evidence into symbol-level reference claims by selecting an arbitrary representative symbol from an importer. This makes graph-aware retrieval look more precise than its evidence supports and prevents a fair correctness-and-cost comparison with jCodeMunch.

## What Changes

- Distinguish file-level import and re-export relationships from symbol-level references in graph-aware discovery, context bundles, and task context.
- Attach explicit evidence and confidence to every returned relation result.
- Promote an importer symbol to a reference only when persisted import-specifier evidence and a matching local identifier occurrence identify that symbol; preserve named-import aliases.
- Record actual re-export statements so non-relative imports are not mislabeled as re-exports.
- Add public-boundary fixtures for aliases, re-exports, unrelated representative symbols, and multiple symbols in one importer.
- Add a deterministic, source-free relationship benchmark that reports correctness before tokens and latency, and repair the missing pre-build hook for the existing search-ranking benchmark.
- Preserve existing response envelopes by adding relation evidence as optional fields.
- Non-goals: building the P4 semantic TypeScript graph, proving call sites, resolving path aliases beyond current module resolution, or adding a dependency, database migration, or new encoding.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-retrieval-efficiency`: Require honest relation scope, explicit evidence and confidence, alias-aware symbol promotion, accurate re-export classification, and comparable graph correctness/cost evidence.

## Impact

The change affects import parsing and hashing, persisted import-specifier JSON, graph-aware retrieval selection, public retrieval result types, focused parser and engine behavior tests, benchmark scripts, and performance documentation. Existing stored rows remain readable because the new re-export marker and response evidence are optional; no dependency or storage-schema migration is introduced.
