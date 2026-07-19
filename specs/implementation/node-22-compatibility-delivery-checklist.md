# Node 22 Compatibility Delivery Checklist

> **Epic:** [Node 22 Compatibility Epic](./node-22-compatibility-epic.md)
>
> **Status:** Story 1 complete on 2026-07-19.

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
- [x] Run the complete baseline under a real Node 22 binary. GitHub Actions CI
  run `29680263451` used the configured Node 22 runner and passed build, type
  lint, TypeScript-runtime, packed-package, CLI indexing, and MCP stdio gates.
  The local environment remains Node `v24.13.0`; the temporary `npx` Node 22
  runner was not usable, so CI is the authoritative Node 22 evidence.

### Implementation Tasks

- [x] **1.1 Map runtime and dependency compatibility.** Inspect package
  dependencies, native prebuild coverage, package scripts using
  `--experimental-strip-types`, and generated `dist` syntax. Record each
  requirement and any Node 22.0 versus later-22 LTS constraint. The governing
  production dependency is `oxc-parser`, which supports `>=22.12.0`; native
  dependencies support Node 22.
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
- [x] **1.5 Verify the packed user experience.** CI run `29680412981` passed
  the Node 22 packed-bin smoke (tarball install, CLI fixture index and
  `search-symbols` query, and MCP setup) plus the focused MCP stdio
  initialize/tools/list/tools/call test.
- [x] **1.6 Document the public contract.** Change README setup requirements
  and any installation/release guidance to name the precise supported Node 22
  range; note that Node 24 remains supported.
- [x] **1.7 Release checkpoint.** Run focused tests, `pnpm type-lint`, the
  Node 22 CI gate, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`; apply the required version bump immediately before push.
  Local build, type lint, package-bin smoke, engine-contract test, focused MCP
  stdio test, release-agent plan, version check, and diff check passed; CI run
  `29680263451` passed on the merged commit.

### Acceptance Evidence

- [x] Package metadata, tests, builds, CI, and README agree on the Node 22
  minimum.
- [x] A Node 22 CI run passes build, type lint, version policy, and release
  eligibility checks using the existing fast job.
- [x] A Node 22 packed-package smoke run covers CLI, MCP, indexing, and query.
- [x] Node 24 remains supported by the same configuration and tests.
