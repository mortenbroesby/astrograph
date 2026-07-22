# Global Astrograph Cleanup and Delivery Preparation Checklist

> **Status:** Active — this is the one selected goal named by
> [`pointer.md`](../../../pointer.md). It prepares the next global-Astrograph
> delivery without assuming that a deferred feature should be implemented.

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
- [x] Select [File-Type Support Coverage and Discovery](../planned/filetype-support-coverage-delivery-checklist.md)
  after this cleanup merges: the explicit user request satisfies its documented
  coverage/documentation-gap gate.
- [ ] Create or update that story's active checklist with exact files,
  baseline, focused tests, final verification, release decision, and commit
  checkpoint.

## Task 5: Verify and commit the preparation work

- [ ] Run the Task 2 baseline again if source/tests changed.
- [ ] Run `pnpm check:version-bump` if source, tests, scripts, or package
  metadata changed; this documentation-only planning update needs no npm
  release under `.skills/release-decision/SKILL.md`.
- [ ] Run:

  ```bash
  git diff --check
  find specs .skills -type f -name '*.md' -print
  ```

  Expected: both commands exit `0`.
- [ ] Commit the scoped preparation work and merge it only after the applicable
  CI checks pass for the exact PR head.
