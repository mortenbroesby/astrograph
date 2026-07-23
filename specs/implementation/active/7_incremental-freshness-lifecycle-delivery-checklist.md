# Incremental Freshness Lifecycle Delivery Checklist

> **Status:** Active — selected Story 7 of the
> [Precision Retrieval and Agent Experience epic](../planned/1_precision-retrieval-agent-experience-epic.md).
> This is Astrograph's Munch-inspired next product slice: reliable, explicit
> local freshness after real repository changes.

**Goal:** Make retrieval freshness observable and incrementally maintainable
after edits, renames, deletes, checkout changes, unavailable Git, and watcher
fallbacks—without silently claiming a stale index is fresh.

**Architecture:** Preserve the local SQLite index, canonical repository root,
checkout mappings, content hashes, and existing watch backends. Start by
measuring the current cold/no-op/delta behavior and freshness diagnostics; then
change only the smallest invalidation and reporting seams proven necessary.
No daemon, shared mutable index, remote sync, or hidden refresh routing is in
scope.

**Tech stack:** TypeScript, Node.js `>=22.12.0`, SQLite, tree-sitter,
`@parcel/watcher`, pnpm, Vitest, Git, and the existing CLI/MCP diagnostics.

---

## Task 1: Capture the current freshness contract and baseline

**Files:** `src/index-refresh.ts`, `src/storage.ts`, `src/git-checkout.ts`,
`src/repo-meta.ts`, `src/diagnostics.ts`, `src/watch-backend.ts`,
`src/types.ts`, `docs/guides/performance.md`, and this checklist.

- [x] Run focused baseline coverage for refresh, watch, checkout, diagnostics,
  filesystem scan, and engine behavior. Record the commands and current
  outcomes before changing source.
- [ ] Measure cold index, no-op refresh, one-file edit, rename, delete,
  checkout switch, unavailable-Git, and watcher-backend fallback on a pinned
  local fixture. Record elapsed time, parsed/reused/removed counts, and the
  returned freshness/reason fields.
- [x] Map the current invalidation keys and source of truth: canonical path,
  content hash, parser/config/artifact version, checkout identity, watch event,
  and filesystem snapshot. Identify precisely where a stale or unknown result
  can be misreported.

## Baseline evidence (2026-07-23)

- `pnpm exec vitest run tests/index-refresh.test.ts tests/watch-backend.test.ts
  tests/watch-boundary.test.ts tests/git-checkout.test.ts
  tests/filesystem-scan.test.ts` passed 21 focused checks after the
  watch-boundary test ran with its intended user-private cache permission. The
  sandbox-only failure to create that cache directory was environmental, not a
  product failure.
- `pnpm exec vitest run tests/engine-behavior.test.ts -t 'can refresh a single
  file without a full rebuild|removes stale index entries when single-file
  refresh targets a deleted or renamed file|surfaces live freshness drift after
  the repository changes'` passed all 3 selected engine checks.
- Current covered behavior already includes single-file refresh, deleted/renamed
  file removal, watch refresh, checkout mapping, backend normalization, and
  live drift. The next task is to capture comparable cold/no-op/edit/rename/
  delete/checkout/unavailable-Git/fallback measurements and map their returned
  freshness reasons before choosing a code seam.
- The existing `pnpm bench:perf:index -- --repo <this checkout>` harness cannot
  yet measure Astrograph itself: `copyCleanRepo()` preserves the root
  `astrograph.config.ts` but excludes `dist/`, so the copied config's
  self-import of `astrograph` cannot resolve `dist/index.js`. This is a real
  benchmark-fixture boundary to address or explicitly exclude in Task 2; it
  must not be hidden by treating the failed run as a product freshness result.
- The same harness on a pinned five-file, configless local fixture measured
  `coldIndexMs=1255.6`, `warmNoopRefreshMs=765.9`,
  `warmChangedRefreshMs=814.2`, `fileDiscoveryMs=126.1`, `hashingMs=2.4`,
  `parseMs=26.3`, and `sqliteWriteMsApprox=1100.8`. These numbers establish a
  reproducible starting point only; they do not yet measure rename, delete,
  checkout, unavailable-Git, or watcher-fallback deltas.
- Indexing compares discovered canonical-relative paths with SQLite `files`
  rows. A matching size and truncated mtime reuses the row; otherwise it reads
  content, keys analysis by content hash plus parser/config/schema versions,
  and reindexes only when content differs. Folder refresh removes paths absent
  from discovery; file/watch refresh removes a missing, ignored, or oversized
  target, then refreshes its direct importers. Finalization rebuilds dependency
  and checkout mappings before it reports `fresh` or `stale`.
