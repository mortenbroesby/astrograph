# Pre-v1 Cache and Codebase Cleanup Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](../active/high-impact-followups-epic.md), Story 9
>
> **Status:** Complete — merged as PR #30 after exact-head Fast and Windows
> compatibility/package-smoke CI passed.

**Goal:** Obsolete Astrograph caches are discarded without being read,
migrated, or preserved for compatibility. The public cache surface and docs no
longer advertise migration from the former repo-local cache model.

**Architecture:** Treat a missing, malformed, older, or newer storage-version
marker in a non-empty Astrograph-owned cache as obsolete. Clear only that
canonical storage directory, then create the current marker; never traverse
outside the resolved storage root. Remove the local-to-global copy/migration
API and CLI aliases rather than retaining a pre-v1 compatibility path. Keep
active-cache and symlink refusal safeguards for explicit global-cache removal
and pruning.

**Tech Stack:** TypeScript, Node.js 22 LTS, Vitest, SQLite, existing
storage/cache CLI contracts.

---

## Task 1: Inventory and Select the Bounded Cleanup

**Files:**
- Inspect: `src/storage.ts`, `src/cache-control.ts`, `src/astrograph.ts`,
  `src/cli.ts`, `src/index.ts`, `src/storage-schema.ts`
- Inspect: `tests/engine-contract.test.ts`, `tests/cli-boundary.test.ts`
- Modify: this checklist and the active epic/indexes

- [x] Map every storage compatibility path. Selected removals: missing-version
  backfill in `src/storage.ts`; global incompatible-version preservation;
  local-to-global `migrateLocalCache` API, CLI aliases, status field, tests,
  and documentation. Retain current-schema SQLite migrations because they are
  part of a single current cache format, not support for an obsolete cache.

- [x] Record the highest-impact non-cache smells found without widening scope:
  duplicate migration vocabulary across cache types/CLI/docs is removed with
  the obsolete migration feature. Defer broad parser, retrieval, and schema
  refactors because no specific correctness or maintainability defect was
  established in this inventory.

## Task 2: Delete Obsolete Cache Compatibility

**Files:**
- Modify: `src/storage.ts`
- Modify: `src/cache-control.ts`
- Modify: `src/index.ts`
- Modify: `src/cli.ts`
- Modify: `src/astrograph.ts`
- Test: `tests/engine-contract.test.ts`
- Test: `tests/cli-boundary.test.ts`

- [x] Replace version backfill and preservation with safe removal of the
  selected canonical Astrograph cache directory. An old cache must not be
  opened, indexed, copied, or migrated before removal; the replacement must
  receive the current version marker.

- [x] Remove local-to-global cache migration APIs, commands, status fields,
  aliases, and test fixtures. Keep explicit per-repository global removal and
  whole-cache pruning safety boundaries unchanged.

- [x] Add focused fixtures proving older/malformed/missing markers discard only
  Astrograph-owned cache data; active caches and paths outside the global root
  remain protected by the existing destructive-operation checks.

## Task 3: Clean Documentation, Verify, and Hand Off

**Files:**
- Modify: `README.md`
- Modify: `docs/reference/cli.md`
- Modify: `docs/guides/troubleshooting.md`
- Modify: `specs/implementation/active/high-impact-followups-epic.md`
- Modify: `specs/implementation/active/README.md`
- Modify: this checklist

- [x] Remove migration instructions and explain that pre-v1 obsolete caches are
  rebuilt automatically. Keep user-facing global setup, `cache status`,
  `doctor`, remove, and prune guidance accurate.

- [x] Run focused cache/CLI tests, the full relevant contract suite, `CI=1 pnpm
  type-lint`, `pnpm test:package-bin`, `pnpm check:version-bump`, `git diff
  --check`, and the specs inventory command. Focused stale-cache fixtures
  passed; `engine-behavior`, `engine-contract`, and `cli-boundary` passed
  123/123 with one intentional skip; packed-package smoke completed; type,
  version, whitespace, and spec-inventory checks passed after the
  `0.5.0-alpha.138` increment. The exact Windows CI test selection passed
  95/95 with one intentional skip, and packed-package smoke and type lint
  passed again after clearing cached SQLite handles before the new global-cache
  fixtures remove their temporary roots.

- [x] Commit, push, and merge only after the exact PR head passes Fast required
  checks and Windows compatibility/package smoke. PR #30 run `29877561794`
  passed both gates for final exact head `fffd977`, then merged.
