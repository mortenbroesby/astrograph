# Release on Main Merge Delivery Checklist

> **Status:** Ready — highest-priority planned operational work. It replaces
> the label-gated release-proof obligation formerly tracked as Story 8 of the
> [Remaining Delivery Epic](./3_remaining-delivery-epic.md).

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

- [ ] Preserve the checkout-independent monotonic alpha-version comparator and
  coupled version ownership (`package.json` plus engine-contract expectation).
- [ ] Add pure fixtures for ordinary eligible merge, `no-release`, missing
  required bump, duplicate tag, registry-newer version, malformed version,
  unavailable registry, and rerun after a successful publish.
- [ ] Make PR CI report a machine-readable release decision without writing.
- [ ] Make post-merge apply accept only the exact merge candidate that passed
  the decision; it may tag/publish but never edits `main`.
- [ ] Run focused release-policy/agent tests and `pnpm type-lint`; expected:
  deterministic decisions and no network in unit tests.

## Task 3: Replace the workflow loop

**Files:** `src/scripts/release-agent.ts`, package scripts if needed, and
focused release tests.

- [ ] Keep `pnpm release:plan` side-effect free and useful locally; if a local
  apply command remains, make its changed files explicit and require it before
  merging the owning PR.
- [ ] Run the post-merge release job only after the existing required fast
  gate succeeds. Do not re-run tests in the release job.
- [ ] Remove label discovery, release-branch/PR creation, and downstream
  workflow dispatch from the automatic path. Retain a guarded manual plan or
  recovery command only if it shares the same decision module.
- [ ] Request only the job-scoped GitHub permissions required for tag creation
  and trusted npm publication; keep workflow-token defaults read-only.
- [ ] Emit candidate SHA, version, tag, registry state, publish result, and
  no-op reason in the job summary.

## Task 4: Verify the complete merge-to-npm flow

**Files:** `.github/workflows/ci.yml`, `docs/reference/release.md`, and
`specs/implementation/release-agent.md`.

- [ ] Update `docs/reference/release.md`, README release guidance, and the
  workflow comments with the simple rule: qualifying PR merge → verified tag
  → npm publish; `no-release` is the exception.
- [ ] Prove one release-worthy PR merge creates exactly one tag and one npm
  publication for the merge SHA, with the GitHub Actions and npm URLs recorded.
- [ ] Prove one docs/spec or `no-release` merge does not tag or publish.
- [ ] Prove a rerun is idempotent and a bad/stale registry state fails before
  publish with an actionable summary.
- [ ] Keep the release-only job short and no-test; record any Actions cost
  change under the repository cost policy.

## Task 5: Final verification and handoff

- [ ] Run focused tests, `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check` before review.
- [ ] Obtain exact-head required CI evidence for the implementation PR; the
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
- [ ] The release path contains no label lookup, post-merge `main` commit,
  release PR, or downstream tag-workflow dispatch.
