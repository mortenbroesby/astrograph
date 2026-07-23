# Registry Lookup with `latest-version` Delivery Checklist

> **Status:** Active — selected Story 3 of the [npm-module adoption
> epic](../planned/2_npm-module-adoption-epic.md).

**Goal:** Replace only generic npm registry-version subprocess calls with a
small `latest-version` seam while retaining explicit offline refusal, installer
update wording, timeout behavior, and release-transaction policy.

**Architecture:** `latest-version` may answer the generic latest-published
version question. Astrograph retains package identity, the installer's safe
no-update fallback, the release agent's unavailable-registry rejection, custom
alpha-version parsing/comparison, and all release decisions. Do not change
registry choice, publishing, global installation, or the process seam.

**Tech stack:** TypeScript, Node.js `>=22.12.0`, pnpm, Vitest,
`latest-version`, npm, and the packed-package smoke.

---

## Task 1: Establish the lookup baseline and dependency fit

**Files:** `package.json`, `src/scripts/install.ts`,
`src/scripts/release-agent.ts`, focused tests, and this checklist.

- [ ] Record both current `npm view … version` call sites, their arguments,
  working directory, timeout, success parsing, and error fallback. Preserve the
  installer's no-update behavior and the release agent's unavailable state.
- [ ] Verify the selected `latest-version` release supports Node
  `>=22.12.0`, has an acceptable license, exposes bounded timeout/registry
  configuration, and does not silently coerce malformed registry values.
- [ ] Run focused installer, release-agent, release-policy, engine-contract,
  CLI-boundary, and package-bin tests plus `pnpm type-lint`. Record unavailable
  registry and malformed-version behavior before source changes.

## Task 2: Add the smallest private lookup seam

**Files:** `package.json`, `pnpm-lock.yaml`, `src/lib/**` (new only if needed),
`src/scripts/install.ts`, `src/scripts/release-agent.ts`, and focused tests.

- [ ] Add the verified dependency and centralize only generic latest-version
  retrieval behind a private helper. Do not expose it through library, CLI, or
  MCP APIs.
- [ ] Migrate installer lookup while preserving update messaging, installed
  version comparison, timeout, and its safe no-update fallback.
- [ ] Migrate release-agent lookup while preserving package name, registry
  error text, unavailable-registry rejection, and custom release policy.
- [ ] Add deterministic tests for success, unavailable registry, malformed
  registry value, timeout/error propagation, and unchanged decisions after
  normalization.

## Task 3: Verify release and installer safety

- [ ] Run focused lookup, release-agent, release-policy, installer/engine,
  CLI, and package-bin tests; run `pnpm type-lint`,
  `pnpm check:version-bump`, and `git diff --check`.
- [ ] Exercise unavailable and malformed registry responses without suggesting
  an unsafe update or allowing a release transaction.
- [ ] Obtain exact-head Fast CI and current package/platform cost-boundary
  evidence before merging source changes.

## Task 4: Close and select the next goal

- [ ] Verify the merged package from a clean temporary directory where the
  installer version-check and release lookup paths are observable.
- [ ] Move this checklist to `../closed/`, update roadmap/indexes and
  `pointer.md`, and select the next story only if behavior, package evidence,
  and release safety are complete.

## Acceptance evidence

- Generic registry lookup is dependency-backed without changing Astrograph's
  product-specific decision policy.
- Unavailable, malformed, and timed-out responses retain safe refusal or
  no-update behavior with actionable wording.
- The helper stays private and does not broaden MCP, CLI, or library APIs.
- Exact-head CI and packed-package evidence prove installer and release safety.
