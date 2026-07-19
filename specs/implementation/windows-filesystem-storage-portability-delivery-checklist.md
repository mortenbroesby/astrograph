# Windows Filesystem and Storage Portability Delivery Checklist

> **Story:** 3 of the [Remaining Delivery Epic](./remaining-delivery-epic.md)
>
> **Status:** In progress — portable regression coverage is the deliverable in
> this branch. Native Windows execution is deliberately handed to Story 7's
> scoped runner, not treated as a reason to block the remaining stories.

**Goal:** Preserve repository identity and `.astrograph` storage lifecycle for
Windows paths, drive letters, spaces, and supported case behavior.

**Architecture:** Keep Node's host-native `path`, `fs`, and `fs/promises`
semantics as the single path/cleanup implementation. Add regression coverage
for path-containing spaces and storage-reset sidecars; do not introduce a
parallel POSIX or Windows path layer. Story 7 will execute these same tests on
`windows-latest` and add the runner-specific assertions that cannot be proved
on a non-Windows host.

**Tech Stack:** TypeScript, Node.js 22, `node:path`, `node:fs/promises`,
better-sqlite3, Vitest, pnpm, and GitHub Actions.

## Task 1: Establish the portability baseline

**Files:**

- Inspect: `src/filesystem-scan.ts`, `src/checkout-mapping.ts`, `src/storage.ts`
- Test: `tests/filesystem-scan.test.ts`, `tests/engine-behavior.test.ts`

- [x] Run `pnpm exec vitest run tests/filesystem-scan.test.ts tests/engine-behavior.test.ts`.
- [x] Confirm path construction uses `node:path`; storage reset uses
  `fs.promises.rm({ recursive: true, force: true })`, not a shell command.
- [x] Confirm canonical roots are persisted as the resolved repository root.

Expected: the focused suites pass and no path/cleanup implementation needs a
platform-specific branch.

## Task 2: Cover repository roots containing spaces

**Files:**

- Modify: `tests/fixture-repo.ts`
- Modify: `tests/engine-behavior.test.ts`

- [ ] Add an explicit fixture-directory prefix option without changing existing
  fixture callers.
- [ ] Index a Git worktree whose root contains spaces; assert diagnostics and
  SQLite checkout identity use that canonical root and the `.astrograph`
  sidecar paths are constructed with `path.join`.
- [ ] Run `pnpm exec vitest run tests/engine-behavior.test.ts`.

Expected: a space-containing root indexes and resolves identically to existing
fixtures; no shell quoting is involved.

## Task 3: Prove storage reset removes SQLite sidecars through Node APIs

**Files:**

- Modify: `tests/engine-behavior.test.ts`

- [ ] Seed an incompatible storage-version directory in a spaced repository
  root with ordinary stale data plus `index.sqlite-wal` and `index.sqlite-shm`.
- [ ] Invoke diagnostics to trigger the existing version reset.
- [ ] Assert the stale files and SQLite sidecars are absent and the new storage
  version file is present.
- [ ] Run `pnpm exec vitest run tests/engine-behavior.test.ts`.

Expected: cleanup uses the existing Node `rm` lifecycle and is independent of
terminal shell syntax.

## Task 4: Hand off native Windows-only proof without blocking delivery

**Files:**

- Update: `specs/implementation/remaining-delivery-epic.md`
- Update: this checklist

- [ ] Give Story 7 the exact command:
  `pnpm exec vitest run tests/filesystem-scan.test.ts tests/engine-behavior.test.ts`
  on `windows-latest`.
- [ ] Require the Windows job to preserve the fixture-with-spaces and
  storage-sidecar assertions, thereby exercising host-native drive-letter and
  case behavior.

Expected: actual Windows execution is a scoped CI responsibility, while this
story remains independently executable now.

## Verification and Commit Checkpoint

- [ ] Run `git diff --check`.
- [ ] Run `pnpm type-lint`.
- [ ] Run `pnpm check:version-bump` after the planned version increment.
- [ ] Commit with `test: cover portable storage lifecycle`.
- [ ] Push the epic branch, open a PR, record automated review, and merge only
  after required CI succeeds.
