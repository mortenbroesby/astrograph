# Package-Confidence CI Cost Review Checklist

> **Status:** Active — evidence-gathering prerequisite for Stories 4–6 of the
> [npm-module adoption epic](../planned/2_npm-module-adoption-epic.md). This is
> not authorization to edit a workflow or add a package dependency.

**Goal:** Decide whether Astrograph can select a package-confidence story
without exceeding its GitHub Actions cost policy, beginning with `publint` and
the packed-tarball type/export candidate.

**Architecture:** Capture the current Fast CI duration, trigger scope, package
smoke coverage, and candidate command cost. Compare a local, packed-tarball
baseline with the workflow guardrail. Select exactly one package-confidence
story only when its placement avoids a material increase in hosted minutes;
otherwise record it as blocked with the evidence needed to revisit it.

**Tech stack:** pnpm, npm pack, `publint`, `@arethetypeswrong/cli`, GitHub
Actions metadata, and Markdown implementation records.

---

## Task 1: Establish the current package and CI baseline

**Files:** this checklist, `docs/reference/release.md` (read only),
`.github/workflows/ci.yml` (read only), package-smoke scripts/tests (read only).

- [x] Record current Fast CI runtime, trigger filters, caching, concurrency,
  package-smoke coverage, and the disabled Windows boundary from a successful
  merged-main run.
- [x] Run the existing local packed-package smoke or document any
  platform-specific fixture limitation separately from CI evidence.
- [ ] Record the candidate packages' Node support, license, tarball input,
  command behavior, and likely runner-time impact without adding either one.

## Baseline evidence (2026-07-23)

- Merged-main CI run `30016862772` completed Fast required checks in 57 seconds
  (14:39:47–14:40:44 UTC). Its existing package smoke occupied 22 seconds
  (14:40:17–14:40:39 UTC). The workflow retains path-scoped PR/push triggers,
  dependency caching, PR concurrency cancellation, and a separate guarded
  release job. Hosted Windows remains explicitly disabled to avoid paid
  runner minutes.
- Fast CI's Linux package smoke passed for the merged `0.5.1-alpha.163`
  artifact. The local macOS package-smoke fixture still has the separately
  recorded cache-root expectation mismatch, so it is not used to judge the
  package-confidence candidates.
- npm metadata identifies `publint@0.3.22` as MIT, Node `>=18`, with a
  `publint` binary and 115,096-byte unpacked package. `@arethetypeswrong/cli@
  0.18.5` is MIT, Node `>=20`, with an `attw` binary and 59,387-byte unpacked
  package. Both satisfy Astrograph's Node `>=22.12.0` floor and accept a packed
  tarball as their intended input.
- An ephemeral tarball run was intentionally not performed: the environment
  requires explicit user approval before downloading and executing third-party
  npm code against a local repository artifact. Record actual command outcome
  and wall time after that approval; do not infer a hosted-minute estimate from
  package size alone.

## Task 2: Make a selection recommendation without changing CI

**Files:** this checklist, the npm-module adoption epic, roadmap, and indexes.

- [ ] Identify a placement that retains scoped triggers, dependency caching,
  PR concurrency cancellation, and the fast-required versus expensive-optional
  split; do not edit `.github/workflows/**`.
- [ ] Classify each candidate as selectable with no material Actions cost,
  blocked pending explicit `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true`, or
  unsuitable for Astrograph's package contract.
- [ ] Choose at most one next implementation checklist. If no candidate clears
  the gate, update the roadmap to show the external cost decision as blocked.

## Task 3: Verify and hand off

- [ ] Run `git diff --check` and verify all implementation links and indexes.
- [ ] Keep `pointer.md` on this evidence checklist until a selected successor
  has a detailed active plan and its cost gate is documented.

## Acceptance evidence

- The recommendation is based on current Fast CI and packed-package evidence,
  not an assumed free Actions budget.
- No workflow, dependency, release, or package-version change occurs during the
  review.
- Any later workflow proposal can be reviewed against the recorded guardrail
  with a concrete expected runner-minute impact.
