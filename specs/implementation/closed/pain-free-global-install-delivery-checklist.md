# Pain-Free Global Install Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](./high-impact-followups-epic.md), Story 7
>
> **Status:** Complete — merged as PR #28 after exact-head Fast required
> checks and Windows compatibility/package smoke passed.

**Goal:** A user installs Astrograph for Codex once, then indexes and queries
unconfigured repositories through the user-private global cache without any
repository-local Astrograph setup.

**Architecture:** Reuse `setupGlobalForCodex()` and the existing global config
resolver. Add one disposable-home integration test that exercises the actual
global config and cache selection through two independent repositories. Do not
add a daemon, shared mutable index, new configuration format, or client support
belonging to the separate Copilot CLI story.

**Tech Stack:** TypeScript, Node.js 22 LTS, Vitest, SQLite, existing installer
and global storage contracts.

---

## Task 1: Establish the Global-Only Baseline

**Files:**
- Inspect: `src/scripts/install.ts`, `src/config.ts`, `src/storage.ts`
- Test: `tests/engine-contract.test.ts`
- Record: this checklist

- [x] Verify that `setupGlobalForCodex()` writes only user-level Codex and
  Astrograph config, sets `storageLocation: "global"`, and is idempotent.
  Existing contract coverage proves marker-owned user config writes and leaves
  unrelated Codex config intact.

- [x] Verify the storage boundary: global cache directories are rooted under
  `resolveGlobalCacheRoot()/repos/<canonical-repository-hash>`, preserving
  repository isolation while avoiding repo-local state.

- [x] Add and pass a disposable-home, two-repository integration test. It must
  run global setup once, index and query each repository, prove distinct global
  storage directories, and prove neither repository receives `.astrograph`,
  `astrograph.config.*`, or client configuration. Focused CI-mode contract test
  passed in 1.67 seconds.

## Task 2: Document the Normal Path

**Files:**
- Modify: `README.md`
- Modify: `docs/reference/cli.md`
- Modify: `docs/guides/troubleshooting.md`

- [x] Make one global-install command the primary Codex path; state that normal
  repository use needs no `init`, repo-local config, or cache-directory choice.

- [x] Describe only the user-level locations created by global installation and
  point users to `cache status` and `doctor` for recovery rather than manual
  cache edits.

- [x] Keep repository-local `init` documented as an explicit workspace-scoped
  alternative, not a prerequisite for globally installed Codex use.

## Task 3: Validate and Hand Off

- [x] Run the focused contract test, `CI=1 pnpm type-lint`, `pnpm
  test:package-bin`, `pnpm check:version-bump`, and `git diff --check`.
  The full contract file passed 43/43 tests; the packed-package smoke completed
  global Codex install, two repository indexes, both cache-status calls, and a
  retrieval query successfully.

- [x] Diagnose the exact-head Windows CI failure before merging. The large-file
  tree-sitter recovery test reached its 15-second default timeout and left its
  SQLite fixture locked during teardown. Give that deliberately large recovery
  case a 45-second timeout; the focused test then passed locally in 1.78
  seconds.

- [x] Re-run the Windows compatibility test matrix and package smoke on the
  repaired exact PR head. PR #28 commit `2e25325` passed Fast required checks
  and Windows compatibility/package smoke in CI run `29874226582`.

- [x] Commit source/test/doc changes, push a PR, and merge only after the exact
  head passes Fast required checks and Windows compatibility/package smoke.
  Squash-merged as PR #28 at `b8f81b7`.
