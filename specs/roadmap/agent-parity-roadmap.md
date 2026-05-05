# Agent Parity Roadmap

## Purpose

This roadmap converts `specs/raw/astrograph_jcodemunch_agent_spec.md` into the
current next work queue. The raw spec remains useful background, but this file is
the active roadmap for jCodeMunch-parity work after the MCP v1 hard switch.

## Current Baseline

Completed foundations:

- Package identity is `astrograph`; the package exposes only the `astrograph` bin.
- MCP v1 no longer exposes `query_code`; explicit retrieval tools are registered instead.
- MCP v1 responses use strict `ok` / `data` / `meta` / `error` envelopes with `toolVersion: "1"`.
- Tree-sitter is the active parser execution path for JS/TS-family graph-tier indexing.
- Cache behavior is intentionally absent from MCP v1.
- Source ownership has been split across storage schema/query/indexing/retrieval/reporting, parser, command registry, MCP observability, and internal type modules.
- Release-agent policy exists and package metadata changes are patch-classified unless commit history signals otherwise.

Verification anchors:

- `tests/interface.test.ts` covers MCP tool registration, strict envelopes, and workspace bin behavior.
- `tests/engine-contract.test.ts` covers package metadata, installer output, and MCP config generation.
- `tests/engine-behavior.test.ts` covers indexing, retrieval, freshness, parser, watch, diagnostics, and graph-adjacent behavior.
- `tests/parser.golden.test.ts` covers deterministic JS/TS parser output.
- `tests/release-policy.test.ts` covers release classification and target-version selection.

## Sequencing Rule

Prioritize foundations that make later work safer:

1. Better retrieval ranking before more tools.
2. Stable symbol identity before caches, sessions, and edit impact.
3. Reference/graph tools before blast-radius and rename-safety tools.
4. Compact output after response shapes and retrieval workflows are stable.
5. Runtime profiles after the tool surface grows enough to need profile management.
6. New language adapters after retrieval and identity contracts are solid.

## Next Work Chunk 1: Retrieval Quality Upgrade

Source workstreams: raw spec Workstream B and Priority 3.

Goal:

Improve `search_symbols` and ranked context quality for vague code questions
without adding hosted dependencies or semantic search.

Scope:

- Add identifier-aware tokenization for camelCase, snake_case, kebab-case, paths, and constants.
- Add a small abbreviation map for common code-search terms such as `cfg`, `ctx`, `db`, `repo`, `impl`, and `fn`.
- Build a symbol document model from existing indexed symbol fields.
- Add BM25 scoring over symbol documents.
- Add fuzzy fallback for low-confidence or typo-heavy queries.
- Add optional score breakdown for debug/test visibility.
- Add benchmark task cards that compare current ranking with enhanced ranking.

Likely files:

- `src/retrieval.ts`
- `src/types/retrieval.ts`
- `src/storage.ts` or extracted retrieval helpers
- `tests/engine-behavior.test.ts`
- `bench/tests/*`
- `scripts/perf*.mjs` if benchmarks need new modes

Acceptance criteria:

- Exact symbol-name queries still rank exact matches first.
- Vague queries retrieve intended symbols in focused fixtures.
- Typo tests demonstrate fuzzy fallback.
- Debug mode returns deterministic score breakdown.
- Benchmark output records before/after retrieval quality and token cost for task cards.

Recommended implementation plan file:

- `specs/implementation/retrieval-quality-upgrade.md`

## Next Work Chunk 2: Stable Symbol Identity

Source workstreams: raw spec Workstream E and Priority 4.

Goal:

Make symbol IDs survive ordinary edits so retrieval, graph tools, sessions, and
future cache invalidation can depend on durable identities.

Scope:

- Define semantic stable IDs using relative path, qualified name, kind, and deterministic collision suffixes.
- Add persisted `stable_id` and `signature_hash` data where needed.
- Add alias mapping for previous IDs if compatibility is required for already-indexed repositories.
- Return stable identity in standard/full retrieval outputs.
- Prove IDs survive inserting lines above a symbol and reindexing.

Likely files:

- `src/parser/tree-sitter.ts`
- `src/parser/shared.ts`
- `src/storage-schema.ts`
- `src/storage-queries.ts`
- `src/indexing.ts`
- `src/retrieval.ts`
- `tests/parser.golden.test.ts`
- `tests/engine-behavior.test.ts`

Acceptance criteria:

- Same function keeps the same stable ID after line-offset shifts.
- Duplicate same-file symbol names receive deterministic suffixes.
- Retrieval accepts the new stable IDs.
- Migration/rebuild behavior is explicit and tested.
- Existing MCP v1 response contracts remain valid.

