# Registry Lookup with Native `fetch` Delivery Checklist

> **Status:** Active — selected Story 3 of the [npm-module adoption
> epic](../planned/2_npm-module-adoption-epic.md). Native Node `fetch` is the
> approved replacement after `latest-version` could not preserve cancellation.

**Goal:** Replace only generic npm registry-version subprocess calls with a
small native `fetch` seam while retaining explicit offline refusal, installer
update wording, timeout behavior, and release-transaction policy.

**Architecture:** A private native `fetch` helper reads the npm dist-tags
endpoint with `AbortController` cancellation. Astrograph retains package identity, the installer's safe
no-update fallback, the release agent's unavailable-registry rejection, custom
alpha-version parsing/comparison, and all release decisions. Do not change
registry choice, publishing, global installation, or the process seam.

**Tech stack:** TypeScript, Node.js `>=22.12.0`, pnpm, Vitest, native `fetch`,
npm, and the packed-package smoke.

---

## Task 1: Establish the lookup baseline and dependency fit

**Files:** `package.json`, `src/scripts/install.ts`,
`src/scripts/release-agent.ts`, focused tests, and this checklist.

- [x] Record both current `npm view … version` call sites, their arguments,
  working directory, timeout, success parsing, and error fallback. Preserve the
  installer's no-update behavior and the release agent's unavailable state.
- [x] Evaluate `latest-version` against Node, license, registry, timeout, and
  malformed-value requirements. Version 9.0.0 supports Node `>=18` and is MIT
  licensed, but its public options expose registry selection without a timeout
  or cancellation control; native Node `fetch` was selected instead.
- [x] Run focused installer, release-agent, release-policy, engine-contract,
  CLI-boundary, and package-bin tests plus `pnpm type-lint`. Record unavailable
  registry and malformed-version behavior before source changes.

## Baseline evidence (2026-07-23)

- `src/scripts/install.ts` invokes `npm view astrograph version` through the
  process seam with piped stdout, ignored stderr, and a 2.5-second timeout.
  Any command, transport, or normalization failure returns `null`, producing no
  update suggestion.
- `src/scripts/release-agent.ts` invokes `npm view astrograph version --json`
  from the package root with captured stdout/stderr and a 15-second timeout.
  It requires a JSON string and strict Astrograph version parsing; every error
  becomes the explicit `registry: unavailable` state that release policy
  rejects.
- `latest-version@9.0.0` reports Node `>=18`, MIT licensing, and only
  `package-json` as a runtime dependency. Its published API documents
  `version`, `registryUrl`, and `omitDeprecated` options, but no timeout,
  signal, or cancellation option. A `Promise.race` wrapper would not cancel the
  underlying request and would be a new asynchronous policy, not a transparent
  subprocess replacement.
- The exact semver source head passed 80 focused release/installer/CLI tests,
  type lint, and Fast CI's packed-package smoke. Release-policy coverage proves
  unavailable npm rejects the transaction; strict parser coverage proves a
  malformed registry version is not accepted. A local macOS package-smoke
  fixture has the separately recorded cache-root assertion mismatch; Linux CI
  remains the package baseline for this bounded dependency decision.
- Native Node `fetch` supports `AbortController` cancellation on Astrograph's
  Node floor. A read-only probe of npm's `/-/package/astrograph/dist-tags`
  endpoint returned the current `latest` version under a 2.5-second signal.

## Task 2: Add the smallest private lookup seam

**Files:** `package.json`, `src/lib/**` (new only if needed),
`src/scripts/install.ts`, `src/scripts/release-agent.ts`, and focused tests.

- [x] Add the private native `fetch` helper with explicit registry URL and
  `AbortController` timeout handling. Do not expose it through library, CLI, or
  MCP APIs.
- [x] Migrate installer lookup while preserving update messaging, installed
  version comparison, timeout, and its safe no-update fallback.
- [x] Migrate release-agent lookup while preserving package name, registry
  error text, unavailable-registry rejection, and custom release policy.
- [x] Add deterministic tests for success, unavailable registry, malformed
  registry value, timeout/error propagation, and unchanged decisions after
  normalization.

## Implementation evidence (2026-07-23)

- `src/lib/npm-registry.ts` is a private native-fetch helper for npm's
  dist-tags endpoint. It honors `npm_config_registry` when supplied, defaults
  to the public registry, URL-encodes package names, validates the `latest`
  dist-tag, and aborts the underlying request at the caller-provided timeout.
- The installer now awaits the helper with its existing 2.5-second limit and
  keeps every lookup, transport, HTTP, JSON, and normalization failure as the
  existing no-update result. The release agent is now an async entrypoint and
  awaits the helper with its existing 15-second limit; strict Astrograph-version
  parsing and unavailable-registry transaction refusal remain unchanged.
- `tests/npm-registry.test.ts` covers default/custom registry URLs, scoped
  package encoding, HTTP and malformed responses, and abort-driven timeout.
  The focused suite passed 81 tests with type lint and version policy at
  `0.5.1-alpha.163`.
- The packed-package smoke reached the installer and both global install paths
  with the new lookup. Its final diagnostics assertion still fails on macOS
  because the fixture expects the Linux `ASTROGRAPH_CACHE_HOME` layout while
  macOS intentionally resolves `ASTROGRAPH_HOME`; this pre-existing unrelated
  mismatch remains outside the registry lookup change.

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
