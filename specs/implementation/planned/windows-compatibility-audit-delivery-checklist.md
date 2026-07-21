# Windows Compatibility Audit Delivery Checklist

> **Epic:** [Remaining Delivery Epic](./remaining-delivery-epic.md), Story 2
>
> **Status:** Deferred — audit and documentation only. This story
> does not authorize platform-behavior changes; later Windows stories own
> remediation.

**Goal:** Inventory every concrete Windows-sensitive path, filesystem, Git,
child-process, package, and user-instruction assumption; distinguish existing
portable behavior from unproven behavior; and assign each finding to an exact
future file and assertion.

**Architecture:** Treat Node `path` and filesystem APIs, argument-array child
process execution, and Windows-runner evidence as the compatibility contract.
Git is optional enrichment. Do not infer Windows support from Linux tests;
record what is proved, what is portable by construction, and what needs a
Windows assertion.

**Tech Stack:** TypeScript, Node.js 22 LTS, pnpm, Vitest, SQLite, GitHub
Actions Windows runners, `@parcel/watcher`, Windows Git, Git Bash, PowerShell,
and `cmd.exe`.

---

## Task 1: Establish a Focused Baseline

**Files:** `package.json`, `.github/workflows/ci.yml`, `tests/filesystem-scan.test.ts`,
`tests/git-checkout.test.ts`, `tests/path-matcher.test.ts`, and
`tests/watch-backend.test.ts`.

- [x] Record the current Node engine and CI platform coverage.
- [x] Run `pnpm type-lint` and the focused filesystem/Git/path/watch Vitest
  suites; record outcomes.
- [x] Identify the existing tests that already exercise separator normalization,
  path escape prevention, optional Git fallback, and watcher event handling.

**Expected outcome:** The audit starts from an explicit Linux-only baseline and
does not overstate platform support.

## Task 2: Inventory Filesystem, Storage, and Path Boundaries

**Files:** `src/config.ts`, `src/filesystem-scan.ts`, `src/storage.ts`,
`src/checkout-mapping.ts`, `src/watch-backend.ts`, `src/path-matcher.ts`,
`src/repo-meta.ts`, and their focused tests.

- [x] Record every use of path normalization, canonical roots, relative paths,
  directory traversal, SQLite sidecars, rename/delete cleanup, and watch event
  conversion that affects Windows.
- [x] Classify each boundary as portable by construction, already tested with
  platform-neutral fixtures, or requiring a Windows-runner assertion.
- [x] For every unproven or incorrect boundary, name its future story, target
  files, and focused fixture or Windows-runner command.

**Expected outcome:** Later filesystem/storage work can proceed without another
broad path search.

## Task 3: Inventory Git and Child-Process Boundaries

**Files:** `src/git-checkout.ts`, `src/filesystem-scan.ts`,
`src/live-search.ts`, `src/scripts/git-smart-refresh.ts`,
`src/scripts/smoke-package-bin.ts`, `src/scripts/run-vitest.ts`, and their
focused tests.

- [x] Record every Git, ripgrep, worker, package-bin, and test-runner process
  invocation, including command resolution, argument shape, shell use, output
  bounds, and unavailable-tool fallback.
- [x] Verify whether Git Bash/Windows Git and standard Node terminals are
  treated as optional enrichment rather than an indexing prerequisite.
- [x] Assign each unproven Windows process path to a later story and assertion.

**Expected outcome:** Later Git and CLI/MCP stories have a precise process-risk
map rather than a generic Windows checklist.

## Task 4: Inventory Public Instructions and Package Experience

**Files:** `README.md`, `docs/getting-started/*.md`, `docs/guides/*.md`,
`docs/reference/*.md`, `src/scripts/install.ts`, `src/astrograph.ts`, and
`tests/engine-contract.test.ts`.

- [x] Identify shell-specific commands or path examples visible to users.
- [x] Confirm the packed package invokes Node entry points without a POSIX shell
  wrapper; record the required Windows tarball smoke.
- [x] Record every incorrect or unproven user instruction with the exact future
  docs/source/test update.

**Expected outcome:** Windows support will be documented from tested behavior,
not inferred from generic POSIX examples.

## Task 5: Publish the Audit and Handoff Map

**Files:** Create `docs/reviews/windows-compatibility-audit-2026-07.md`; modify
`docs/README.md`, this checklist, the implementation indexes, and the epic.

- [x] Publish an evidence table covering each audited boundary and its status.
- [x] Limit findings to concrete defects or missing proof; label future
  considerations separately.
- [x] Update Stories 3–7 with the audit's target-file and verification handoff.
- [x] Run an automated `/review` pass over the documentation diff and resolve
  blocking findings before PR creation.

**Review evidence:** The automated pass confirmed the two defects have direct
source evidence and the remaining items are labeled as missing proof rather
than defects. No blocking documentation finding remained.

**Expected outcome:** The Windows epic has a checked, executable entry point;
no platform remediation begins in this audit story.

## Final Verification and Commit Checkpoint

- [x] Run `git diff --check`.
- [x] Run `find specs .skills -type f -name '*.md' -print`.
- [x] Manually verify the docs index link.
- [x] Decide release scope with `pnpm release:plan`; this audit-only story must
  not publish a package.
- [x] Update this checklist only after audit evidence and handoff mapping are
  complete.
- [ ] Before push, apply the repository's required alpha version increment and
  run `pnpm check:version-bump`.
