# Release Publication Evidence Delivery Checklist

> **Status:** In progress — Story 8 of the [Remaining Delivery Epic](./remaining-delivery-epic.md).
> This final executable story is complete only when a release-labelled PR has
> created a release commit, matching tag, trusted npm publication, and recorded evidence.

**Goal:** Make local, merged-PR, and manual release paths use one idempotent,
conflict-aware version decision and apply flow; then prove the opt-in cloud
release through npm publication.

**Architecture:** `src/release-policy.ts` remains the pure release-kind owner.
The release agent gathers Git and npm state, creates a side-effect-free plan,
and is the sole writer in apply mode. `CI` invokes that agent only after
required gates pass; the tag workflow remains the trusted-publishing boundary.

**Tech Stack:** TypeScript, Node.js 22, pnpm, Vitest, GitHub Actions, Git, npm
registry metadata, and npm OIDC trusted publishing.

## Task 1: Define the transaction contract and baseline

**Files:** `src/scripts/release-agent.ts`, `src/release-policy.ts`,
`tests/release-policy.test.ts`, `.github/workflows/ci.yml`,
`.github/workflows/release.yml`, `docs/reference/release.md`, and this checklist.

- [x] Read the release decision skill and Actions cost rule.
- [x] Record baseline: plan/apply share one script, but only derive a target
  from reachable tags and working `package.json`; they do not compare `main` or npm.
- [x] Record baseline: merge release waits for `fast` but not Windows; manual
  dispatch uses the same agent with `release_mode`.
- [x] Define working/main/registry/candidate/tag state and deterministic
  apply/no-op/reject outcomes.
- [x] Define strict apply failure for unavailable/malformed npm data; plan may
  report unknown registry state without writing.

## Task 2: Build and test pure version-state decisions

**Files:** modify `src/release-policy.ts`; add a focused transaction module if
needed; modify `tests/release-policy.test.ts`.

- [x] Add a checkout-independent monotonic alpha-version comparator.
- [x] Decide ordinary apply, valid already-bumped no-op, duplicate-tag no-op,
  stale/conflicting main reject, stale/conflicting npm reject, and unavailable
  registry apply reject.
- [x] Preserve release-kind classification and coupled update ownership
  (`package.json` and engine-contract expectation).
- [x] Add fixtures for normal increment, valid existing bump, duplicate tag,
  newer main, newer/equal npm, malformed version, and unavailable registry.
- [x] Run `pnpm exec vitest run tests/release-policy.test.ts` and
  `pnpm type-lint`; expected: pass.

## Task 3: Connect the shared release agent

**Files:** `src/scripts/release-agent.ts`, package scripts if needed, and
focused release tests.

- [x] Read `origin/main:package.json` when available and report it in plan
  output; never silently substitute working-tree state.
- [x] Read `npm view astrograph version --json` with an argument-array call;
  parse exactly one valid Astrograph version and report source/status.
- [x] Keep `pnpm release:plan` side-effect free. `pnpm release:apply` edits
  only declared coupled files after the shared decision accepts state.
- [x] Run `pnpm check:version-bump` after an apply update and emit all CI
  outputs needed for commit/tag/no-op behavior.
- [x] Keep unit tests hermetic: release transaction fixtures never call Git or npm.

## Task 4: Gate cloud release without release-job tests

**Files:** `.github/workflows/ci.yml`, `docs/reference/release.md`, and
`specs/implementation/release-agent.md`.

- [x] Preserve path scopes, cache, concurrency cancellation, and runner sizes;
  add no workflow or broad trigger.
- [x] Require both `fast` and `windows` before merge-triggered release mutation;
  manual dispatch uses the same jobs and agent flow.
- [x] Keep mutation/tagging in the short release-only job; it runs no test suite.
- [x] Restrict automatic apply to merged, `release`-labelled PRs on `main`;
  document manual `plan` and main-only `apply`.
- [x] Record cost: no new runner/trigger; the existing short release job waits
  for current gates and is permanent under the user's explicit cost approval.

## Task 5: Verify, merge, and collect publication evidence

- [ ] Run focused release tests, `pnpm type-lint`, `pnpm release:plan`,
  `pnpm check:version-bump`, and `git diff --check`.
- [ ] Immediately before push, run `pnpm release:apply` if this source story
  needs an increment, then rerun `pnpm check:version-bump`.
- [ ] Commit, push, PR, automated review, and CI-gated merge.
- [ ] Use a release-labelled merged PR and record CI apply URL, release commit,
  tag, publish workflow URL, npm version URL, and registry version.
- [ ] If external publishing blocks, record owner, exact error, and retry
  condition here while continuing independent work.

## Completion Evidence

- [ ] One shared plan/apply implementation proves normal, no-op, conflict, and
  unavailable-registry behavior with focused tests.
- [ ] Merge and manual CI use it after required gates, without tests in the
  release-only job.
- [ ] A release-labelled merged PR has a version commit, matching tag,
  successful trusted npm publication, and recorded URLs.
