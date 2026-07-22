# Release on Main Merge Delivery Checklist

> **Status:** Active — implementation is merged; final npm trusted-publisher
> configuration and tagged retry evidence remain. It replaces the label-gated
> release-proof obligation formerly tracked as Story 8 of the [Remaining
> Delivery Epic](./3_remaining-delivery-epic.md).

**Goal:** Publish each eligible pull-request merge to `main` through one
observable, idempotent release transaction—without a release label, a
release-only follow-up commit, or a second manually dispatched workflow.
Documentation-only and explicitly opted-out changes must remain non-releases.

**Architecture:** A merged commit is the release candidate. The release job
must validate its version and registry state, create the matching tag if safe,
and publish from that exact commit through npm trusted publishing. It must not
push a commit to protected `main`; version ownership and the explicit
`no-release` escape hatch are decided and validated before merge. JSON
diagnostics remain available for every no-op or rejection.

**Tech Stack:** TypeScript, Node.js 22, pnpm, Vitest, GitHub Actions, Git, npm
registry metadata, and npm OIDC trusted publishing.

## Task 1: Decide the merge-release contract and record the baseline

**Files:** `src/scripts/release-agent.ts`, `src/release-policy.ts`,
`tests/release-policy.test.ts`, `.github/workflows/ci.yml`,
`.github/workflows/release.yml`, `docs/reference/release.md`, and this checklist.

- [x] Read the release decision skill and Actions cost rule; retain scoped
  triggers, caching, concurrency cancellation, and the temporarily disabled
  hosted Windows job.
- [x] Record the current label-gated, post-merge version-commit/tag/dispatch
  sequence and the exact failure/latency it creates.
- [x] Choose and document the single version owner: a release-worthy PR must
  carry its valid version bump before merge, or a separate pre-merge release
  PR is created. Do not permit an Action to write protected `main` after merge.
- [x] Define eligibility: release by default for a qualifying merge, with an
  explicit `no-release` label for docs/spec/workflow-only changes. Define the
  deterministic result for a duplicate, stale, malformed, or registry-newer
  version.
- [x] Define one publish boundary: tag and npm trusted publication execute in
  the post-merge release job from the same verified commit; do not rely on a
  token-created tag to trigger another workflow.

## Task 2: Build and test the pre-merge and post-merge decisions

**Files:** modify `src/release-policy.ts`; add a focused transaction module if
needed; modify `tests/release-policy.test.ts`.

- [x] Preserve the checkout-independent monotonic alpha-version comparator and
  coupled version ownership (`package.json` plus engine-contract expectation).
- [ ] Add pure fixtures for ordinary eligible merge, `no-release`, missing
  required bump, duplicate tag, registry-newer version, malformed version,
  unavailable registry, and rerun after a successful publish.
- [x] Make PR CI report a machine-readable release decision without writing.
- [x] Make post-merge apply accept only the exact merge candidate that passed
  the decision; it may tag/publish but never edits `main`.
- [x] Run focused release-policy/agent tests and `pnpm type-lint`; expected:
  deterministic decisions and no network in unit tests.

## Task 3: Replace the workflow loop

**Files:** `src/scripts/release-agent.ts`, package scripts if needed, and
focused release tests.

- [x] Keep `pnpm release:plan` side-effect free and useful locally; if a local
  apply command remains, make its changed files explicit and require it before
  merging the owning PR.
- [x] Run the post-merge release job only after the existing required fast
  gate succeeds. Do not re-run tests in the release job.
- [x] Remove legacy `release`-label discovery, release-branch/PR creation, and downstream
  workflow dispatch from the automatic path. Retain a guarded manual plan or
  recovery command only if it shares the same decision module.
- [x] Request only the job-scoped GitHub permissions required for tag creation
  and trusted npm publication; keep workflow-token defaults read-only.
- [x] Emit candidate SHA, version, tag, registry state, publish result, and
  no-op reason in the job summary.

## Task 4: Verify the complete merge-to-npm flow

**Files:** `.github/workflows/ci.yml`, `docs/reference/release.md`, and
`specs/implementation/release-agent.md`.

- [x] Update `docs/reference/release.md`, README release guidance, and the
  workflow comments with the simple rule: qualifying PR merge → verified tag
  → npm publish; `no-release` is the exception.
- [ ] Prove one release-worthy PR merge creates exactly one tag and one npm
  publication for the merge SHA, with the GitHub Actions and npm URLs recorded.
- [x] Prove one docs/spec or `no-release` merge does not tag or publish.
- [ ] Prove a rerun is idempotent and a bad/stale registry state fails before
  publish with an actionable summary.
- [ ] Keep the release-only job short and no-test; record any Actions cost
  change under the repository cost policy.

## Task 5: Final verification and handoff

- [x] Run focused tests, `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check` before review.
- [x] Obtain exact-head required CI evidence for the implementation PR; the
  hosted Windows suite remains disabled by the cost policy, so record the
  equivalent local/container evidence and the explicit re-enable condition.
- [ ] Merge a release-worthy test PR and record its merge SHA, release-job URL,
  tag, npm publication URL, and registry version.
- [ ] Merge a `no-release` test PR and record the absence of tag/publication.
- [ ] Move this checklist to `../closed/` only after both paths are proven.

## Completion Evidence

- [ ] A qualifying PR merge publishes one version from that merge SHA with
  recorded tag, Actions, npm, and registry evidence.
- [ ] A `no-release` merge and a rerun do not accidentally publish.
- [ ] The release path contains no legacy `release`-label lookup, post-merge
  `main` commit, release PR, or downstream tag-workflow dispatch. The explicit
  `no-release` exception remains intentionally supported.

## Recorded implementation evidence (2026-07-22)

- PR #63 merged the direct-main release design at merge SHA
  `0f675a767c1978647b69ac3f6f71ce617d59cda0`. Its exact-head Fast CI passed
  in [run 29948068571](https://github.com/mortenbroesby/astrograph/actions/runs/29948068571).
  Hosted Windows remained intentionally skipped by the cost rule; local package
  smoke and the Fast package smoke passed.
- The post-merge release job passed Fast, created
  `v0.5.1-alpha.156` for that exact SHA, then failed only at npm publication:
  [run 29948182486](https://github.com/mortenbroesby/astrograph/actions/runs/29948182486).
  Registry verification confirmed that version is still absent, so retrying the
  immutable tag is safe after the external configuration is corrected.
- PR #64 moved the executable retry into `ci.yml`, archived the former
  `release.yml` rather than deleting it, and bound both automatic and retry
  publishing to the `npm` environment. PR #65 made manual retries publish-only
  instead of spending Fast-CI minutes. Their main runs
  [29948789650](https://github.com/mortenbroesby/astrograph/actions/runs/29948789650)
  and [29949213303](https://github.com/mortenbroesby/astrograph/actions/runs/29949213303)
  passed with a no-op decision: no tag push and no npm publication.

## Remaining external prerequisite

Configure npm trusted publishing for package `astrograph` to GitHub owner
`mortenbroesby`, repository `astrograph`, workflow filename `ci.yml`, and
environment `npm`, with `npm publish` allowed. Then dispatch the **CI**
workflow with `tag=v0.5.1-alpha.156`, verify the npm registry result, rerun the
same release decision once for idempotence, and complete the unchecked fixture
and job-summary evidence before closing this checklist.
