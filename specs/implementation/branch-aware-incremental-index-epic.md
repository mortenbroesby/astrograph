# Branch-Aware Incremental Index Epic

> **Status:** Closed — implementation Stories 1–8 are complete. The remaining
> release-publication evidence is consolidated in the
> [Remaining Delivery Epic](./remaining-delivery-epic.md).
>
> **Design contract:** [Branch-Aware Incremental Index Mapping Plan](./branch-aware-incremental-index-plan.md)

**Goal:** Reuse unchanged analysis safely across Git branches and linked
worktrees, while ensuring the active checkout always has current paths,
dependencies, and freshness state.

**Architecture:** Persist immutable analysis artifacts by a complete content and
configuration fingerprint. Keep checkout identity and dependency resolution in
separate mutable mappings. Git metadata enriches diagnostics but never controls
cache identity or blocks ordinary filesystem indexing.

**Tech Stack:** TypeScript, SQLite, Node Git child processes, existing hashing
and filesystem scan helpers, and Vitest fixtures.

---

## Scope and Boundaries

This epic implements the design contract without Git mutations, remote access,
checkout switching, a public cache-management command, or retrieval-ranking
changes. A branch name, worktree path, or commit message is never an artifact
key. Each story is independently mergeable and must pass its verification before
the next dependent story begins.

Windows compatibility is planned separately in the
[Windows Platform Support Epic](./windows-platform-support-epic.md). Stories
that introduce filesystem or Git behavior must not add POSIX-shell assumptions.

Source-changing stories run `pnpm check:version-bump` before commit. The final
implementation story runs `pnpm release:plan` before the release workflow.

## Story Start Protocol

Before implementation begins on any story, expand that story into a checked
task list in its own follow-on implementation plan or the active delivery
checklist. The breakdown must name the exact files, baseline command, smallest
implementation tasks, focused tests, full verification, version-policy check,
and commit checkpoint. Do not mark the parent story complete until every child
task is checked and its verification evidence is recorded.

## Delivery Goal: Release After Main CI

For the final merge to `main`, release only after the CI run for that merged
commit succeeds. Then dispatch the existing guarded main-only release workflow
with `release_mode=apply`, verify its successful completion, and record the
published version, tag, and Actions run URL in the active delivery checklist.
Do not release from a feature branch or after a failed, cancelled, or stale CI
run.

## Story Map

| Order | Story | Depends on | Outcome |
| --- | --- | --- | --- |
| 1 | Immutable Artifact Schema | None | Private storage persists fingerprint-keyed analysis artifacts. |
| 2 | Fingerprint Contract | Story 1 | Reuse identity is complete and branch-independent. |
| 3 | Storage Migration Safety | Story 1 | Incompatible storage is migrated or safely rebuilt. |
| 4 | Optional Git Checkout Discovery | None | Git states and Git failure are classified safely. |
| 5 | Checkout Mapping Lifecycle | Stories 2–4 | Each checkout owns distinct mutable path mappings. |
| 6 | Artifact Reuse During Indexing | Stories 2, 3, 5 | Indexing reuses only validated artifacts. |
| 7 | Dependency Edge Refresh | Story 6 | Checkout-local dependency edges remain correct after reuse. |
| 8 | Freshness Diagnostics and End-to-End Proof | Stories 6–7 | Fallback state is visible and invalidations are proved. |
| 9 | Main Merge and Release | Story 8 and successful main CI | The merged implementation is released through the guarded workflow. |

## Story 1: Immutable Artifact Schema

**Goal:** Add private artifact storage without changing public CLI, MCP, or
library output.

**Files:** `src/storage-schema.ts`, `src/storage-queries.ts`,
`src/repo-meta.ts`, `src/incremental-cache.ts`, and
`tests/incremental-cache.test.ts`.

- [ ] Artifact rows contain parse output, summaries, symbols, and import facts.
- [ ] The key is immutable and excludes branch name, checkout path, and Git OID.
- [ ] Tables are private; public contracts do not change.

**Verification:** `pnpm exec vitest run tests/incremental-cache.test.ts` and
`pnpm type-lint` exit `0`.

## Story 2: Fingerprint Contract

**Goal:** Define one complete, deterministic identity for reusable analysis.

**Files:** `src/incremental-cache.ts`, existing hash/config helpers, and
`tests/incremental-cache.test.ts`.

- [ ] The key includes content hash, parser/language version, summary strategy,
  extraction configuration, dependency-analysis version, and storage version.
- [ ] Missing inputs reject reuse rather than weaken identity.
- [ ] Equal valid inputs yield equal keys; any identity change yields a new key.

**Verification:** Focused cache tests prove determinism, rejection, and
branch-name independence.

## Story 3: Storage Migration Safety

**Goal:** Preserve guarded storage-version behavior when private tables are
introduced or become incompatible.

**Files:** `src/storage-schema.ts`, `src/storage.ts`, migration helpers, and
storage lifecycle tests.

