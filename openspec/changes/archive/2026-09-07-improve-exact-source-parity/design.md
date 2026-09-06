## Context

See `proposal.md` for motivation and `specs/agent-retrieval-efficiency/spec.md` for the behavioral contract. The current comparison extracts a compressed jCodeMunch alias such as `@1::loadBenchmarkCorpus#function` and passes it directly to `get_symbol_source`; jCodeMunch requires the alias table to be expanded to the canonical file-qualified id. The returned error still passes the harness check because target names are present in the preceding search response.

Astrograph already centralizes optional MCP formatting in `src/compact-mcp.ts` and preserves ordinary JSON by default. `get_symbol_source` is validated before formatting and returns an `items` array plus first-item compatibility fields, making it suitable for an opt-in compact wire representation that reconstructs the same v1 envelope on decode.

## Goals / Non-Goals

**Goals:**

- Make the comparison retrieve and validate implementation source for both declared target symbols.
- Keep workflow totals and isolated exact-source response totals independently auditable.
- Reuse the existing compact-envelope version, auto-selection thresholds, tokenizer, and MCP formatting path.
- Preserve default JSON, error envelopes, content-reference behavior, Unicode, and source provenance exactly.

**Non-Goals:**

- Change the retrieval engine's `SymbolSourceResult` or remove its compatibility fields.
- Optimize indexing, ranking, schemas, tool discovery, or daemon startup.
- Add a dependency, generic router, new tool tier, or new compact-envelope version.

## Decisions

### Expand jCodeMunch aliases and batch both exact-source requests

`bench/scripts/jcodemunch-comparison.mjs` will parse the compact search alias table, resolve the exact `loadBenchmarkCorpus` and `loadBenchmarkTaskCard` rows to canonical ids, and pass both ids in one `get_symbol_source` call. Astrograph will likewise pass both literal ids in one call.

The harness will parse each source response, reject MCP/tool error shapes, and require both function implementations in that response. Search text will not contribute to task-success validation. Focused regression tests in `bench/tests/jcodemunch-comparison.test.ts` will cover alias expansion, source errors, missing target bodies, and successful batched retrieval.

This keeps the established two-call workflow while honoring each product's encoding. Using jCodeMunch `detail_level: full` was rejected because it would change that product to a one-call inline-source workflow and confound search and exact-source response cost.

### Report workflow and source-call payloads separately

The comparison result will retain total retrieval bytes/tokens/calls and add the source-producing response bytes/tokens. Successful aggregates will include only runs that pass source validation. The report will disclose alias expansion and distinguish minimum successful workflow cost from isolated exact-source payload cost.

This is preferable to replacing the existing table with one composite number because compaction directly affects the source response while discovery formats remain product-specific.

### Extend the existing compact formatter only for successful exact-source envelopes

`src/mcp-contract.ts` will expose the existing optional `format` schema on `get_symbol_source`; `src/mcp.ts` will continue consuming it only at the formatting boundary. `src/compact-mcp.ts` will add `get_symbol_source` to the selected compact tools and encode `requestedContextLines`, each item once, and v1 metadata as positional data under the existing `agc1` envelope.

The compact item will retain the complete symbol record, source, verification flag, returned line range, and provenance. `decodeCompactMcpEnvelope` will reconstruct both `items` and the legacy first-item fields so decoded output equals the validated ordinary JSON envelope. Failed envelopes remain ordinary JSON. `auto` will reuse the existing minimum-token and percentage thresholds.

Dropping compatibility fields from ordinary JSON was rejected because it would be a breaking contract change. A source-only text format was rejected because it would discard verification and provenance evidence.

### Prove compatibility and measured value before changing the report

`tests/compact-mcp.test.ts` will characterize the current JSON envelope and prove compact round trips for single, batched, empty, Unicode, and malformed cases. `tests/interface.test.ts` will verify the live tool schema and stdio response selection. The benchmark tests must fail before the harness fix, then pass with successful source retrieval.

After focused tests, build, and type checks, the comparison will run three isolated trials per server on one commit. `docs/reviews/jcodemunch-comparison-2026-09-06.md` and `docs/guides/benchmarks.md` will correct the invalid result, include the new source-call metric, and retain old raw output only under ignored `.benchmarks/`.

Required verification:

- `pnpm exec vitest run bench/tests/jcodemunch-comparison.test.ts tests/compact-mcp.test.ts tests/interface.test.ts`
- `pnpm build`
- `pnpm type-lint`
- `pnpm bench:jcodemunch-comparison -- --runs 3 --output <ignored-path>`
- `pnpm check:version-bump --base origin/main`
- `pnpm verify:fast`
- `pnpm exec openspec validate improve-exact-source-parity --strict`

## Risks / Trade-offs

- [A positional compact row can drift from the decoder] -> Keep encoder and decoder together, round-trip complete Unicode and batched fixtures, and reject malformed rows.
- [An error string could contain a target implementation fragment] -> Require a structurally successful response before checking source fields.
- [Canonical-id parsing becomes coupled to jCodeMunch's documented compact encoding] -> Limit parsing to the benchmark adapter, validate its header/table structure, and fail closed on unknown encodings.
- [One corpus overstates general savings] -> Report exact-source response savings separately, retain three-run evidence, and avoid general winner claims.

## Migration Plan

Ship as an additive MCP input option. Existing clients continue receiving ordinary JSON. Compact-aware clients can opt in immediately; `auto` remains conservative. Rollback is removal of the new `get_symbol_source` compact selection while leaving the engine result and default JSON untouched.
