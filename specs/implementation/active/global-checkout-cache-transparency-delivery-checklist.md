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

- [x] Run the focused CI-mode baseline and record the exact commands/results.
  `CI=1 pnpm type-lint` and 58 focused CLI, engine-contract, Git-checkout,
  and incremental-cache tests pass.

- [x] Map the current JSON/text answers for canonical repository identity,
  checkout/branch state, local versus global storage, freshness, cache reuse,
  migration state, and Git fallback.
  Before this change, `cache status` answered canonical root, selected storage
  location/directory, version, bytes, and migration, while `doctor` answered
  freshness and storage health. Neither exposed the indexed checkout record,
  even though it is stored in the cache database.

- [x] Write only reproducible support/debug examples whose decision cannot be
  made from current outputs. Map every candidate field to one decision.
  Example: after indexing a named branch or worktree, an operator could locate
  the selected cache but could not confirm which checkout identity populated
  it. The decision is whether to reindex the intended checkout.

## Task 2: Select the Smallest Missing Contract

**Selection gate:** Task 1 identifies a material, reproducible ambiguity.

- [x] Choose one smallest surface: an existing `cache status`/`doctor` JSON
  field, one checkout diagnostic, or one explicit fallback reason. Do not add
  a duplicate status command or infer a repository from process cwd.
  **Selected:** add `checkout` to existing `cache status` JSON. It is `null`
  before an index exists and otherwise reports the persisted checkout mode,
  repository/head/branch/worktree identity, Git diagnostic, and indexed time.

- [x] Specify deterministic values for named branch, detached HEAD, linked
  worktree, unavailable Git, local/global storage, migration state, and stale
  artifacts.
  The field mirrors the persisted checkout probe: mode is one of
  `git-branch`, `git-detached`, `git-worktree`, `filesystem`, or
  `git-unavailable`; unavailable/absent values are explicit `null`. Storage
  and migration remain the existing top-level deterministic fields. Staleness
  remains in `doctor`, avoiding a duplicate freshness implementation.

- [x] Do not defer: the indexed-checkout ambiguity is material and has one
  bounded existing-surface fix.
  possible.

## Task 3: Implement Only When Selected

- [x] Add the selected diagnostic contract and focused fixtures. Keep source
  content and unrelated paths out of output.

- [x] Update CLI/API documentation only for the selected public surface:
  `README.md`, `docs/reference/cli.md`, and `specs/api-design/cli-api.md`
  describe the `cache status.checkout` contract. MCP has no cache-status
  tool, so no MCP contract changed.

- [ ] Do not implement artifact reuse counters unless Story 1 is reopened with
  evidence and provides a real reuse event to report.

## Task 4: Verify and Handoff

- [x] Run targeted diagnostics/CLI/checkout tests, `CI=1 pnpm type-lint`,
  `pnpm check:version-bump`, and `git diff --check`.
  Evidence: type lint, the 58-test focused baseline, the targeted CLI rerun,
  packed-package smoke, version guard, and whitespace validation all pass.
  The CI staged-diff gate requires a release increment for the runtime change;
  `pnpm release:plan --base v0.4.4-alpha.133` selected minor and
  `pnpm release:apply --base v0.4.4-alpha.133` set
  `0.5.0-alpha.134` after confirming the published baseline.

- [x] Check off evidence and update the epic. **Complete:** `cache
  status.checkout` is the selected, tested, documented contract. Merge it only
  after CI verifies the exact commit as closely as main's checks permit.
