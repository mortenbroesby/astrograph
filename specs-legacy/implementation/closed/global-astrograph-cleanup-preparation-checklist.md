# Global Astrograph Cleanup and Delivery Preparation Checklist

> **Status:** Closed — completed by PR #43 (`6283565`) after exact-head Fast
> required checks and Windows compatibility/package smoke passed. The next
> selected goal was [File-Type Support Coverage and Discovery](./filetype-support-coverage-delivery-checklist.md).

**Goal:** Remove tracker and codebase-hygiene ambiguity, record a bounded
cleanup decision, and leave one evidence-gated next story ready for a bare
`/goal` handoff.

**Architecture:** This is a preparation story, not a stealth global-cache
rewrite. Keep repository-specific mutable state, canonical `repoRoot`, and the
local-first/privacy boundaries intact. Delete or refactor code only when the
inventory proves it is obsolete, has no active caller or public contract, and
has focused regression coverage; otherwise document the candidate and defer it.

**Files:** `pointer.md`, `AGENTS.md`, `specs/implementation/active/**`,
`specs/implementation/planned/**`, `specs/implementation/closed/**`,
`docs/reviews/**` (only if a review record is needed), and only evidence-backed
source/test files discovered in Task 2.

## Task 1: Establish the durable goal handoff and tracker boundaries

- [x] Add the tracked root pointer and direct bare `/goal` requests to it.
- [x] Select this checklist as the only active execution queue.
- [x] Move deferred global-reuse and install-health checklists out of the
  active queue, and reconcile the completed MCP-surface story in the precision
  epic.

## Task 2: Build a bounded cleanup inventory before editing runtime code

- [x] Astrograph MCP tools were unavailable in this session, so inspect the
  storage/config/install/MCP boundaries with raw source reads as the permitted
  Astrograph-debugging fallback.
- [x] Run and record the baseline:

  ```bash
  pnpm type-lint
  pnpm exec vitest run tests/engine-contract.test.ts tests/interface.test.ts tests/cli-boundary.test.ts
  ```

  Expected: all commands exit `0`, or every unrelated environment failure is
  recorded without being misattributed to cleanup.
- [x] Inventory only these cleanup classes: obsolete pre-v1 cache reads or
  migrations, duplicate configuration/installer contract definitions, dead
  compatibility paths, stale generated-client policy, and docs/spec links that
  disagree with current `main`.
- [x] For every candidate, record owner files, callers, public-contract impact,
  focused test, deletion safety, and whether it blocks the selected global
  follow-up. See the [cleanup inventory](../../../docs/reviews/global-astrograph-cleanup-2026-07-22.md).
  Do not turn this into a broad style refactor.

## Task 3: Apply only proven cleanup

- [x] Choose one cohesive cleanup: reconcile the stale tracked Codex client
  policy, whose obsolete `query_code` allowlist had no active v1 contract.
- [x] Add the narrowest regression test before changing behavior.
- [x] Reconcile the configuration with its single production owner. Do not add a
  compatibility shim, migration reader, shared mutable index, daemon, network
  synchronization, or destructive MCP cache command.
- [x] No public API/docs/spec contract changes are required; the review record
  documents the development-configuration correction.

## Task 4: Select the next delivery story and hand off

- [x] Re-evaluate the documented gates for immutable artifact reuse, global
  install health/recovery, compact transport, release publication evidence,
  and later precision work using Task 2 evidence.
- [x] Select [File-Type Support Coverage and Discovery](./filetype-support-coverage-delivery-checklist.md)
  after this cleanup merges: the explicit user request satisfies its documented
  coverage/documentation-gap gate.
- [x] Move the selected File-Type Support Coverage and Discovery checklist to
  `active/`; it already has exact files, baseline, focused tests, final
  verification, release decision, and commit checkpoint.

## Task 5: Verify and commit the preparation work

- [x] Re-run the Task 2 focused baseline after source/test changes: 62 tests
  and `pnpm type-lint` passed locally.
- [x] Run `pnpm check:version-bump`; CI initially exposed the required alpha
  increment, then `0.5.0-alpha.144` passed the exact version-policy gate.
- [x] Run:

  ```bash
  git diff --check
  find specs .skills -type f -name '*.md' -print
  ```

  Expected: both commands exit `0`.
- [x] Merge PR #43 only after Fast required checks passed (55s) and Windows
  compatibility, including the packed-package smoke, passed (5m35s).
