## 1. Close and record existing work

- [ ] 1.1 Sync the completed `hydrate-missing-repository-index` delta into the main spec and archive the change; verify `openspec list --json` no longer reports it as active and strict validation passes.
- [ ] 1.2 Add the P1 active-work manifest to `BACKLOG.md` with this goal, branch, worktree, base, current verification state, and next action; verify it remains the only live priority/workstream source.
- [ ] 1.3 Classify every current Astrograph worktree and stash as active, remotely recoverable, superseded, generated residue, or blocked/unknown; verify every dirty or unique item has an owner and recovery location before cleanup.

## 2. Add minimal performance visibility

- [ ] 2.1 Add failing focused tests for the opt-in config, sanitized bounded verbose report, index-phase profile, and top-level `astrograph report` routing; verify each fails for the intended missing behavior before production edits.
- [ ] 2.2 Add the default-off `observability.verbosePerformance` config and one daemon/direct index profile event using the existing event sink; verify config and storage runtime-mode tests pass and worker-child writes remain disabled.
- [ ] 2.3 Extend the existing report with bounded verbose operation/profile detail and route the top-level report command; verify default output compatibility, verbose privacy exclusions, failure/incomplete counts, and CLI boundary tests.
- [ ] 2.4 Document how to enable verbose capture and debug stderr in the managed dogfood runtime; verify examples use the supported top-level command and clearly state retention/privacy boundaries.

## 3. Establish the fast verification path

- [ ] 3.1 Define one concise repository command for the ordinary required PR signal and separate expensive package, daemon reliability, and performance gates; verify the command matches current required CI checks without broadening workflow triggers or cost.
- [ ] 3.2 Repair only stale assertions, build-order assumptions, and benchmark error handling that make the selected fast command false-red; verify the command passes twice from a built clean worktree and reports the failing layer on a controlled failure.

## 4. Run one bounded optimization pass

- [ ] 4.1 Capture three equivalent verbose runs of status, one hydration, one status retry, one search, and diagnostics against a fixed temporary checkout; record Node version, revision, storage mode, concurrency, median duration, retry/failure counts, and local event-log location.
- [ ] 4.2 If the profile proves one material actionable Astrograph phase dominates, add the smallest failing performance/behavior check and optimize only that phase; otherwise record a no-code result. Verify with the same three-run protocol and preserve correctness tests.

## 5. Make interrupted work remotely recoverable

- [ ] 5.1 Review `feat/retrieval-quality-roadmap`, separate unrelated/generated content, secret-check it, and commit/push coherent unfinished work with its verification gaps recorded in `BACKLOG.md`; verify the remote ref contains every retained unique file before changing the worktree.
- [ ] 5.2 Reconcile `feat/publishable-workflow-benchmark` with `feat/publishable-workflow-benchmark-v2`, commit/push the coherent surviving state on one named branch, and record superseded content; verify remote recovery before cleanup.
- [ ] 5.3 Review the dirty `agent/mcp-runtime-hygiene` checkout and the recent Copilot reliability stash independently; commit/push recoverable work on named branches or record a concrete unsafe/ownership blocker, then verify any removed stash has an equivalent remote commit.
- [ ] 5.4 Remove only clean, merged, or remotely recoverable Astrograph worktrees, then prune stale metadata; verify no unique file is lost, the remaining worktree list matches the active-work manifest, and the primary checkout is clean on current `origin/main`.
- [ ] 5.5 Update committed worktree policy so completed sessions perform the same preserve-push-record-remove sequence; verify a documented interrupted and completed example satisfies the repository-workflow scenarios.

## 6. Verify and deliver

- [ ] 6.1 Run focused tests, the authoritative fast command, build, `git diff --check`, and strict OpenSpec validation; verify all selected gates pass and separately report any expensive optional gate not run.
- [ ] 6.2 Use `.skills/release-decision/SKILL.md`, run `pnpm check:version-bump --base origin/main` for package behavior changes, commit and push the scoped branch, and verify the remote ref and exact-head CI when applicable.
- [ ] 6.3 Read back the enabled managed-runtime config and run the fresh-client bounded status/hydrate/search proof; verify the installed runtime emits the safe profile and the reported version/path match the intended artifact.
