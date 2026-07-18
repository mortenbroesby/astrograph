# Branch-Aware Incremental Index Delivery Checklist

> **Work in progress:** This checklist records execution evidence for the
> [Branch-Aware Incremental Index Epic](./branch-aware-incremental-index-epic.md).
> Do not start a later story until its dependencies and all tasks in the prior
> story are checked.

## Story 1: Immutable Artifact Schema

**Goal:** Add private storage for immutable analysis artifacts without changing
the public CLI, MCP, or library contracts.

- [x] Run baseline: `pnpm type-lint` and
  `pnpm exec vitest run tests/engine-behavior.test.ts tests/watch-backend.test.ts`.
- [x] Add `analysis_artifacts` schema with immutable identity fields and JSON
  payload columns for parse output, summaries, symbols, and import facts.
- [x] Add private TypeScript record types in `src/incremental-cache.ts`; do not
  add lookup or fingerprint behavior yet.
- [x] Add `tests/incremental-cache.test.ts` to prove initialization creates the
  private table and accepts a complete artifact payload.
- [x] Run focused tests: `pnpm exec vitest run tests/incremental-cache.test.ts
  tests/engine-behavior.test.ts`.
- [x] Run `pnpm type-lint` and `pnpm check:version-bump`; run `git diff --check`
  before committing.
- [x] Commit the Story 1 implementation as
  `feat: add immutable analysis artifact schema`.

**Evidence:** Baseline and focused Vitest commands passed on 2026-07-18;
`pnpm type-lint` and `pnpm check:version-bump` passed.

## Story 2: Fingerprint Contract

**Goal:** Define a deterministic, complete artifact identity that excludes
checkout and branch metadata.

- [x] Run baseline: `pnpm type-lint` and
  `pnpm exec vitest run tests/incremental-cache.test.ts`.
- [x] Add a typed fingerprint input containing the content hash, language,
  parser version, summary strategy, extraction-config fingerprint,
  dependency-analysis version, and storage-schema version.
- [x] Validate that every string field is non-empty and the schema version is a
  positive integer before building a key.
- [x] Build the key from a canonical ordered representation of only those
  identity fields; do not accept branch name, worktree path, or Git OID.
- [x] Extend `tests/incremental-cache.test.ts` for determinism, rejection of
  incomplete input, every-field invalidation, and ignored branch metadata.
- [x] Run focused tests, `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check`.
- [x] Commit the Story 2 implementation as
  `feat: add analysis artifact fingerprint contract`.

**Evidence:** Baseline and focused Vitest commands passed on 2026-07-18;
`pnpm type-lint`, `pnpm check:version-bump`, and `git diff --check` passed.

## Story 3: Storage Migration Safety

**Status:** Blocked by Story 1.

## Story 4: Optional Git Checkout Discovery

**Status:** Blocked by Story 1 planning sequence.

## Story 5: Checkout Mapping Lifecycle

**Status:** Blocked by Stories 2–4.

## Story 6: Artifact Reuse During Indexing

**Status:** Blocked by Stories 2, 3, and 5.

## Story 7: Checkout-Local Dependency Edge Refresh

**Status:** Blocked by Story 6.

## Story 8: Freshness Diagnostics and End-to-End Invalidation Proof

**Status:** Blocked by Stories 6–7.

## Story 9: Main Merge and Release

**Status:** Blocked by Story 8 and a successful CI run for the merged `main`
commit.