- No reviewed path turns a failed Git or watcher probe into a fresh diagnostic:
  Git is recorded as `git-unavailable`, while watcher failures emit an error
  before polling fallback. The observable gap is that index responses only
  expose `indexedFiles` and `indexedSymbols`, hiding no-op reuse and removals.

## Task 2: Specify the smallest safe delta lifecycle

**Files:** this checklist; `specs/architecture/core-principles.md`,
`specs/api-design/mcp-tools.md`, and `docs/guides/performance.md` as needed.

- [x] Write the behavior table for no-op, edit, rename, delete, checkout
  switch, unavailable Git, and watcher failure: invalidation action, returned
  freshness state, safe fallback, and diagnostic reason.
- [x] Choose the narrow implementation seam only after the baseline. Keep
  canonical paths, content hashes, checkout mappings, and single-writer SQLite
  transactions authoritative; do not introduce a daemon or shared index.
- [x] Define additive, privacy-safe delta metrics (`reused`, `parsed`,
  `removed`, elapsed time) and the exact CLI/MCP contracts/tests that prove
  them. Update the architecture/API docs before any public contract change.

| Scenario | Invalidation action | Safe result / reason |
| --- | --- | --- |
| No-op | Size + mtime match reuses the row. | Finalizes `fresh` only when dependency/checkouts are healthy; report reuse. |
| Edit | Read/hash/reindex changed content and direct importers. | Preserve `fresh`/`stale` from finalization and unresolved-import reasons. |
| Rename/delete | Remove missing old path; discover/index new path on folder refresh. | Never retain the old path; report removal. |
| Checkout | Compare folder paths and record checkout identity/mappings. | Full folder refresh is reconciliation; incomplete mappings stay stale. |
| Git unavailable | Continue local filesystem indexing and record `git-unavailable`. | Do not infer a Git identity; preserve probe diagnostic. |
| Watch failure | Emit error and use explicit polling fallback. | Polling follows the same targeted refresh; failure is retained in diagnostics. |

**Selected seam:** add additive, path-free `reusedFiles`, `parsedFiles`, and
`removedFiles` to `IndexSummary`, then propagate them through folder/file
refresh, watch events, CLI JSON, and MCP results. This does not change
invalidation, SQLite ownership, checkout mappings, or fallback behavior.

## Task 3: Implement and prove one vertical slice

**Files:** `src/types/watch.ts`, `src/indexing.ts`, `src/index-refresh.ts`,
`src/storage.ts`, `src/serialization.ts`, `tests/index-refresh.test.ts`,
`tests/engine-behavior.test.ts`, `specs/api-design/mcp-tools.md`, and this
checklist.

- [x] Add focused fixtures and tests for the selected lifecycle gap, including
  a safe fallback reason. Preserve existing path and separator behavior.
- [x] Implement the smallest behavior-preserving delta path; keep watcher
  backends and full refresh as explicit fallbacks.
- [x] Run focused Vitest coverage, `pnpm type-lint`, `pnpm check:version-bump`,
  `pnpm build`, and `git diff --check`. Record cold/no-op/delta evidence.
- [ ] Commit with the required alpha version decision, push a review branch,
  obtain exact-head Fast/package evidence, then close this checklist or retain
  the next unchecked lifecycle gap as the only active work.

## Acceptance evidence

- Every response distinguishes fresh, stale, and unknown instead of inferring
  freshness after a failed probe.
- No-op and one-file changes have measured reuse/delta evidence without
  weakening checkout or content-hash correctness.
- Edits, renames, deletes, checkout switches, unavailable Git, and watcher
  fallback have an explicit, tested safe action and diagnostic explanation.
- No global mutable index, background service, remote synchronization, or MCP
  routing expansion is introduced.

## Vertical-slice verification (2026-07-23)

- `pnpm exec vitest run tests/index-refresh.test.ts
  tests/engine-behavior.test.ts tests/serialization.test.ts
  tests/interface.test.ts` passed. The focused lifecycle fixture proves cold
  `parsedFiles=2`, no-op `reusedFiles=2`, one-file edit
  `parsedFiles=1,reusedFiles=1`, and delete
  `removedFiles=1,reusedFiles=1`, each with `staleStatus="fresh"` on its
  healthy local fixture.
- `pnpm type-lint`, `pnpm check:version-bump`, `pnpm build`, and
  `git diff --check` passed before commit `2d6666a`.
- The committed-history release plan selects a **minor** release because this
  is an additive runtime feature: `0.6.0-alpha.164` / `v0.6.0-alpha.164`.
  The npm registry confirmed `0.5.1-alpha.163`; the guarded main-only release
  workflow must make the version/tag after merge.
