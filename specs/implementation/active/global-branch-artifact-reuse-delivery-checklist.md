# Global + Branch-Aware Artifact Reuse Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](./high-impact-followups-epic.md), Story 1
>
> **Status:** Active — discovery and decision gate first. Check each item only
> after its linked command or artifact proves completion.

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

- [ ] Run the focused baseline:

  ```bash
  pnpm type-lint
  pnpm exec vitest run tests/incremental-cache.test.ts tests/git-checkout.test.ts tests/engine-behavior.test.ts tests/watch-backend.test.ts
  ```

  Expected: all commands exit `0` before any source change.

- [ ] Map which tables/files are immutable artifacts versus repository- or
  checkout-local mutable state. Record the source paths and the exact
  fingerprint inputs currently used.

- [ ] Record the existing global-cache root, canonical repository isolation,
  branch/worktree mapping, and diagnostics boundaries. Identify any direct
  path or connection-cache assumptions that would prevent safe reuse.

## Task 2: Measure the Opportunity

**Files:**
- Create or modify only if needed: `tests/incremental-cache.test.ts`, a focused
  fixture under `tests/fixtures/`, and this checklist

- [ ] Create one deterministic fixture representing repeated immutable content
  across a branch switch or linked worktree; it must retain distinct mutable
  path/dependency state.

- [ ] Capture baseline analysis count/time and artifact/storage count for:
  cold index, same-content branch/worktree index, content change, parser or
  config change, and unrelated repository content.

- [ ] Check in the measurements and decide whether duplicate analysis/storage
  is material enough to justify a shared immutable-artifact layer. If not,
  check this item, record the evidence, mark Task 4 deferred, and move to the
  next unblocked epic story.

## Task 3: Record the Storage Decision

**Files:**
- Modify: `specs/architecture/adrs.md`
- Create: an ADR only if the project ADR index requires a separate file
- Modify: this checklist and `high-impact-followups-epic.md`

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
