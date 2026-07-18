# Astrograph Feedback Epic Delivery Checklist

> **Status:** Work in progress. This is the execution companion to
> [Astrograph Feedback Consolidation Epic](./astro-feedback-epic.md). Future
> agents must update this checklist and the matching `.ralph/astro-feedback/`
> story state only after the story's focused verification passes.

**Goal:** Deliver the feedback epic as small, independently verifiable changes
without conflating retrieval contracts, ranking, configuration, health, and
documentation work.

**Architecture:** The broad-query response contract is the foundation. Generic
ranking then gains opt-in repository context; explainability and documentation
follow the settled response shapes. Each story is deliberately narrow and may
be committed independently.

**Tech Stack:** TypeScript, Node 24, Vitest, Astrograph MCP server, CLI, and
the repository spec system.

---

## Baseline for Every Source Story

- [ ] Run `pnpm type-lint` and the story's focused Vitest command before edits.
- [ ] Preserve compatibility-sensitive MCP tool names, CLI JSON fields, and
  `src/index.ts` exports unless the story explicitly changes the contract.
- [ ] Run `pnpm check:version-bump` before committing source, test, script, or
  package changes.
- [ ] Update this checklist and `.ralph/astro-feedback/prd.json` only after all
  listed verification passes.

## Urgent Story: Restore deployment workflow — Critical