- [ ] A compatible database gains the private schema predictably.
- [ ] An incompatible schema is migrated or rebuilt through the guarded policy.
- [ ] Corrupt or missing mapping metadata falls back to a filesystem scan.

**Verification:** Focused migration tests, `pnpm type-lint`, and
`pnpm check:version-bump` exit `0`.

## Story 4: Optional Git Checkout Discovery

**Goal:** Discover checkout context without making Git a dependency of indexing.

**Files:** `src/git-checkout.ts`, `src/config.ts`, `tests/git-checkout.test.ts`.

- [ ] Bounded, non-mutating probes identify named branches, detached HEAD, and
  linked worktrees when Git is available.
- [ ] Non-Git directories and failed Git use a filesystem fallback with a
  non-fatal diagnostic reason.
- [ ] No Git result becomes an artifact lookup key.

**Verification:** Fixtures cover named branch, detached HEAD, non-Git,
failed-Git, and linked-worktree states.

## Story 5: Checkout Mapping Lifecycle

**Goal:** Give every canonical checkout its own mutable view of paths and state,
even when it shares immutable analysis artifacts.

**Files:** `src/storage.ts`, `src/storage-queries.ts`, `src/git-checkout.ts`,
and `tests/git-checkout.test.ts`.

- [ ] Checkout IDs are persistent and distinct for canonical worktree roots.
- [ ] Mappings record normalized relative paths, artifact keys, observed state,
  and optional Git observations.
- [ ] Identical content in two worktrees can share one artifact while mappings
  remain independent.

**Verification:** Multi-worktree fixtures prove shared artifacts and distinct
mappings.

## Story 6: Artifact Reuse During Indexing

**Goal:** Make reuse available to folder, single-file, and watch refresh paths
only after full-fingerprint validation.

**Files:** `src/indexing.ts`, `src/index-refresh.ts`, `src/storage.ts`, and
`tests/engine-behavior.test.ts` / `tests/watch-backend.test.ts`.

- [ ] A hit materializes checkout-local file and symbol rows without reanalysis.
- [ ] A miss performs ordinary analysis and atomically persists its artifact.
- [ ] Equal branch names with different content cannot reuse an artifact.

**Verification:** Folder, file, and watch tests cover cache-hit and miss paths.

## Story 7: Checkout-Local Dependency Edge Refresh

**Goal:** Re-resolve dependencies in the active checkout so reused analysis
never preserves stale edges.

**Files:** `src/indexing.ts`, `src/index-refresh.ts`, storage query helpers,
and engine/watch tests.

- [ ] Artifact import facts resolve into dependency edges for the current
  checkout only.
- [ ] A rename reuses valid analysis but rebuilds edges for old and new paths.
- [ ] Changed import targets or exports refresh direct edges and graph freshness.

**Verification:** Fixtures cover rename, changed target/export, and path-based
resolution differences between worktrees.

## Story 8: Freshness Diagnostics and End-to-End Invalidation Proof

**Goal:** Keep fallback behavior legible and prove every reuse boundary before
the epic is released.

**Files:** `src/diagnostics.ts`, indexing/refresh diagnostics integration, and
all incremental cache, Git checkout, engine behavior, and watch-backend tests.

- [ ] Diagnostics distinguish checkout enrichment from non-fatal fallback.
- [ ] Astrograph never reports `fresh` until mappings and edges represent the
  current filesystem state.
- [ ] Tests cover worktree reuse, changed same-name branches, rename,
  config/export changes, fallback, corrupt mappings, and storage mismatch.

**Verification and release checkpoint:** Run the focused Vitest suite for
`incremental-cache`, `git-checkout`, `engine-behavior`, and `watch-backend`,
then run `pnpm type-lint`, `pnpm check:version-bump`, `pnpm release:plan`, and
`git diff --check`. Every command must exit `0`.

## Story 9: Main Merge and Release

**Goal:** Publish the completed epic only after the merge-to-`main` CI run is
successful.

**Files:** The active delivery checklist and the existing GitHub Actions release
workflow; no workflow change is implied by this story.

- [ ] The completed implementation is merged to `main`.
- [ ] The CI run for that exact merge commit succeeds.
- [ ] Dispatch the guarded release workflow with `release_mode=apply` from
  `main`.
- [ ] Verify the release run succeeds and record the npm version, Git tag, and
  Actions run URL in the delivery checklist.

**Verification:** Confirm the successful main CI run and the subsequent
successful release run before declaring the epic complete.

## Completion Checklist

- [ ] Stories 1–3 establish a safe artifact store and migration boundary.
- [ ] Stories 4–5 establish optional Git enrichment and isolated mappings.
- [ ] Stories 6–7 integrate validated reuse with dependency-safe refresh.
- [ ] Story 8 proves freshness and fallback behavior end to end.
- [ ] Story 9 releases the successful main merge and records release evidence.
- [ ] The design plan, this epic, and implementation indexes reflect delivery.