Recommended implementation plan file:

- `specs/implementation/stable-symbol-identity.md`

## Next Work Chunk 3: Reference And Dependency Graph Tools

Source workstreams: raw spec Workstream F and Priority 5.

Goal:

Move Astrograph from finding code to explaining relationship and edit impact.

Scope:

- Start with graph tools that can be supported by existing dependency data.
- Add `find_importers` before deeper reference extraction.
- Add `find_references` with confidence and evidence once symbol identity is stable.
- Add `get_dependency_graph` with budget-aware output.
- Add `get_related_symbols` only after import/reference evidence is reliable.

Likely files:

- `src/mcp-contract.ts`
- `src/mcp.ts`
- `src/command-registry.ts`
- `src/storage-schema.ts`
- `src/storage-queries.ts`
- `src/retrieval.ts` or new `src/graph/*`
- `tests/interface.test.ts`
- `tests/engine-contract.test.ts`
- `tests/engine-behavior.test.ts`
- `specs/api-design/mcp-tools.md`

Acceptance criteria:

- MCP tool list includes the selected graph tools with strict schemas.
- `find_importers` works from current file dependency data.
- `find_references` returns confidence, evidence, and source previews.
- `get_dependency_graph` respects token budgets and freshness metadata.
- Tests include simple JS/TS fixtures for imports, calls, and ambiguous name matches.

Recommended implementation plan file:

- `specs/implementation/reference-graph-tools.md`

## Next Work Chunk 4: Compact Output And Detail Levels

Source workstreams: raw spec Workstream C and Priority 6.

Goal:

Reduce MCP token overhead after retrieval is narrowed by returning less metadata
and encoding repetitive structured responses compactly when worthwhile.

Scope:

- Clarify `detailLevel` support for broad tools.
- Add deterministic compact table encoding for large structured results.
- Add path interning for repeated file paths.
- Add `format: "json" | "compact" | "auto"` only where supported.
- Add auto-mode threshold based on token or byte savings.
- Extend serialization benchmarks for JSON vs compact output.

Likely files:

- `src/serialization.ts`
- `src/mcp-contract.ts`
- `src/mcp.ts`
- `src/types/retrieval.ts`
- `tests/interface.test.ts`
- `tests/serialization.test.ts`
- `tests/perf-scripts.test.ts`
- `specs/api-design/mcp-tools.md`

Acceptance criteria:

- `format=json` always returns normal JSON.
- `format=compact` returns compact output for supported broad tools.
- `format=auto` only returns compact output when savings pass the threshold.
- Small responses stay readable JSON.
- Benchmarks report compact-vs-JSON size and token impact.

Recommended implementation plan file:

- `specs/implementation/compact-output-detail-levels.md`

## Later Roadmap

### Runtime Profiles And Compact Schemas

Source workstreams: raw spec Workstream H and Priority 9.

Add `core`, `standard`, and `full` runtime profiles once the graph-tool surface
exists. Keep compact schema variants post-v1 and only add them after strict full
schemas are stable.

### Python Language Adapter Pilot

Source workstreams: raw spec Workstream G and Priority 7.

Add a language adapter framework before adding `tree-sitter-python`. The first
pilot should target Python outline/retrieval support: functions, classes,
methods, imports, constants, docstrings, and exact source spans. Do not claim
full graph-tier Python support in the first pilot.

### Agent Guidance, Hooks, Sessions, And Edit Lifecycle

Source workstreams: raw spec Workstream I and Priority 10.

Add `astrograph_guide`, `register_edit`, session context, and policy/hook
commands after stable IDs and graph basics exist. Avoid cache/session coupling
until index-generation semantics are explicit.

### Cache Reintroduction

Source workstreams: raw spec Workstream D and Priority 2.

Do not reintroduce MCP cache behavior until stable IDs and index-generation
semantics exist. Any cache plan must explicitly cover invalidation, freshness,
query keys, and response metadata.

### Edit-Safety And Impact Tools

Source workstreams: raw spec Priority 8.

Add `get_changed_symbols`, `get_blast_radius`, `check_rename_safe`, and
`get_impact_preview` after reference confidence and dependency graph tools are
reliable.

### Semantic Search

Source workstreams: raw spec Priority 11.

Keep semantic search optional and later. Lexical ranking, graph evidence, and
stable identities should be strong before adding embeddings.

## Do Not Start Yet

- Broad polyglot parser installs without an adapter contract and fixtures.
- Cache tables or session cache coupled to unstable IDs.
- Semantic search as a substitute for lexical ranking quality.
- Blast-radius or rename-safety tools before reference confidence exists.
- Compact schema hiding before strict full schemas are settled.
