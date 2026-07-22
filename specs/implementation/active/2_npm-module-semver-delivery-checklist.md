# Generic Version Handling with `semver` Delivery Checklist

> **Status:** Active — selected Story 2 of the [npm-module adoption
> epic](../planned/2_npm-module-adoption-epic.md).

**Goal:** Replace generic semantic-version parsing and ordering with the
maintained `semver` package while retaining Astrograph's product-specific
alpha-increment release policy, error wording where practical, and safe
registry-unavailable behavior.

**Architecture:** `semver` owns generic validity, comparison, prerelease, and
coercion questions. Astrograph retains the explicit
`major.minor.patch-alpha.increment` contract, monotonic-alpha rule, release
kind policy, transaction decisions, and user-facing update/recovery wording.
Do not begin Story 3's registry-lookup replacement in this story.

**Tech stack:** TypeScript, Node.js `>=22.12.0`, pnpm, Vitest, `semver`, npm,
and the existing release/installer/package smoke.

## Task 1: Establish the version-semantics baseline

**Files:** `src/version.ts`, `src/release-transaction.ts`,
`src/scripts/install.ts`, `src/scripts/release-agent.ts`, relevant tests,
`package.json`, and this checklist.

- [x] Map each handwritten generic parser/comparator and classify it as either
  generic semver handling or Astrograph-specific alpha/release policy. The
  known candidates are the installer comparable-version parser/orderer,
  `compareAstrographVersions`, and version validation helpers.
- [x] Verify the selected `semver` release supports Node `>=22.12.0`, has an
  acceptable license, and provides the exact validation/comparison/prerelease
  APIs needed without coercing malformed Astrograph versions into acceptance.
- [x] Run focused release-policy, release-agent, installer/engine-contract,
  CLI-boundary, and package-bin checks. Record invalid, legacy, prerelease,
  equal, newer-main, newer-registry, and unavailable-registry behavior before
  source changes.

## Task 2: Replace only generic version mechanics

**Files:** `package.json`, `pnpm-lock.yaml`, the classified source helpers,
and focused tests.

- [x] Add `semver` at the verified version and centralize its use behind the
  smallest internal helper(s); do not add a public API or compatibility alias.
- [x] Replace generic parsing/ordering in installer update suggestions and
  release transaction comparisons while preserving explicit Astrograph alpha
  validation and release-policy decisions.
- [x] Preserve rejection of malformed versions, legacy-baseline handling, and
  user-facing registry/network failure behavior. Do not replace Story 3's
  `npm view` subprocesses in this slice.
- [x] Add focused tests that prove semantic equivalence for normal alpha
  versions, prerelease ordering, equal values, invalid values, and the
  monotonic alpha increment across patch/minor/major policy outcomes.

## Task 3: Verify release and installer safety

- [ ] Run focused semver, release-policy, release-agent, installer/engine,
  CLI, and package-bin tests; run `pnpm type-lint`, `pnpm check:version-bump`,
  and `git diff --check`.
- [ ] Exercise an unavailable-registry path and a malformed registry version
  without accepting an unsafe update or release transaction.
- [ ] Obtain exact-head Fast CI and the current package/platform cost-boundary
  evidence before merging source changes.

## Task 4: Close and select the next goal

- [ ] Verify the merged package from a clean temporary directory where the
  installer update/version path is observable.
- [ ] Move this checklist to `../closed/`, update the roadmap/indexes and
  `pointer.md`, and select Story 3 (`latest-version` registry lookup) only if
  semver behavior, package evidence, and release safety are complete.

## Acceptance evidence

- Generic semver parsing/comparison is library-backed; no handwritten generic
  comparison remains in the selected scope without a documented product reason.
- Astrograph's alpha-release, legacy-baseline, and release-transaction policy
  remains explicit and regression-tested.
- Installer messaging and release refusal remain safe when the registry is
  unavailable or returns malformed data.
- Exact-head CI and a published-package check prove the change does not
  regress CLI, installer, release, or package behavior.

## Baseline and implementation evidence (2026-07-22)

- `semver@7.8.5` is ISC licensed and supports Node `>=10`, exceeding
  Astrograph's `>=22.12.0` floor. Baseline type lint and 77 focused
  release-policy, release-agent, installer/engine-contract, and CLI tests
  passed from `80dfd3c`.
- `src/scripts/install.ts` contained the generic permissive parser and a
  string fallback that could misorder numeric prerelease identifiers. The
  strict Astrograph alpha parser, legacy baseline parser, monotonic bump
  assessment, release-kind policy, and registry refusal remain product code.
- New focused tests prove generic numeric prerelease ordering, stable versus
  prerelease ordering, and invalid-version rejection without coercion.
