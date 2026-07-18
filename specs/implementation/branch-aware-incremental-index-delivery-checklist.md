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

**Goal:** Make the artifact schema an explicit schema-version migration and
preserve the guarded reset/fallback path for incompatible metadata.

- [x] Run baseline: `pnpm type-lint` and
  `pnpm exec vitest run tests/engine-behavior.test.ts tests/incremental-cache.test.ts`.
- [x] Raise the internal schema version and add an idempotent migration that
  creates the private `analysis_artifacts` table and its index.
- [x] Keep new databases and legacy databases on the same final schema version.
- [x] Extend legacy-schema coverage to verify the version, artifact table, and
  existing schema fields after diagnostics opens the database.
- [x] Add a focused test that incomplete artifact metadata cannot be used as a
  reusable record boundary; later indexing must therefore fall back to normal
  analysis until Story 6 integrates reuse.
- [x] Run focused tests, `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check`.
- [x] Commit the Story 3 implementation as
  `feat: migrate immutable analysis artifact storage`.

**Evidence:** Baseline and focused Vitest commands passed on 2026-07-18;
`pnpm type-lint`, `pnpm check:version-bump`, and `git diff --check` passed.

## Story 4: Optional Git Checkout Discovery

**Goal:** Probe Git checkout state with bounded, non-mutating commands while
leaving ordinary filesystem indexing fully independent of Git.

- [x] Run baseline: `pnpm type-lint` and
  `pnpm exec vitest run tests/engine-behavior.test.ts`.
- [x] Create `src/git-checkout.ts` with an injectable, bounded `execFile` probe
  for worktree root, HEAD OID, and symbolic branch ref; use `shell: false`.
- [x] Classify named branch, detached HEAD, linked worktree, non-Git, and
  unavailable-Git states without throwing for any fallback state.
- [x] Keep Git metadata out of artifact keys and existing repository-root
  identity; do not alter indexing behavior in this story.
- [x] Add `tests/git-checkout.test.ts` with deterministic fake command runners
  for every state and timeout/error fallback.
- [x] Run focused tests, `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check`.
- [x] Commit the Story 4 implementation as
  `feat: probe optional Git checkout metadata`.

**Evidence:** Focused Git, engine behavior, and interface Vitest commands
passed on 2026-07-18; `pnpm type-lint`, `pnpm check:version-bump`, and
`git diff --check` passed.

## Story 5: Checkout Mapping Lifecycle

**Goal:** Persist distinct checkout and checkout-path mappings that can point to
the same immutable artifact without using branch metadata as identity.

- [x] Run baseline: `pnpm type-lint` and focused incremental-cache/Git tests.
- [x] Add a schema migration for checkout records and per-checkout path mappings
  with canonical root plus a generated persistent checkout ID.
- [x] Implement private registration/upsert and lookup helpers that update Git
  observations but never use them to find a checkout or artifact.
- [x] Record normalized relative path, artifact key, content hash, size, mtime,
  and observation time per checkout-path mapping.
- [x] Add focused storage tests proving one artifact can have two independent
  worktree mappings and repeated registration preserves a checkout ID.
- [x] Run focused tests, `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check`.
- [x] Commit the Story 5 implementation as
  `feat: persist checkout artifact mappings`.

**Evidence:** Focused checkout mapping, cache, Git, engine, contract, and
interface Vitest commands passed on 2026-07-18; `pnpm type-lint`,
`pnpm check:version-bump`, and `git diff --check` passed.

## Story 6: Artifact Reuse During Indexing

**Goal:** Reuse an immutable full-analysis artifact on fingerprint match while
materializing fresh checkout-local file and symbol rows through the existing
persistence path.

- [x] Run baseline: focused engine, watch, cache, checkout-mapping, and Git
  tests plus `pnpm type-lint`.
- [x] Define versioned parser, extraction-config, and dependency-analysis
  fingerprints from actual indexing inputs; do not fabricate a cache hit from
  incomplete artifact JSON.
- [x] Add private artifact read/write helpers that atomically persist the full
  parsed analysis payload on a miss and reject malformed payloads on a hit.
- [x] Register the active checkout and update its path mapping after each
  persisted analysis result, including a cache hit.
- [x] Route folder, single-file, and watch refresh through the same reuse-aware
  analysis path; a miss retains ordinary file analysis and persistence.
- [x] Add fixtures proving a hit avoids analysis, a miss persists an artifact,
  and same branch label with changed content cannot reuse an artifact.
- [x] Run focused tests, `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check`.
- [x] Commit the Story 6 implementation as
  `feat: reuse immutable analysis artifacts during indexing`.

**Evidence:** Focused cache, checkout-mapping, Git, engine, and watch Vitest
commands passed on 2026-07-18; `pnpm type-lint`, `pnpm check:version-bump`, and
`git diff --check` passed.

## Story 7: Checkout-Local Dependency Edge Refresh

**Status:** Blocked by Story 6.

## Story 8: Freshness Diagnostics and End-to-End Invalidation Proof

**Status:** Blocked by Stories 6–7.

## Story 9: Main Merge and Release

**Status:** Blocked by Story 8 and a successful CI run for the merged `main`
commit.
