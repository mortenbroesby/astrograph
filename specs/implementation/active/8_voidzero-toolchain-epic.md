# VoidZero Toolchain Epic

> **Status:** Active — selected by the user on 2026-07-26.

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

- [ ] Inventory each current `--experimental-strip-types` caller and classify
  it as production, packaged maintenance script, or developer-only runner.
- [ ] Move production and packaged paths to compiled `dist/` JavaScript.
- [ ] Use `node --import=tsx` only for developer-only source execution that
  cannot use a built artifact; do not make the package runtime depend on tsx.
- [ ] Delete every `--experimental-strip-types` command and prove source,
  built, packed, and MCP paths separately.

**Acceptance:** no supported production/package command executes TypeScript;
developer source execution uses a supported runtime loader where needed.

## Story 3: Establish Internal Module Aliases

- [ ] Use `#astrograph/*` only for cross-directory module boundaries; retain
  sibling `./module.ts` imports.
- [ ] Prove the mapping in the developer runtime, Vitest, tsdown output, and
  declarations before converting imports.
- [ ] Migrate the five existing multi-parent imports first; expand only after
  package and declaration tests show no alias leaks.

**Acceptance:** aliases improve cross-tree navigation without appearing in
published JavaScript/declarations or breaking direct developer execution.

## Story 4: Evaluate Oxc Enforcement

- [ ] Inventory current lint/format rules and measurable CI timing.
- [ ] Trial Oxlint without changing required CI.
- [ ] Adopt only rules that protect the agreed import/runtime contract and do
  not duplicate TypeScript checks.

**Acceptance:** any Oxc adoption replaces a specific existing gap; it is not a
second linter or formatter by default.

## Verification and Commit Checkpoint

For source, package, test, or configuration changes, run focused checks first,
then `pnpm type-lint`, `pnpm build`, `pnpm test:package-bin`,
`pnpm check:version-bump`, and `git diff --check`. Run `pnpm agents:check`
whenever tracked package or toolchain configuration changes. Do not edit GitHub
Actions unless the cost rule is separately reviewed.

## Rollback

Each story has a dedicated PR. Reverting its PR restores the former toolchain;
no user data, package format, or persistent storage migration is involved.
