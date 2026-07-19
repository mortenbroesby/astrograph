# Release Publication Evidence Delivery Checklist

> **Status:** In progress — Story 8 of the [Remaining Delivery Epic](./remaining-delivery-epic.md).
> The guarded manual cloud-release path is verified; automatic release from a
> release-labelled merged PR remains the final proof obligation.

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

- [x] Run focused release tests, `pnpm type-lint`, `pnpm release:plan`,
  `pnpm check:version-bump`, and `git diff --check`.
- [x] Immediately before push, run `pnpm release:apply` if this source story
  needs an increment, then rerun `pnpm check:version-bump`.
- [x] Commit, push, PR, automated review, and CI-gated merge.
- [ ] Use a release-labelled merged PR and record CI apply URL, release commit,
  tag, publish workflow URL, npm version URL, and registry version.
- [x] Investigate first cloud attempt: CI release agent created
  `Release 0.4.0-alpha.108` and `v0.4.0-alpha.108`, but no Release workflow
  appeared because default-token tag pushes do not emit downstream workflows.
- [x] Dispatch the existing Release workflow explicitly after the release tag;
  prove the guarded manual CI path produces a publish run and npm version.
- [ ] If external publishing blocks, record owner, exact error, and retry
  condition here while continuing independent work.

### Manual cloud-release evidence — 2026-07-19

- Guarded CI apply: [run 29694923849](https://github.com/mortenbroesby/astrograph/actions/runs/29694923849)
  passed its fast and Windows gates, then created the release transaction.
- Release commit and tag: [`62ab48e` / `v0.4.2-alpha.112`](https://github.com/mortenbroesby/astrograph/tree/v0.4.2-alpha.112).
- Trusted publisher: [Release run 29695081376](https://github.com/mortenbroesby/astrograph/actions/runs/29695081376)
  succeeded from the matching tag using Node 24/npm 11.
- Registry proof: [`astrograph@0.4.2-alpha.112`](https://www.npmjs.com/package/astrograph/v/0.4.2-alpha.112)
  is available and is the `latest` dist-tag; the registry source is
  [`https://registry.npmjs.org/astrograph/0.4.2-alpha.112`](https://registry.npmjs.org/astrograph/0.4.2-alpha.112).
- This is manual-dispatch evidence, not the required release-labelled-PR proof;
  do not close Story 8 until that automatic path has succeeded.

## Task 6: Prove the automatic labelled-PR path

**Files:** `src/scripts/release-agent.ts`,
`tests/release-agent.test.ts`, `.github/workflows/ci.yml`, and this checklist.

- [x] Add a focused regression test proving `--force-patch` is rejected unless
  it is paired with `--apply`; the test failed before the guard and passed after
  the minimal implementation.
- [x] Preserve `CI` as the only workflow caller of `--force-patch`; its manual
  apply mode already supplies `--apply` after the normal fast and Windows gates.
- [ ] Apply the `release` label to this release-worthy PR before its
  CI-gated merge; this is the explicit opt-in for the automatic cloud release.
- [ ] Record the merged-PR CI URL, release commit, matching tag, publisher URL,
  and npm registry version; then close Story 8 and the Remaining Delivery Epic.

## Completion Evidence

- [x] One shared plan/apply implementation proves normal, no-op, conflict, and
  unavailable-registry behavior with focused tests.
- [x] Merge and manual CI use it after required gates, without tests in the
  release-only job.
- [ ] A release-labelled merged PR has a version commit, matching tag,
  successful trusted npm publication, and recorded URLs.
