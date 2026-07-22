# Process Execution Seam with `execa` Delivery Checklist

> **Status:** Active — selected Story 1 of the [npm-module adoption
> epic](../planned/2_npm-module-adoption-epic.md).

**Goal:** Replace the repetitive, generic child-process plumbing in the three
selected scripts with one small, tested `execa`-backed seam while preserving
Astrograph's current output, errors, exit propagation, timeout behavior, and
Windows compatibility.

**Architecture:** Add a narrow internal process module instead of exposing a
general process abstraction. Migrate only `run-vitest.ts`, `release-agent.ts`,
and `install.ts`; leave runtime subprocesses, source-control refresh, package
smoke, test fixtures, and Astrograph-specific workflow decisions untouched.
The wrapper must keep an explicit synchronous contract where the scripts rely
on it, so this story does not force an unrelated async rewrite.

**Tech stack:** TypeScript, Node.js `>=22.12.0`, pnpm, Vitest, `execa`, and the
existing packed-package smoke.

## Task 1: Establish the process baseline and dependency fit

**Files:** `package.json`, `src/scripts/run-vitest.ts`,
`src/scripts/release-agent.ts`, `src/scripts/install.ts`, their focused tests,
and this checklist.

- [ ] Record each target's current command, arguments, working-directory,
  stdio, timeout, successful result, and non-zero/error behavior. The known
  direct call sites are `spawnSync` in `run-vitest.ts`, `execFileSync` for git
  and npm lookup in `release-agent.ts`, and `execFileSync` for npm/git/config
  support in `install.ts`.
- [ ] Verify the selected `execa` release supports Node `>=22.12.0`, has an
  acceptable license, and exposes the synchronous behavior required by these
  scripts. Record the selected version and why no async migration is needed.
- [ ] Run the current focused release-agent, installer/engine-contract,
  CLI-boundary, and package-bin tests plus `pnpm type-lint`; stop and record
  any baseline failure before changing source.

## Task 2: Add the smallest internal seam and migrate only the targets

**Files:** `package.json`, `pnpm-lock.yaml`, `src/lib/process.ts` (new),
`src/scripts/run-vitest.ts`, `src/scripts/release-agent.ts`,
`src/scripts/install.ts`, and focused tests such as `tests/process.test.ts`.

- [ ] Add `execa` at the verified version and create a small internal wrapper
  with explicit options for `cwd`, encoding, stdio, timeout, and error
  propagation. Do not make it a public export.
- [ ] Migrate `run-vitest.ts` first, retaining its normalized arguments and
  exit-code behavior. Add a focused test proving a non-zero child process is
  surfaced without losing actionable output.
- [ ] Migrate the release agent's generic git/npm commands without changing
  Astrograph's alpha policy, registry-unavailable handling, or release
  transaction semantics.
- [ ] Migrate installer generic git/npm calls without changing managed-block
  edits, dry-run, archive-first recovery, or global/local storage behavior.
- [ ] Document any remaining direct synchronous process call inside these
  three files with the specific product reason; do not expand the migration to
  unrelated runtime, test, or refresh code.

## Task 3: Verify the behavior-preserving migration

- [ ] Run focused process, release-agent, installer/engine-contract, CLI, and
  package-bin tests; run `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check`.
- [ ] Exercise a failed command, a registry-unavailable fixture or equivalent
  controlled failure, an installer dry-run, and a Windows-compatible argument
  case. Record the observed error/exit behavior.
- [ ] Obtain exact-head Fast CI and the cost-boundary platform/package proof
  required by the current workflow before merging any source change.

## Task 4: Close and select the next goal

- [ ] Verify the merged package from a clean temporary directory where the
  migration affects a packaged command.
- [ ] Move this checklist to `../closed/`, update the roadmap/indexes and
  `pointer.md`, and select Story 2 (generic version handling with `semver`)
  only if this seam's behavior and package evidence are complete.

## Acceptance evidence

- The three target scripts no longer contain generic direct
  `spawnSync`/`execFileSync` calls unless an explicit product-specific reason
  is documented.
- Error text, non-zero propagation, cwd, timeout, and stdio behavior remain at
  least as actionable as the baseline on supported Node and Windows paths.
- The internal wrapper is covered by focused tests and does not become a new
  public Astrograph API.
- Exact-head CI and packed-package evidence prove the published CLI and
  installer/release workflows remain safe.
