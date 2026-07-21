# Checkout and Cache Transparency Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](./high-impact-followups-epic.md), Story 3
>
> **Status:** Active — establish a reproducible operator decision gap before
> adding a diagnostic field or command.

**Goal:** Let users and agents identify the canonical repository, selected
checkout, storage location, freshness, and cache decision without guessing.

**Architecture:** Reuse the existing cache status, doctor, checkout mapping,
and branch-aware freshness paths. Add only a field or output that resolves a
named operator decision. Prefer the simplest direct contract; compatibility
shims are not an acceptance criterion for this work.

**Tech Stack:** TypeScript, Node.js 22 LTS, pnpm, Vitest, existing CLI/MCP and
diagnostic contracts.

---

## Task 1: Inventory Current Answers

**Files:**
- Inspect: `src/cli.ts`, `src/doctor.ts`, `src/diagnostics.ts`,
  `src/config.ts`, `src/checkout-mapping.ts`
- Inspect tests: `tests/cli-boundary.test.ts`, `tests/engine-contract.test.ts`,
  `tests/git-checkout.test.ts`, `tests/incremental-cache.test.ts`
- Record: this checklist

- [ ] Run the focused CI-mode baseline and record the exact commands/results.

- [ ] Map the current JSON/text answers for canonical repository identity,
  checkout/branch state, local versus global storage, freshness, cache reuse,
  migration state, and Git fallback.

- [ ] Write only reproducible support/debug examples whose decision cannot be
  made from current outputs. Map every candidate field to one decision.

## Task 2: Select the Smallest Missing Contract

**Selection gate:** Task 1 identifies a material, reproducible ambiguity.

- [ ] Choose one smallest surface: an existing `cache status`/`doctor` JSON
  field, one checkout diagnostic, or one explicit fallback reason. Do not add
  a duplicate status command or infer a repository from process cwd.

- [ ] Specify deterministic values for named branch, detached HEAD, linked
  worktree, unavailable Git, local/global storage, migration state, and stale
  artifacts.

- [ ] Defer the story if existing output already makes each recorded decision
  possible.

## Task 3: Implement Only When Selected

- [ ] Add the selected diagnostic contract and focused fixtures. Keep source
  content and unrelated paths out of output.

- [ ] Update CLI/MCP/API documentation only for the selected public surface.

- [ ] Do not implement artifact reuse counters unless Story 1 is reopened with
  evidence and provides a real reuse event to report.

## Task 4: Verify and Handoff

- [ ] Run targeted diagnostics/CLI/checkout tests, `CI=1 pnpm type-lint`,
  `pnpm check:version-bump`, and `git diff --check`.

- [ ] Check off evidence and update the epic. Merge any implementation only
  after CI verifies the exact commit as closely as main's checks permit.
