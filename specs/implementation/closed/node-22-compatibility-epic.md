# Node 22 Compatibility Epic

> **Status:** Closed — the Node 22 compatibility story is complete. The shared
> release-publication follow-up moved to the
> [Remaining Delivery Epic](../planned/remaining-delivery-epic.md).

**Goal:** Lower Astrograph's entry barrier by making Node.js 22 LTS the minimum
supported runtime for installation, CLI use, MCP stdio, indexing, refresh, and
package consumption.

**Architecture:** Runtime compatibility is defined by the published package,
build target, and user-facing setup contract. The existing primary CI runner
will become the Node 22 compatibility gate rather than adding a broad version
matrix; Node 24 remains supported but is not required for users.

**Tech Stack:** TypeScript, Node.js 22 LTS, pnpm, tsup, Vitest, SQLite, GitHub
Actions, npm package tarball verification.

## Scope and Guardrails

In scope: package engine metadata, Node-targeted builds, runtime APIs and
dependencies, install scripts, CLI/MCP/package behavior, focused Node 22 CI,
and setup documentation.

Out of scope: dropping Node 24 support, adding a permanent Node-version matrix,
or changing unrelated package features. Any Node 22 incompatibility must be
removed or replaced with a documented portable implementation; it must not be
silently hidden behind an unsupported-runtime claim.

## Story Start Protocol

Before beginning a story:

- [ ] Re-read its goal, acceptance criteria, and listed files.
- [ ] Add concrete child tasks for every discovered runtime/API incompatibility.
- [ ] Record the Node 22 baseline command results in the active checklist.
- [ ] Run `pnpm release:plan` before the final implementation commit, then run
  `pnpm release:apply` and `pnpm check:version-bump` immediately before push
  when the decision requires a publishable version change.

## Story 1: Node 22 LTS Compatibility Contract

**Goal:** Make Node 22 LTS the tested and documented minimum runtime without
adding a new CI job or Node matrix.

**Files (expected):** `package.json`, `tsup.config.ts` or build scripts,
`tsconfig*.json`, `.github/workflows/ci.yml`, install/runtime source files
identified by the audit, Node-sensitive tests, `README.md`, and
`docs/reference/release.md` if release runtime setup changes.

### Child Tasks

- [ ] **1.1 Establish a real Node 22 baseline.** Run install, build, type lint,
  focused engine/CLI/MCP tests, and packed-package smoke checks under Node 22;
  record every failing API, dependency, and binary-loading path.
- [ ] **1.2 Audit Node 24 assumptions.** Inventory `engines`, tsup targets,
  TypeScript library settings, install scripts, native modules, and direct
  Node-standard-library APIs; classify each as already compatible, replaceable,
  or blocked by a dependency.
- [ ] **1.3 Implement the minimum-runtime contract.** Set package/build/runtime
  configuration for Node 22 and replace every unsupported Node 24-only path
  with an equivalent Node 22 implementation. Add regression tests for each
  replacement.
- [ ] **1.4 Make existing CI the Node 22 gate.** Change the existing
  path-scoped primary runner to Node 22, retaining cache, concurrency, required
  fast checks, and release gating. Do not add a matrix or another workflow.
- [ ] **1.5 Verify the published experience.** Under Node 22, pack and install
  the tarball, run CLI and MCP smoke commands, index/query a fixture, and
  document the Node 22 minimum in user-facing setup guidance.
- [ ] **1.6 Commit and release checkpoint.** Run focused tests plus
  `pnpm type-lint`, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`; apply the required version bump immediately before push.

### Acceptance Criteria

- [ ] `package.json` and user-facing docs state Node 22 LTS as the minimum.
- [ ] The existing required CI job proves Node 22 without added runner minutes
  from a version matrix.
- [ ] The packed npm artifact installs and runs CLI/MCP/index/query smoke paths
  under Node 22.
- [ ] No user-facing runtime path requires Node 24.
- [ ] Node 24 remains compatible unless a later explicit decision changes that
  support policy.

## Epic Completion Checklist

- [x] Story 1 child tasks and acceptance criteria are evidenced in its delivery
  checklist.
- [x] The successful merged `main` CI run uses Node 22.
- [ ] A labelled release PR follows the opt-in cloud-release flow when the
  release decision requires publishing.
