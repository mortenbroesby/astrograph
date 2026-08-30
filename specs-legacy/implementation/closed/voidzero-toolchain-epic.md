# VoidZero Toolchain Epic

> **Status:** Done — merged in PR #105 (`c3571bb`).

**Goal:** Replace Astrograph's unmaintained package bundler with the supported
VoidZero library toolchain, while keeping production on compiled JavaScript and
adopting additional VoidZero tools only where they remove a demonstrated cost.

**Architecture:** `tsdown` owns JavaScript bundles and public declaration
output. `tsc` remains the type checker, not an emitter. Production CLI, MCP,
and package entrypoints run only `dist/` JavaScript. A later story may use
`tsx` exclusively for developer-only source scripts. Internal aliases must be
proven through source execution, Vitest, tsdown output, and a packed consumer.

**Tech Stack:** Node 22, pnpm, TypeScript, tsdown/Rolldown/Oxc, Vitest.

## Selection Boundaries

- Adopt now: `tsdown` in place of `tsup`, retaining Vitest.
- Evaluate later: `tsx` for developer-only source runners and
  `#astrograph/*` internal aliases.
- Evaluate only with a rule inventory: Oxlint/Oxfmt.
- Do not adopt now: Vite's dev server, direct Rolldown configuration, or Vite+.
  Astrograph is a Node package, and Vite+ beta would replace the established
  ASDF Node/pnpm workflow without a demonstrated benefit.

## Story 1: Migrate the Package Build to tsdown

**Files:** `package.json`, `pnpm-lock.yaml`, build/package contract tests, and
`tsdown.config.ts` only if package scripts cannot express the entrypoint set.

- [x] Establish a baseline with `pnpm type-lint`, `pnpm build`,
  `pnpm test:package-bin`, and `pnpm exec vitest run tests/engine-contract.test.ts`.
- [x] Replace tsup with tsdown while preserving every emitted executable
  entrypoint, ESM format, Node 22 target, worker output, source maps, and
  package `main`/`types`/`bin` contracts.
- [x] Let tsdown generate declarations; keep `tsc --noEmit` for type checking
  only and remove the standalone declaration emitter only if it is redundant.
- [x] Add a packed-consumer type-check proving `astrograph` resolves from a
  freshly packed tarball and generated declarations contain no unresolved
  internal alias.

**Acceptance:** `dist/` contains working ESM entrypoints and consumer-safe
declarations; build, package-bin, MCP smoke, and type checks pass with no tsup
dependency or standalone declaration-emission command.

## Story 2: Use a Stable Developer-Only TypeScript Runtime

- [x] Inventory each current `--experimental-strip-types` caller: CLI, MCP,
  daemon, workers, config loading, and packaged maintenance scripts are
  production/package paths; benchmarks, test runner, and explicit `dev:*`
  commands are developer-only.
- [x] Move production and packaged paths to compiled `dist/` JavaScript,
  including release and version-check scripts. Repository configuration remains
  typed `astrograph.config.ts`, loaded through the stable, config-specific
  `jiti` runtime loader; JSON remains a fallback for existing repositories.
- [x] Use `node --import=tsx` only for developer-only source execution that
  cannot use a built artifact; `tsx` is a development dependency only.
- [x] Delete every `--experimental-strip-types` command and prove source,
  built, packed, and MCP paths separately with focused runtime, engine-contract,
  and package smoke checks.

**Acceptance:** supported production/package commands run compiled JavaScript;
the explicit repository-config boundary may load `astrograph.config.ts` through
the stable, config-specific `jiti` runtime loader. Developer source execution
uses a supported runtime loader where needed.

## Story 3: Establish Internal Module Aliases

- [x] Use `#astrograph/*` only for cross-directory module boundaries; retain
  sibling `./module.ts` imports.
- [x] Prove the mapping in the developer runtime, Vitest, tsdown output, and
  declarations before converting imports.
- [x] Migrate the five existing multi-parent imports first; package output and
  declarations contain no alias leaks.

**Acceptance:** aliases improve cross-tree navigation without appearing in
published JavaScript/declarations or breaking direct developer execution.

## Story 4: Evaluate Oxc Enforcement

- [x] Inventory current lint/format rules and measurable CI timing: no existing
  linter or formatter was configured; an Oxlint trial across source, benchmarks,
  and tests completed in about 1.5 seconds.
- [x] Trial Oxlint without changing required CI.
- [x] Adopt only the scoped `no-restricted-imports` rule that protects the
  shared package-script process seam; `lint:runtime` remains opt-in and does
  not duplicate TypeScript checks or become a formatter.

**Acceptance:** any Oxc adoption replaces a specific existing gap; it is not a
second linter or formatter by default.

## PR #105 Review Follow-ups

- [x] Exercise the compiled release agent in CI; the existing fast job keeps
  its triggers, runner, cache, and cost profile unchanged.
- [x] Keep the source-checkout pre-push version gate runnable before a build by
  using the developer-only `tsx` loader; published CLI and MCP entrypoints plus
  the release agent remain compiled `dist/` JavaScript.
- [x] Exclude both `astrograph.config.ts` and the JSON fallback from indexing,
  and update CLI fixture expectations to reflect that product behavior.
- [x] Keep `astrograph.config.ts` as the typed primary configuration contract.
  `astrograph install` creates a typed starting point with `defineConfig`; JSON
  remains a quiet fallback when no TypeScript configuration exists.
- [x] Record the full test suite as the local merge gate. Do not add it to the
  required GitHub-hosted job without explicit Actions-cost approval; the
  existing required job remains intentionally fast.

## Verification and Commit Checkpoint

For source, package, test, or configuration changes, run focused checks first,
then `pnpm type-lint`, `pnpm build`, `pnpm test:package-bin`,
`pnpm check:version-bump`, and `git diff --check`. Run `pnpm agents:check`
whenever tracked package or toolchain configuration changes. Do not edit GitHub
Actions unless the cost rule is separately reviewed.

## Rollback

PR #105 deliberately delivers all four stories together. Reverting that PR
restores the former toolchain; no user data, package format, or persistent
storage migration is involved.
