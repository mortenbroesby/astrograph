# Node 22 Compatibility Delivery Checklist

> **Epic:** [Node 22 Compatibility Epic](./node-22-compatibility-epic.md)
>
> **Status:** Work in progress — Story 1 started on 2026-07-19.

## Story 1: Node 22 LTS Compatibility Contract

**Goal:** Make Node 22 LTS the tested and documented minimum runtime without a
new CI matrix or job.

### Baseline Evidence

- [x] Current package contract identified: `package.json` requires `node >=24`.
- [x] Current build contract identified: both tsup commands target `node24`.
- [x] Current CI contract identified: the existing fast and release jobs set up
  Node 24.
- [x] Current user-facing contract identified: `README.md` says Node `>=24`.
- [x] Initial source audit found no direct `node:sqlite` or obvious Node
  24-only standard-library import in production source.
- [x] Dependency constraint identified: `oxc-parser` requires Node
  `>=22.12.0`; this is the precise minimum public runtime.
- [ ] Run the complete baseline under a real Node 22 binary. The current local
  environment exposes Node `v24.13.0` only; the attempted temporary `npx`
  Node 22 runner did not expose an executable. Use the upcoming Node 22 CI
  gate and/or a working local Node 22 installation for authoritative evidence.

### Implementation Tasks

- [ ] **1.1 Map runtime and dependency compatibility.** Inspect package
  dependencies, native prebuild coverage, package scripts using
  `--experimental-strip-types`, and generated `dist` syntax. Record each
  requirement and any Node 22.0 versus later-22 LTS constraint.
- [x] **1.2 Retarget package and build metadata.** Change the package engine
  minimum, both tsup targets, and engine-contract expectations from Node 24 to
  Node `>=22.12.0`. Do not lower the TypeScript target below what Node 22
  supports.
- [x] **1.3 Switch the existing CI gate to Node 22.** Update the existing
  path-scoped CI jobs from Node 24 to Node 22 without adding a matrix, runner,
  trigger, or cache regression. Keep release jobs on Node 22 because they
  execute the TypeScript release scripts.
- [x] **1.4 Verify executable scripts on Node 22.** The existing fast CI job
  now runs the release-agent plan through `--experimental-strip-types` on Node
  22; replace any flag/API incompatibility with a Node-22-compatible path and
  add focused regression coverage.
- [x] **1.5 Verify the packed user experience.** The existing fast CI job now
  runs the packed-bin smoke (tarball install, CLI fixture index, and MCP setup)
  plus the focused MCP stdio initialize/tools/list/tools/call test under Node
  22. Capture the authoritative CI run and runtime version here after push.
- [x] **1.6 Document the public contract.** Change README setup requirements
  and any installation/release guidance to name the precise supported Node 22
  range; note that Node 24 remains supported.
- [ ] **1.7 Release checkpoint.** Run focused tests, `pnpm type-lint`, the
  Node 22 CI gate, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`; apply the required version bump immediately before push.

### Acceptance Evidence

- [ ] Package metadata, tests, builds, CI, and README agree on the Node 22
  minimum.
- [ ] A Node 22 CI run passes build, type lint, version policy, and release
  eligibility checks using the existing fast job.
- [ ] A Node 22 packed-package smoke run covers CLI, MCP, indexing, and query.
- [ ] Node 24 remains supported by the same configuration and tests.
