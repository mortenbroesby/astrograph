## Context

See `proposal.md`. `listSupportedFiles` already validates supported languages, include/exclude rules, file size, and Git ignore state in one discovery pass. `refreshIndexedFilePath` performs the same validation for focused refreshes. Both paths then call `analyzeFileIndexResult`, whose metadata and content readers repeat synchronous `git check-ignore` subprocesses for each file.

The current direct profile on a clean 217-file copy records a 6,537 ms warm no-op refresh: 51 ms discovery, 6,398 ms analysis, 31 ms persistence, and 54 ms finalization, with 217 reused files and zero parsed files.

## Goals / Non-Goals

**Goals:**

- Eliminate the repeated Git subprocesses from the already-validated indexing path.
- Keep every existing freshness and path-safety result unchanged.
- Demonstrate the gain with equivalent built-in profile and matched benchmark runs.

**Non-Goals:**

- Add a fast-path cache, Git-state heuristic, watcher dependency, or new configuration.
- Skip filesystem metadata checks or change cold parsing, persistence, finalization, daemon, or MCP behavior.

## Decisions

### Remove only the redundant ignore checks

Delete the `isGitIgnored` calls from the private metadata/content readers used after validation. Keep language validation and `assertInsideRepoRoot`, including realpath-based symlink containment.

This is smaller and safer than adding an `alreadyValidated` flag or a second unchecked reader. A repository snapshot cache or Git-HEAD shortcut was rejected because uncommitted edits and filesystem changes must remain visible.

### Reuse existing correctness coverage

Use the focused indexing tests that already characterize ignored files, unchanged reuse, edits, deletes, checkout switches, Git-unavailable mode, size limits, and repository-boundary rejection. Do not add a test-only hook merely to count subprocesses; the existing phase profiler and benchmark directly prove their removal's performance effect.

### Compare equivalent medians

Re-run the direct phase profile and three matched jCodeMunch comparison samples against the same repository and settings. Update `docs/reviews/jcodemunch-comparison-2026-09-06.md` with before/after warm timings, exact candidate SHA, and unchanged correctness counts. Raw source-bearing evidence remains ignored.

Compatibility-sensitive files and checks:

- `src/storage.ts`
- `tests/engine-behavior.test.ts`
- `bench/scripts/jcodemunch-comparison.mjs` as the unchanged measurement harness
- `pnpm exec vitest run tests/engine-behavior.test.ts -t "respects .gitignore|reports parsed, reused, and removed|checkout switch|Git becomes unavailable"`
- `pnpm bench:jcodemunch-comparison -- --runs 3 --output <ignored-path>`
- `pnpm check:version-bump --base origin/main`
- `pnpm verify:fast`
- `pnpm exec openspec validate optimize-warm-index-noop --strict`

## Risks / Trade-offs

- [A future caller reaches the private readers without validation] -> Keep them private, trace both callers in review, and retain language plus realpath containment checks at the readers.
- [An ignored path enters during a focused refresh] -> Preserve the existing `refreshIndexedFilePath` ignore gate and its removal behavior.
- [Timing noise overstates the gain] -> Use equivalent three-sample medians and phase counts, not a single wall-clock claim.

## Migration Plan

Ship as an internal performance patch with the normal version-bump and release decision. Rollback is the one-file restoration of the redundant ignore checks; no stored data or configuration migration is involved.
