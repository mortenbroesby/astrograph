# Global + Branch-Aware Artifact Reuse Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](./4_high-impact-followups-epic.md), Story 1
>
> **Status:** Deferred — Task 2 found no material benefit on the representative
> fixture. Preserve this evidence and reopen only with a larger-corpus signal.

**Goal:** Decide and, only if justified, implement immutable-analysis reuse
across global storage and branch/worktree indexing without sharing mutable
repository or checkout state.

**Architecture:** Keep mutable SQLite data scoped to one canonical repository
and checkout. A potential reusable artifact is complete-fingerprint keyed and
contains only immutable analysis facts. This delivery may intentionally make
breaking internal or public changes; backward compatibility is not an
acceptance criterion for this selected work.

**Tech Stack:** TypeScript, Node.js 22 LTS, SQLite WAL, pnpm, Vitest, existing
global-storage and branch-aware indexing modules.

---

## Task 1: Establish the Current Boundary

**Files:**
- Inspect: `src/storage.ts`, `src/incremental-cache.ts`, `src/indexing.ts`,
  `src/index-refresh.ts`, `src/git-checkout.ts`
- Inspect tests: `tests/incremental-cache.test.ts`, `tests/git-checkout.test.ts`,
  `tests/engine-behavior.test.ts`, `tests/watch-backend.test.ts`
- Record: this checklist

- [x] Run the focused baseline:

  ```bash
  pnpm type-lint
  pnpm exec vitest run tests/incremental-cache.test.ts tests/git-checkout.test.ts tests/engine-behavior.test.ts tests/watch-backend.test.ts
  ```

  Evidence: `pnpm type-lint`, `incremental-cache` (7), `git-checkout` (4),
  `watch-backend` (5), and `engine-behavior` (70 passed, 1 skipped) all exit
  `0`. The engine suite requires `CI=1` in this environment to avoid TTY
  reporter control-output noise; it completed in 124.7 seconds.

- [x] Map which tables/files are immutable artifacts versus repository- or
  checkout-local mutable state. `analysis_artifacts` in
  `src/storage-schema.ts` stores parse output, summaries, symbols, and import
  facts; `checkouts`, `checkout_path_mappings`, and
  `checkout_dependencies` retain mutable checkout identity, paths, and edges.
  `src/incremental-cache.ts` fingerprints content hash, language, parser
  version, summary strategy, extraction configuration, dependency-analysis
  version, and schema version.

- [x] Record the existing global-cache root, canonical repository isolation,
  branch/worktree mapping, and diagnostics boundaries. `resolveEnginePaths()`
  hashes each canonical repository root into `global/repos/<hash>`, so copied
  repositories and linked worktrees receive different databases and duplicate
  identical artifacts. `src/storage.ts` caches database connections by that
  database path, then materializes checkout-local mappings and edges after an
  artifact lookup. Diagnostics remain tied to the same per-repository database.

## Task 2: Measure the Opportunity

**Files:**
- Create or modify only if needed: `tests/incremental-cache.test.ts`, a focused
  fixture under `tests/fixtures/`, and this checklist

- [x] Create one deterministic fixture representing repeated immutable content
  across a branch switch or linked worktree; it must retain distinct mutable
  path/dependency state. `tests/engine-behavior.test.ts` now indexes two
  equivalent global repositories and proves separate databases each retain the
  same immutable-artifact count.

- [x] Capture baseline analysis count/time and artifact/storage count for:
  cold index, same-content branch/worktree index, content change, parser or
  config change, and unrelated repository content. Baseline equivalent-global
  fixture: two source files produce two artifacts in each database (four total)
  and the two-index run takes 2.044 seconds locally; the second repository does
  not reuse the first repository's artifacts. Content/parser/config changes are
  already fingerprint inputs and therefore miss; unrelated repositories are
  isolated by their canonical-root storage hash.

