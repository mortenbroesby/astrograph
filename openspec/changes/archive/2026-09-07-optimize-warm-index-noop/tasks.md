## 1. Establish the Characterized Boundary

- [x] 1.1 Run the focused ignored-file, incremental refresh, checkout-switch, Git-unavailable, size-limit, and repository-boundary tests before editing; verify the current behavior is green.
- [x] 1.2 Record the direct 217-file phase profile and existing three-run jCodeMunch comparison as the before baseline; verify warm work reports zero parsed files and the dominant phase is analysis.

## 2. Remove the Redundant Work

- [x] 2.1 Remove only the repeated private-reader Git ignore checks in `src/storage.ts`; verify language validation, realpath containment, discovery filtering, and focused-refresh filtering remain present.
- [x] 2.2 Re-run the focused indexing/freshness tests and verify ignored files, no-op reuse, edits, deletes, checkout switches, Git-unavailable mode, size limits, and boundary rejection remain green.

## 3. Measure Apples to Apples

- [x] 3.1 Re-run the direct phase profile on an equivalent clean repository copy; verify zero parsed files, unchanged reuse counts, and a material reduction in warm analysis time.
- [x] 3.2 Run three isolated matched Astrograph/jCodeMunch comparison samples on one exact commit; verify every run succeeds and update `docs/reviews/jcodemunch-comparison-2026-09-06.md` with source-free before/after warm-index medians and the candidate SHA.

## 4. Verify and Deliver

- [x] 4.1 Apply the release-decision workflow, update the package version when required, and verify `pnpm check:version-bump --base origin/main` passes.
- [x] 4.2 Run `pnpm verify:fast` and `pnpm exec openspec validate optimize-warm-index-noop --strict`; verify the minimal diff contains no unrelated changes or secrets.
- [x] 4.3 Commit and push the implementation branch, verify the remote SHA and exact-head required CI, merge through GitHub, then verify `origin/main` and main CI at the exact merge commit.
- [x] 4.4 Sync or archive the completed OpenSpec change only after all implementation and delivery evidence is green.
