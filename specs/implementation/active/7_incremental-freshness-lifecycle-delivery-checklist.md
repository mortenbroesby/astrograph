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

- [ ] Run focused baseline coverage for refresh, watch, checkout, diagnostics,
  filesystem scan, and engine behavior. Record the commands and current
  outcomes before changing source.
- [ ] Measure cold index, no-op refresh, one-file edit, rename, delete,
  checkout switch, unavailable-Git, and watcher-backend fallback on a pinned
  local fixture. Record elapsed time, parsed/reused/removed counts, and the
  returned freshness/reason fields.
- [ ] Map the current invalidation keys and source of truth: canonical path,
  content hash, parser/config/artifact version, checkout identity, watch event,
  and filesystem snapshot. Identify precisely where a stale or unknown result
  can be misreported.

## Task 2: Specify the smallest safe delta lifecycle

**Files:** this checklist; `specs/architecture/core-principles.md`,
`specs/api-design/mcp-tools.md`, and `docs/guides/performance.md` as needed.

- [ ] Write the behavior table for no-op, edit, rename, delete, checkout
  switch, unavailable Git, and watcher failure: invalidation action, returned
  freshness state, safe fallback, and diagnostic reason.
- [ ] Choose the narrow implementation seam only after the baseline. Keep
  canonical paths, content hashes, checkout mappings, and single-writer SQLite
  transactions authoritative; do not introduce a daemon or shared index.
- [ ] Define additive, privacy-safe delta metrics (`reused`, `parsed`,
  `removed`, elapsed time) and the exact CLI/MCP contracts/tests that prove
  them. Update the architecture/API docs before any public contract change.

## Task 3: Implement and prove one vertical slice

**Files:** Exact source and test paths selected by Task 2; update this
checklist before editing them.

- [ ] Add focused fixtures and tests for the selected lifecycle gap, including
  a safe fallback reason. Preserve existing path and separator behavior.
- [ ] Implement the smallest behavior-preserving delta path; keep watcher
  backends and full refresh as explicit fallbacks.
- [ ] Run focused Vitest coverage, `pnpm type-lint`, `pnpm check:version-bump`,
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
