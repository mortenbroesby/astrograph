# Node 20–24 Runtime Compatibility Epic

> **Status:** Ready to merge — post-merge manual evidence remains. This is deliberately separate
> from the Runtime Acceleration Epic and must be delivered in its own branch
> and pull request.

**Goal:** Make the published Astrograph package reliably install and run on
supported Node.js 20, 22, and 24 releases, or narrow the public contract only
when an audited dependency or platform constraint makes a version infeasible.

**Architecture:** Compatibility is a published-package property, not merely a
source-test property. Each version must prove clean installation, native
> dependency loading, the packaged CLI and MCP entrypoints, and a small
> index/query workflow. Node 22 remains the fast required CI baseline; add
> bounded evidence for Node 20 and Node 24 without turning ordinary changes
> into an expensive permanent matrix.

**Tech Stack:** TypeScript, Node.js 20/22/24, pnpm, tsdown, Vitest,
better-sqlite3, Tree-sitter native grammars, GitHub Actions, npm pack.

## Current Evidence and Guardrails

- [July 2026 baseline review](../../../docs/reviews/node-20-to-24-compatibility-baseline-2026-07.md)
  records passing macOS x64 package evidence for Node 20.19, 22.23, and 24.13,
  plus the dependency and toolchain boundaries discovered while proving it.
- `package.json` now declares Node `^20.19.0 || >=22.12.0`; the existing
  required CI remains on Node 22.
- A work-laptop report says Astrograph fails under Node 24, but the exact
  command, platform, and error have not yet been captured. Reproduce and
  classify it before selecting a fix.
- Node 20 support is an explicit desired outcome, not an assumption. Do not
  lower `engines.node`, publish a claim, or add a compatibility shim until the
  packaged smoke proof passes on a maintained Node 20 release.
- Native modules (`better-sqlite3`, Tree-sitter and grammar packages,
  `@node-rs/xxhash`, and `@parcel/watcher`) are first-class compatibility
  surfaces: test their clean-install/prebuild/source-build paths on each target
  operating system before declaring a version supported.
- Preserve Node 22's fast required check and the GitHub Actions cost policy.
  Any new matrix or always-on runner requires measured cost and explicit
  approval under `.agents/rules/github-actions-cost.md`.

## Story 1: Establish a Reproducible Compatibility Baseline

**Goal:** Replace the unclassified Node 24 report and unproven Node 20 ambition
with exact, repeatable package-level evidence.

**Expected files:** `docs/reviews/node-20-to-24-compatibility-baseline-YYYY-MM.md`,
targeted tests or fixture scripts only if a missing proof is identified.

- [x] Run the contributor build/type-lint proof under the tsdown-supported Node
  22/24 toolchain. Under Node 20, test the already-built tarball with the
  prebuilt package smoke; do not require consumers to run `prepack`.
- [x] Exercise the packed CLI and MCP process against a disposable fixture;
  record runtime version, OS/architecture, package-manager version, exact
  command, stdout/stderr, and whether a native prebuild or local compilation
  was used.
- [x] Reproduce the reported Node 24 failure on the work laptop or gather its
  exact error. Classify it as source/runtime API, native ABI/install, toolchain,
  configuration, or environment-specific.
- [x] Inventory every package with an engine or native-binary boundary and name
  its compatible version range and fallback path.

**Acceptance criteria:** A review record contains a pass/fail table for each
target Node version and platform, plus a concrete child task for every failure.

## Story 2: Repair Only Proven Version Boundaries

**Goal:** Remove the smallest shared causes preventing the selected Node 20–24
contract.

**Expected files:** `package.json`, lockfile, build/runtime source, targeted
tests, and installation documentation identified by Story 1.

- [x] Replace or configure only APIs, build flags, and dependencies proven
  incompatible by Story 1; prefer supported dependency versions and portable
  Node APIs over version checks or parallel implementations.
- [x] Add one focused regression proof for every repaired shared boundary,
  including native load/rebuild behavior when relevant.
- [x] Keep generated `dist/` behavior and package-bin smoke parity with source
  behavior. Do not use development loaders as a production workaround.
- [x] Change `engines.node` only after every requested version passes the
  package-level gate. If Node 20 cannot be supported, document the exact
  blocker, upstream issue/selection gate, and an honest narrower range.

**Acceptance criteria:** Every repaired failure has a focused test or packaged
smoke proof, and no unsupported version is claimed in package metadata or docs.

## Story 3: Add Cost-Bounded Continuous Evidence

**Goal:** Detect Node 20–24 regressions before release without destabilizing
the existing fast CI contract.

**Expected files:** `.github/workflows/ci.yml` or a narrowly scoped companion
workflow, `.agents/rules/github-actions-cost.md` only if policy changes, and
relevant test scripts.

- [x] Measure the existing Node 22 CI cost and propose the least-expensive
  Node 20/24 coverage (for example, path-scoped package smoke or an opt-in
  release gate) before editing workflows.
- [x] Keep Node 22 as the required fast baseline; test Node 20 and 24 with the
  same packed-package/native-load contract selected in Story 1.
- [x] Preserve cache keys, scoped triggers, concurrency cancellation, and the
  fast-versus-expensive workflow split.
- [ ] Record exact CI evidence for all claimed Node versions.

**Acceptance criteria:** The automated evidence catches a broken supported
version while respecting the documented Actions cost guardrail.

## Story 4: Publish the Support Contract

**Goal:** Make the version promise understandable before installation and
actionable when an environment is outside it.

**Expected files:** `package.json`, `README.md`, `docs/getting-started/*`,
`docs/guides/troubleshooting.md`, and release notes as selected by prior
stories.

- [x] Align `engines.node`, installer diagnostics, README, and troubleshooting
  guidance to the proven Node range.
- [x] Explain Node 20/22/24 support in terms users can act on: version check,
  supported package-manager path, and the native-build prerequisites only when
  they are genuinely needed.
- [x] Add a concise failure message for an unsupported Node version if the
  current experience is cryptic; do not add an installer wizard or duplicate
  version policy.

**Acceptance criteria:** The package, install experience, and docs make the
same version promise and direct unsupported users to a single remedy.

## Final Verification and Release Checkpoint

- [x] Run the selected Node 20, 22, and 24 packaged smoke suite from clean
  installs, plus focused regression tests.
- [x] Run `pnpm type-lint`, `pnpm check:version-bump`, `pnpm agents:check`, and
  `git diff --check` under the repository toolchain.
- [x] Run the release-decision skill before the final source or package-metadata
  commit; compatibility fixes require the appropriate pre-release version bump.
- [ ] Link the exact CI runs and baseline review in the delivery checklist, then
  update the roadmap status only after the public contract is proven.

## Post-Merge Manual Gate

The Node 20 and Node 24 package jobs are intentionally not available until
`.github/workflows/node-compatibility.yml` reaches the default branch. After
merge, dispatch **Node package compatibility** once with `20` and once with
`24`, add both run links to the baseline review, then check the remaining
Story 3 and final-verification items and update the roadmap. PR CI run 372
already proves the required Node 22 baseline.