- [x] Check in the measurements and decide whether duplicate analysis/storage
  is material enough to justify a shared immutable-artifact layer. **Deferred:**
  this small representative fixture is only 2.044 seconds for both indexes;
  that is insufficient evidence to justify a new cross-repository storage,
  migration, retention, and locking layer. Task 4 is intentionally deferred;
  select Story 2 next.

## Task 3: Record the Storage Decision

**Deferred:** The Task 2 measurement did not justify an implementation, so an
ADR would only memorialize a speculative design. Revisit this task only after a
larger corpus demonstrates material repeated-analysis cost.

**Files:**
- Modify: `specs/architecture/adrs.md`
- Create: an ADR only if the project ADR index requires a separate file
- Modify: this checklist and `4_high-impact-followups-epic.md`

- [ ] Write an ADR that fixes the selected ownership boundary, complete
  fingerprint, retention/eviction, migration/rebuild behavior, locking, and
  privacy constraints.

- [ ] Prove the design does not share SQLite indexes, event logs, locks,
  diagnostics, path mappings, dependency edges, or freshness records across
  repositories/checkouts.

- [ ] Confirm that no shared mutable index, daemon, network synchronization,
  source upload, or destructive MCP cache control is needed. If any is needed,
  defer Story 1 and start the next unblocked story.

## Task 4: Implement Validated Artifact Reuse

**Selection gate:** Tasks 1–3 are checked, the measurement is material, and
the ADR accepts immutable-only sharing.

**Deferred:** The Task 2 selection gate was not met. Do not implement this
layer until new evidence reopens Task 3.

**Likely files:** `src/storage-schema.ts`, `src/storage.ts`,
`src/storage-queries.ts`, `src/incremental-cache.ts`, `src/indexing.ts`,
`src/index-refresh.ts`, `src/diagnostics.ts`, and focused cache/engine/watch
tests. Update the API specs only if a public contract is changed.

- [ ] Add the smallest schema/storage layer that persists complete-fingerprint
  immutable artifacts independently of mutable repository and checkout data.

- [ ] Reuse an artifact only after every fingerprint input matches. Materialize
  fresh checkout-local paths, dependency edges, and freshness state on each
  hit; a miss uses the normal analysis path.

- [ ] Add explicit retention/eviction and migration/rebuild behavior from the
  ADR. Keep cleanup lock-aware and safe while indexing is active.

- [ ] Expose additive, privacy-safe diagnostics for hit/miss/fallback and never
  include source content in diagnostics.

## Task 5: Prove Isolation and Correctness

**Files:**
- Test: `tests/incremental-cache.test.ts`, `tests/git-checkout.test.ts`,
  `tests/engine-behavior.test.ts`, `tests/watch-backend.test.ts`

- [ ] Prove equal immutable content can reuse only the artifact while two
  repositories and two checkouts retain distinct indexes, mappings, events,
  locks, diagnostics, dependency edges, and freshness state.

- [ ] Prove changed content, parser/version/config changes, renamed files,
  changed imports/exports, corrupted metadata, unavailable Git, and concurrent
  cleanup/index activity safely miss, rebuild, or fall back.

- [ ] Re-run Task 2 measurements and record the observed analysis/storage gain
  alongside the correctness results.

## Task 6: Final Verification and Handoff

- [ ] Run:

  ```bash
  pnpm type-lint
  pnpm exec vitest run tests/incremental-cache.test.ts tests/git-checkout.test.ts tests/engine-behavior.test.ts tests/watch-backend.test.ts
  pnpm test:package-bin
  pnpm check:version-bump
  pnpm release:plan
  git diff --check
  ```

  Expected: all commands exit `0`; release plan is reviewed before any release
  dispatch.

- [ ] Commit the implementation and updated evidence intentionally. Do not
  merge until CI covers the exact commit as closely as the configured main
  workflow permits.

- [ ] Update this checklist, the active epic, indexes, and any affected API or
  architecture specs with measured evidence. Only then mark Story 1 complete
  or deferred and select the next story.