**Trigger:** [GitHub Actions run 29658897396, job 88117980537](https://github.com/mortenbroesby/astrograph/actions/runs/29658897396/job/88117980537).

- [ ] Authenticate `gh` with repository and workflow scopes, then capture the
  failing workflow, job, step, and log excerpt.
- [ ] Read `.agents/rules/github-actions-cost.md` before editing any workflow.
- [ ] Implement only the smallest deployment-specific fix, preserving scoped
  triggers, caching, PR concurrency, and the fast/optional check split.
- [ ] Verify a successful follow-up Actions run and record its URL in the Ralph
  progress log before marking this story complete.

## Story 1: Create the delivery backlog — Complete

- [x] Extract one independently testable delivery story per feedback concern.
- [x] Record dependencies, exclusions, acceptance criteria, and version-policy
  review for every story in `.ralph/astro-feedback/prd.json`.
- [x] Create this durable checklist for future-agent handoff.
- [x] Verify the planning artifact with `git diff --check` and
  `find specs .skills -type f -name '*.md' -print`.

## Story 2: Bound broad-query result responses — Complete

**Goal:** Broad retrieval returns a deterministic bounded summary or
refine-first response rather than an oversized default payload.

**Files:** Inspect `src/index.ts`, `src/types.ts`, `src/serialization.ts`,
`src/mcp-contract.ts`, `src/mcp.ts`, `src/cli.ts`, `tests/interface.test.ts`,
and `tests/engine-behavior.test.ts`.

- [x] Define the threshold inputs and bounded-result modes without changing
  ranking logic.
- [x] Apply the default symbol-result cap through the existing response path
  and expose stable `items`/`truncated` state without altering ranking or the
  explicit `limit`/repository override rules.
- [x] Add focused fixtures for broad and narrow requests, including deterministic
  ordering and payload limits.
- [x] Verify with `pnpm exec vitest run tests/interface.test.ts
  tests/engine-behavior.test.ts`, `pnpm type-lint`, and
  `pnpm check:version-bump`.

## Story 3: Add broad-query next-step hints — Complete

**Goal:** A refine-first response gives an agent a concrete, stable way to
narrow the next request.

**Depends on:** Story 2.

- [x] Define a response field and ordering rules for file pattern, kind,
  directory, or follow-up-query hints.
- [x] Derive hints only from supported filters and observed result evidence.
- [x] Serialize matching hints through MCP and CLI JSON without affecting
  adequately narrow queries.
- [x] Add contract tests and verify with `pnpm exec vitest run
  tests/interface.test.ts tests/engine-contract.test.ts`, `pnpm type-lint`,
  and `pnpm check:version-bump`.

## Story 4: Implement generic intent-aware ranking — Complete

**Goal:** Intent-heavy queries favor likely generator or implementation code
over downstream usage and tests.

**Depends on:** Story 2 for broad-query benchmark evaluation.

- [x] Identify generic filename, path-shape, and symbol-name evidence in the
  existing ranking pipeline.
- [x] Add explicit deterministic scoring for representative generation intent.
- [x] Add a fixture case that proves generator candidates outrank
  app-level false positives without repository-specific hardcoding.
- [x] Verify with `pnpm exec vitest run tests/engine-behavior.test.ts
  tests/engine-contract.test.ts`, `pnpm type-lint`, and
  `pnpm check:version-bump`.

## Story 5: Add repo-aware ranking preset configuration — Complete

**Goal:** Repositories can opt into validated path categories such as generation
code, app code, and shared runtime.

**Depends on:** Story 4 establishes the generic ranking baseline.

- [x] Define the bounded preset vocabulary and configuration type.
- [x] Parse and validate path mappings with actionable errors and safe defaults.
- [x] Document the opt-in schema without activating it in ranking yet.
- [x] Add configuration contract tests; verify with `pnpm exec vitest run
  tests/engine-contract.test.ts`, `pnpm type-lint`, and
  `pnpm check:version-bump`.

## Story 6: Apply repo-aware presets to ranking — Complete

**Goal:** Matching configured categories boost intent-aware ranking while absent
or nonmatching presets preserve generic fallback.

**Depends on:** Stories 4 and 5.

- [x] Thread validated preset data into the ranking inputs.
- [x] Apply the smallest category boost only when query intent matches.
- [x] Cover matching, missing, conflicting, and nonmatching preset fixtures.
- [x] Verify with `pnpm exec vitest run tests/engine-behavior.test.ts
  tests/path-matcher.test.ts`, `pnpm type-lint`, and
  `pnpm check:version-bump`.

## Story 7: Expose token-savings metadata — Complete

**Goal:** Retrieval reports returned size and a documented comparable baseline
or savings estimate.

**Depends on:** Stories 2 and 3 establish the relevant response shapes.

- [x] Define units, baseline, unavailable-state behavior, and stable metadata
  field names.
- [x] Compute metrics beside result construction rather than in presentation
  code.
- [x] Serialize identical values through MCP and CLI JSON.
- [x] Add arithmetic and envelope regression tests; verify with
  `pnpm exec vitest run tests/interface.test.ts tests/serialization.test.ts`,
  `pnpm type-lint`, and `pnpm check:version-bump`.

## Story 8: Classify degraded retrieval health — Complete

**Goal:** Agents can distinguish safe, degraded, and unsafe retrieval states,
including the recommended recovery action.

**Depends on:** Story 2 response conventions.

- [x] Enumerate freshness and unresolved-import safety states from current
  diagnostics.
- [x] Map each state to affected capabilities, safe operations, and one
  actionable follow-up.
- [x] Align MCP and CLI representation without automatically repairing state.
- [x] Add fixtures for every safety class; verify with `pnpm exec vitest run
  tests/interface.test.ts tests/engine-behavior.test.ts
  tests/watch-backend.test.ts`, `pnpm type-lint`, and
  `pnpm check:version-bump`.

## Story 9: Align MCP and CLI documentation — Complete

**Goal:** Public docs accurately distinguish the implemented MCP and CLI
workflows and examples.

**Depends on:** Stories 2 through 8; audit may begin earlier, but final wording
waits for settled contracts.

- [x] Inventory documented MCP tools, CLI commands, arguments, and response
  examples against shipped registrations.
- [x] Document intentional surface differences and the new bounded-query,
  ranking, telemetry, and health workflows.
- [x] Record any needed public-contract change as a new story rather than
  silently changing implementation.
- [x] Verify with `pnpm exec vitest run tests/interface.test.ts
  tests/engine-contract.test.ts`, `pnpm type-lint`, and `git diff --check`.

## Story 10: Design branch-aware incremental index mapping — Complete

**Goal:** Safely reuse unchanged analysis across Git-style branch changes while
keeping branch/worktree mappings and invalidation observable.

**Depends on:** Story 2’s bounded response contract; otherwise independent of
ranking, telemetry, and documentation parity work.

- [x] Write a storage/invalidation plan that separates content-addressed cached
  analysis from branch or worktree mappings; branch names alone must never be
  cache keys.
- [x] Define optional Git metadata behavior for named branches, detached HEAD,
  non-Git repositories, and unavailable Git commands.
- [x] Specify invalidation for changed content, changed config, path moves,
  dependency-graph changes, and incompatible storage versions.
- [x] Add fixture scenarios for safe reuse, required refresh, and fallback;
  verify the eventual implementation with focused storage/freshness tests,
  `pnpm type-lint`, and `pnpm check:version-bump`.

## Final Verification

- [x] Run `pnpm test` after all source stories are complete.
- [x] Run `pnpm release:plan` and follow its release decision before publishing.
- [x] Mark every checklist item and Ralph story complete only with recorded
  passing evidence.
