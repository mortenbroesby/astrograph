# Human and Agent Onboarding Packs Delivery Checklist

> **Status:** Closed — completed in PR #70 and published as
> `astrograph@0.5.1-alpha.160`. This was Story 6 of the [Precision Retrieval
> and Agent Experience Epic](../planned/1_precision-retrieval-agent-experience-epic.md).

**Goal:** Make a first-time Astrograph setup and recovery path understandable,
inspectable, idempotent, and safe for people and agents without requiring
internal command knowledge.

**Architecture:** Start by measuring the existing `init`, global `install`,
diagnostics, and docs flows rather than duplicating them. Preserve global
user-level registration as the default cross-repository path, repository-local
setup as an explicit alternative, dry-run before writes, and archive-first
cache recovery. Add or adjust only the smallest missing behavior demonstrated
by the matrix and packed-package smoke.

**Tech Stack:** TypeScript, Node.js 22+, Commander, pnpm, Vitest, packed npm
artifact smoke, Codex, Copilot, Copilot CLI, and Markdown documentation.

## Task 1: Establish the audited setup baseline

**Files:** `src/scripts/install.ts`, `src/diagnostics.ts`, `README.md`,
`docs/getting-started/first-steps.md`, `docs/reference/cli.md`, existing
installer/CLI/package tests, and this checklist.

- [x] Record a command-and-write matrix for global and repository-local setup:
  Codex, Copilot, Copilot CLI, `--dry-run`, `--yes`, non-Git folders, and
  existing configuration. Include exact files that may change and whether each
  operation is safe to repeat.
- [x] Run the existing focused installer, CLI-boundary, diagnostics, and packed
  package tests. Record command names, expected JSON/human output, and any
  platform limitation; do not infer behavior from README text alone.
- [x] Verify `astrograph --diagnostics` from the packed artifact reports the
  installed version, storage location, global-client registration state, Node
  support, and actionable recovery guidance without needing a repository.
- [x] Compare the tested behavior with README, first-steps, and CLI reference;
  list each mismatch as a separate bounded follow-up before implementing it.

## Task 2: Specify the smallest onboarding contract change

**Files:** this checklist; `specs/api-design/` or `specs/architecture/` only if
the baseline exposes a durable public contract decision.

- [x] Decide whether existing behavior already satisfies the onboarding goal.
  If it does, close this checklist with command evidence rather than changing
  code.
- [x] For every real gap, define one user-visible contract: inputs, proposed
  writes, dry-run result, idempotent repeat result, conflict/failure recovery,
  and global versus local storage boundary.
- [x] Keep the MCP tool surface unchanged unless the existing install/diagnostic
  interfaces cannot express the required behavior. Do not add a generic router,
  background service, hidden configuration, or network synchronization.
- [x] State the package-version decision before modifying `src/`, tests,
  scripts, package metadata, or TypeScript configuration.

## Task 3: Implement only measured gaps

**Files:** determined by Task 2; expected candidates are
`src/scripts/install.ts`, `src/diagnostics.ts`, `README.md`,
`docs/getting-started/first-steps.md`, `docs/reference/cli.md`, and focused
installer/CLI/package tests.

- [x] Implement the smallest additive or corrective behavior justified by the
  baseline. Every write remains scoped, previewable with dry-run where
  applicable, and recoverable; never delete user configuration or cache data.
- [x] Add focused fixtures for repeat invocation, an existing conflicting
  registration, a failed write, a non-Git folder, and global Copilot CLI/Codex
  registration where that path changes.
- [x] Ensure packed-package tests execute the actual published CLI bin and
  verify both human-readable guidance and machine-readable output where the
  contract exposes it.
- [x] Update the user-facing docs with one recommended global path, the
  explicit local alternative, diagnostics, and safe recovery. Avoid asking
  users to run `init` in every repository after global setup.

## Task 4: Verify, release, and close

- [x] Run focused tests, `pnpm type-lint`, `pnpm test:package-bin`,
  `pnpm check:version-bump` when applicable, and `git diff --check`.
- [x] Obtain exact-head Fast CI. Hosted Windows remains disabled under the cost
  rule; record equivalent local/container or package-smoke evidence and the
  condition for re-enabling the hosted job.
- [x] Verify the published package from a clean temporary directory with
  `npx astrograph@<version> --diagnostics` and the selected dry-run setup
  commands; do not modify a real user configuration during verification.
- [x] Move this checklist to `../closed/`, update the roadmap/indexes, and
  select exactly one subsequent evidence-gated story only after all acceptance
  evidence is recorded.

## Acceptance evidence

- A user can choose global or local setup from one concise path and preview
  every proposed write before it happens.
- Repeating setup is safe and reports the existing healthy state clearly.
- Diagnostics from the installed package explain version, storage, client
  registration, and a safe recovery action without requiring a repository.
- The final documented path is proven against the packed package, exact-head
  Fast CI, and cost-boundary evidence.

## Baseline and gap decision (2026-07-22)

- `tests/engine-contract.test.ts -t "global|setup"` proved dry-run and
  idempotent repository-local setup, scoped conflict handling, Node/PATH
  failures, global Codex and Copilot CLI registration, non-Git-compatible
  storage behavior, and global cache isolation across two repositories.
- The established command/write matrix is: `init --yes` writes repository-owned
  configuration and may add the package dependency; `init --dry-run` previews
  those writes; `install --global` writes only user-level Codex or Copilot CLI
  registration plus global Astrograph configuration; global use requires no
  per-repository `init`. Existing invalid config and failed-write paths reject
  before mutating a second configuration file.
- README, first-steps, and CLI reference already state the recommended global
  path, the explicit local alternative, diagnostics, and archive-first
  recovery. No user-facing contract mismatch justified new setup machinery.
- The only measured gap was test coverage: the packed-package smoke exercised
  setup and registration but not `astrograph --diagnostics`. It now verifies
  package identity/version, supported Node runtime, global storage/cache root,
  both client registrations, and a next-step hint from the actual packed bin.
- This is test-script work, so `package.json` advances from `.157` through
  `.160` across the baseline and packed-smoke environment fixes under the
  monotonic version policy. No MCP tool, configuration-write behavior, or
  documentation contract changes.

## Closure evidence (2026-07-22)

- PR #70 merged the exact head `5c06638dc4ba31be10e8113bc44c531193375e38` as
  `45cbc634d0654f9225b213d9175ffd7bd504b0e5`. Its Fast required check passed.
  The hosted Windows job was intentionally skipped under the retained Actions
  cost boundary; the packed-bin smoke remains the required portable proof
  until a re-enable budget and explicit approval exist.
- The immutable tag `v0.5.1-alpha.160` points at that merge and npm reports
  `astrograph@latest` as `0.5.1-alpha.160`.
- A clean temporary-home package run used
  `pnpm dlx astrograph@0.5.1-alpha.160 --diagnostics` and
  `install --global --ide copilot-cli --dry-run`, with the actual Node binary
  first on `PATH` to avoid this host's version-manager shim. Diagnostics
  reported `.160`, Node 24.13.0 as supported, unconfigured temporary paths,
  and the global Copilot CLI next step; dry-run returned both configuration
  previews. Assertions confirmed it created no temporary-home Astrograph
  config, Copilot configuration, or cache database, so no user configuration
  was touched. The retained temporary root is
  `/private/tmp/astrograph-onboarding-verify.ojd5bQ` for inspection.
- The next selected goal is the bounded process-execution seam in the
  [npm-module adoption epic](../planned/2_npm-module-adoption-epic.md). Its
  dedicated active checklist owns all further implementation decisions.
