# Human and Agent Onboarding Packs Delivery Checklist

> **Status:** Active — selected as the highest-impact unstarted precision
> retrieval story after the verified release-on-main delivery. This is Story 6
> of the [Precision Retrieval and Agent Experience Epic](../planned/1_precision-retrieval-agent-experience-epic.md).

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

- [ ] Record a command-and-write matrix for global and repository-local setup:
  Codex, Copilot, Copilot CLI, `--dry-run`, `--yes`, non-Git folders, and
  existing configuration. Include exact files that may change and whether each
  operation is safe to repeat.
- [ ] Run the existing focused installer, CLI-boundary, diagnostics, and packed
  package tests. Record command names, expected JSON/human output, and any
  platform limitation; do not infer behavior from README text alone.
- [ ] Verify `astrograph --diagnostics` from the packed artifact reports the
  installed version, storage location, global-client registration state, Node
  support, and actionable recovery guidance without needing a repository.
- [ ] Compare the tested behavior with README, first-steps, and CLI reference;
  list each mismatch as a separate bounded follow-up before implementing it.

## Task 2: Specify the smallest onboarding contract change

**Files:** this checklist; `specs/api-design/` or `specs/architecture/` only if
the baseline exposes a durable public contract decision.

- [ ] Decide whether existing behavior already satisfies the onboarding goal.
  If it does, close this checklist with command evidence rather than changing
  code.
- [ ] For every real gap, define one user-visible contract: inputs, proposed
  writes, dry-run result, idempotent repeat result, conflict/failure recovery,
  and global versus local storage boundary.
- [ ] Keep the MCP tool surface unchanged unless the existing install/diagnostic
  interfaces cannot express the required behavior. Do not add a generic router,
  background service, hidden configuration, or network synchronization.
- [ ] State the package-version decision before modifying `src/`, tests,
  scripts, package metadata, or TypeScript configuration.

## Task 3: Implement only measured gaps

**Files:** determined by Task 2; expected candidates are
`src/scripts/install.ts`, `src/diagnostics.ts`, `README.md`,
`docs/getting-started/first-steps.md`, `docs/reference/cli.md`, and focused
installer/CLI/package tests.

- [ ] Implement the smallest additive or corrective behavior justified by the
  baseline. Every write remains scoped, previewable with dry-run where
  applicable, and recoverable; never delete user configuration or cache data.
- [ ] Add focused fixtures for repeat invocation, an existing conflicting
  registration, a failed write, a non-Git folder, and global Copilot CLI/Codex
  registration where that path changes.
- [ ] Ensure packed-package tests execute the actual published CLI bin and
  verify both human-readable guidance and machine-readable output where the
  contract exposes it.
- [ ] Update the user-facing docs with one recommended global path, the
  explicit local alternative, diagnostics, and safe recovery. Avoid asking
  users to run `init` in every repository after global setup.

## Task 4: Verify, release, and close

- [ ] Run focused tests, `pnpm type-lint`, `pnpm test:package-bin`,
  `pnpm check:version-bump` when applicable, and `git diff --check`.
- [ ] Obtain exact-head Fast CI. Hosted Windows remains disabled under the cost
  rule; record equivalent local/container or package-smoke evidence and the
  condition for re-enabling the hosted job.
- [ ] Verify the published package from a clean temporary directory with
  `npx astrograph@<version> --diagnostics` and the selected dry-run setup
  commands; do not modify a real user configuration during verification.
- [ ] Move this checklist to `../closed/`, update the roadmap/indexes, and
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
