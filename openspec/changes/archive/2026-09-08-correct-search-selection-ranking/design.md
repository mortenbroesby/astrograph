## Context

See `proposal.md` for motivation and
`specs/agent-retrieval-efficiency/spec.md` for the observable contract.
`loadSymbolRows` currently asks FTS for 400 rows, filters `filePattern` only
afterward, intersects lexical SQL matches with a non-empty FTS result, and
sorts BM25 before the established heuristic score. The FTS table starts with
two `UNINDEXED` columns, so the four supplied weights do not describe the four
searchable text columns.

## Goals / Non-Goals

**Goals:**

- Correct candidate completeness and ordering in the existing
  `search_symbols` path.
- Reuse the existing matcher, SQLite/FTS5 index, heuristic weights, tokenizer,
  and benchmark conventions.
- Leave one focused fixture that fails for each proven defect and records the
  required before/after evidence.

**Non-Goals:**

- Change public request or response shapes, ranking configuration, persisted
  schema, daemon behavior, or other retrieval tools.
- Add semantic search, embeddings, another encoding, dependency, or ranking
  abstraction.
- Recover the stale retrieval-quality branch wholesale.

## Decisions

### Supply weights for the complete FTS column order

Use the existing column order from `src/storage-schema.ts` and pass weights for
all columns: zero for the two identity columns, the intended weights for name,
qualified name, signature, and summary, then zero for file path and kind. This
keeps the current priorities while making them target the intended text.

Changing the schema to reorder columns was rejected because it would require a
storage migration for a query-only correction.

### Page scoped FTS candidates before accepting the bound

Read deterministic BM25-ordered FTS pages, apply the existing
`matchesFilePattern` semantics, and stop after 400 in-scope candidates or FTS
exhaustion. Language and kind remain SQL predicates before paging.

Translating picomatch patterns into SQL was rejected because it would create a
second, observably different scope language. Expanding the fixed limit was
rejected because it only moves the correctness boundary.

### Merge FTS evidence into lexical candidates instead of intersecting

Load scoped lexical candidates with the existing query-term rules, merge the
scoped FTS rows by symbol ID, and retain the optional BM25 score on matching
rows. This preserves substring and other heuristic matches that FTS token
selection can omit without inventing a new fallback path.

Returning only FTS rows when any exist was rejected because that is the current
recall defect. Running fallback only when FTS is empty was rejected for the same
reason.

### Sort heuristic evidence before BM25

Use the existing `scoreSymbolRow` result as the primary ordering key. Use BM25
only after equal heuristic scores, followed by the existing exported, path,
line, and name keys. This makes exact-name and configured heuristic behavior
authoritative while retaining deterministic full-text evidence.

Adding a second scoring model or normalizing BM25 into the configurable score
was rejected because no benchmark yet justifies another tuning surface.

### Prove behavior at the public engine boundary

Extend `tests/engine-behavior.test.ts` with one compact fixture covering more
than 400 unscoped decoys, a scoped target, a lexical-only candidate, an exact
name, and weaker full-text competitors. Record target recall,
first-relevant rank, false positives, scoped recall, exact tokenizer tokens,
and elapsed retrieval time in a source-free review or benchmark result.

Compatibility-sensitive files are `src/retrieval.ts`,
`src/storage-schema.ts` (read-only contract reference),
`tests/engine-behavior.test.ts`, and the existing
`agent-retrieval-efficiency` specification. Verification commands are:

- `pnpm exec vitest run tests/engine-behavior.test.ts -t "selection and ranking"`
- `pnpm build`
- `pnpm type-lint`
- `pnpm check:version-bump --base origin/main`
- `openspec validate correct-search-selection-ranking --strict`
- `pnpm verify:fast`

## Risks / Trade-offs

- **Risk:** Paging a broad FTS result to satisfy a narrow pattern increases
  query time. **Mitigation:** stop at 400 in-scope rows, retain deterministic
  page sizes, and measure scoped latency.
- **Risk:** Unioning lexical and FTS candidates increases the in-memory set.
  **Mitigation:** reuse the already-supported lexical query and measure result
  count, tokens, and latency before adding any further bound.
- **Risk:** Reordering exposes latent expectations that BM25 always wins.
  **Mitigation:** characterize current exact-name and configured heuristic
  behavior, then assert the public ordering contract explicitly.

## Migration Plan

No data migration is required. Ship as a patch-class retrieval correction,
verify the packed artifact and exact-head CI, and rerun the pinned comparison.
Rollback is a normal revert; existing indexes remain compatible because the
schema and stored rows do not change.
