# Windows Git Discovery and Fallback Delivery Checklist

> **Story:** 4 of the [Remaining Delivery Epic](./3_remaining-delivery-epic.md)
>
> **Status:** Deferred — implement portable Git-path identity and fallback
> regression coverage here. Story 7 owns native `windows-latest` execution.

**Goal:** Support Windows Git and Git Bash enrichment without making Git a
requirement for ordinary indexing.

**Architecture:** Retain the bounded `execFile("git", args, { shell: false })`
probe and optional-Git fallback. Compare Git directory paths with the
host-native `path.relative` semantics rather than string equality so Windows
drive-letter and case normalization do not turn an ordinary checkout into a
linked worktree. Keep native Windows proof in Story 7; do not add a shell or
Git Bash wrapper.

**Tech Stack:** TypeScript, Node.js 22 `child_process` and `path`, Vitest,
pnpm, Git for Windows, and GitHub Actions.

## Task 1: Establish the current contract

**Files:**

- Inspect: `src/git-checkout.ts`
- Test: `tests/git-checkout.test.ts`

- [x] Run `pnpm exec vitest run tests/git-checkout.test.ts`.
- [x] Confirm the default runner uses `execFile` with an argument array,
  `shell: false`, a timeout, and bounded output.
- [x] Confirm named branch, detached HEAD, linked worktree, missing Git, and
  non-Git fallback already have focused mocked-probe coverage.

Expected: Git remains optional enrichment and no existing probe scenario
regresses.

## Task 2: Make Git-directory identity case-safe on Windows

**Files:**

- Modify: `src/git-checkout.ts`
- Test: `tests/git-checkout.test.ts`

- [x] Replace string equality of resolved Git and common-Git directories with
  a host-native relative-path equivalence check.
- [x] Keep path resolution and command execution bounded; do not add shell
  interpolation or change fallback modes.
- [x] Add `path.win32` fixtures proving case-only drive-path variation is the
  same checkout and a distinct worktree path remains distinct.
- [x] Run `pnpm exec vitest run tests/git-checkout.test.ts`.

Expected: Git for Windows path casing cannot falsely classify a normal checkout
as a linked worktree.

## Task 3: Hand off native Windows proof without blocking Story 4

**Files:**

- Update: `specs/implementation/planned/3_remaining-delivery-epic.md`
- Update: this checklist

- [x] Give Story 7 the exact command:
  `pnpm exec vitest run tests/git-checkout.test.ts` on `windows-latest`.
- [x] Require Windows Git/Git Bash named-branch, detached-HEAD, linked-
  worktree, unavailable-Git, and non-Git fallback evidence before claiming
  Windows support.

Expected: the current story remains independently executable while Story 7
provides the native runner proof.

## Verification and Commit Checkpoint

- [x] Run `git diff --check`.
- [x] Run `pnpm type-lint`.
- [x] Run `pnpm check:version-bump` after the planned version increment.
- [x] Commit with `fix: compare Git paths portably`.
- [ ] Push the epic branch, open a PR, record automated review, and merge only
  after required CI succeeds.
