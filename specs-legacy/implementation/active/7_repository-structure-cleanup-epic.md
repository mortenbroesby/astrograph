# Repository Structure Cleanup Epic

> **Status:** Active — selected by the user on 2026-07-26.

**Goal:** Make repository automation and benchmarking easy to locate, run, and
change without altering Astrograph runtime behavior or expanding CI cost.

**Architecture:** `bench/` becomes the single owner of benchmark and profiling
entrypoints; root `scripts/` retains repository automation, developer helpers,
and Git hooks. GitHub-only helpers live below `.github/` only when their sole
caller is a workflow. Each move preserves the public package command and is
verified by running it, rather than creating aliases.

**Tech Stack:** Node 22, pnpm, TypeScript, ESM scripts, Vitest, GitHub Actions.

## Audit Inventory (2026-07-26)

| Rank | Finding | Evidence | Decision |
| --- | --- | --- | --- |
| 1 | Benchmark ownership is split. | `bench/` owns corpus, runner, reports, and tests while 1,482 lines of benchmark/profiling scripts live in root `scripts/`. | Move the entrypoints into `bench/scripts/` without changing commands. |
| 2 | Performance documentation advertises a non-existent command. | `docs/guides/performance.md` lists `bench:perf:serialize`; `package.json` and the tree contain no matching command/script. | Remove the unsupported invocation; do not invent a benchmark. |
| 3 | A Windows helper is workflow-only. | `.github/workflows/ci.yml` is its sole caller of `scripts/run-windows-vitest.ps1`. | Move it to `.github/scripts/` in a workflow-only PR after reading the CI-cost rule. |
| 4 | Git-hook launch plumbing is duplicated. | `pre-commit-hook.mjs`, `prepush-checks.mjs`, and `post-merge-hook.mjs` repeat process execution/error handling. | Extract one internal hook runner only after characterizing each hook's exit behavior. |
| 5 | A development wrapper is unreferenced. | `scripts/astrograph.mjs` has no package, CI, documentation, or source caller. | Delete only after a package/bin smoke confirms no supported path needs it. |
| 6 | Benchmark command taxonomy is implicit. | Package scripts span corpus, micro, perf, lifecycle, MCP-envelope, compact-output, and profiler commands with no ownership map. | Add a concise `bench/README.md` command map and a focused contract test for command targets. |
| 7 | Benchmark tests are not hermetic by default. | Fixture repositories write to the user-global cache unless `ASTROGRAPH_HOME` is injected. | Separate storage-isolation work from the relocation PR; use an isolated cache for its verification. |
| 8 | Two executable baselines are currently unhealthy. | `bench/scripts/perf-lib.mjs` sends invalid `query_code` intent `assemble`; the compact-output trace can time out while starting its isolated daemon. | Repair each in a dedicated benchmark-health PR; do not redefine a metric or daemon lifecycle during relocation. |

**Deliberately not selected:** runtime dependency pruning, benchmark metric
changes, new CI jobs, a new benchmark framework, and moving package-shipped
`src/scripts/` files. Each changes behavior or release confidence rather than
repository structure.

## Story 1: Collate Benchmark Entrypoints

**Files:**
- Move: `scripts/benchmark-cli.mjs`, `scripts/benchmark-small.mjs`,
  `scripts/measure-agc1-compact-output-matrix.mjs`,
  `scripts/measure-freshness-lifecycle.mjs`, `scripts/measure-mcp-envelopes.mjs`,
  `scripts/perf-lib.mjs`, `scripts/perf.mjs`, `scripts/perf-index.mjs`, and
  `scripts/perf-query.mjs` to `bench/scripts/`.
- Modify: `package.json`, `bench/README.md`, `docs/guides/performance.md`, and
  only current implementation records that name the moved files.
- Create or modify: a focused package-command/benchmark-path contract test if
  the move lacks existing executable coverage.

- [ ] Establish a baseline with `pnpm type-lint`, the benchmark-focused tests,
  and representative commands for perf, lifecycle, MCP-envelope, and compact
  output.
- [x] Move files without changing their command names, arguments, output
  schema, fixture cleanup, or measured behavior; update relative imports only.
- [x] Keep profiling commands pointed at the moved perf entrypoints.
- [x] Replace the unsupported `bench:perf:serialize` documentation example
  with the existing envelope/compact-output commands; do not add a synthetic
  benchmark merely to retain the name.
- [x] Document the benchmark command groups and their source ownership in
  `bench/README.md`.

**Acceptance:** Every retained `pnpm bench:*` and profiling command resolves
to `bench/`; root `scripts/` contains no benchmark or profiler implementation;
representative commands preserve their exit status and JSON shape.

**Known baseline exclusions:** On 2026-07-27, the aggregate perf contract
fails because `bench/scripts/perf-lib.mjs` still returns `queryCodeAssemble*`
metrics while its callers and test expect `queryCodeSource*`; repair that
schema mismatch in Story 6. The compact-output trace also timed out starting
its isolated daemon in this workstation session. Neither is caused or fixed by
Story 1.

## Story 2: Put Workflow-Only Helpers Beside Their Workflow

**Files:** `.github/workflows/ci.yml`, `scripts/run-windows-vitest.ps1`, new
`.github/scripts/run-windows-vitest.ps1`, and a short workflow note if needed.

- [ ] Read `.agents/rules/github-actions-cost.md` before changing the workflow.
- [ ] Move the PowerShell test wrapper to `.github/scripts/` and update only
  the disabled Windows job's paths.
- [ ] Preserve triggers, permissions, concurrency, job conditions, timeouts,
  and runner selection byte-for-byte except for the helper path.
- [ ] Validate YAML and run the helper's syntax check; do not enable Windows CI.

**Acceptance:** GitHub-only implementation no longer appears as a generic
repository script and CI cost/behavior remains unchanged.

## Story 3: Consolidate Hook Launch Plumbing

**Files:** `scripts/pre-commit-hook.mjs`, `scripts/prepush-checks.mjs`,
`scripts/post-merge-hook.mjs`, and a new local hook helper with focused tests.

- [ ] Characterize the three hooks' command, argument, non-zero-exit, and
  missing-Git behavior before extraction.
- [ ] Extract only shared spawn/result handling; keep hook-specific file
  selection and policy visible in each hook.
- [ ] Verify direct hook invocation in a fixture repository and normal
  `pnpm hooks:*` commands.

**Acceptance:** One runner owns process-result translation, while each hook
retains its existing scope and failure semantics.

## Story 4: Remove the Unsupported Development Wrapper

**Files:** `scripts/astrograph.mjs`, its references if any emerge during the
fresh audit, package/bin smoke coverage, and documentation only if affected.

- [ ] Reconfirm there are no supported callers after Stories 1–3.
- [ ] Delete the wrapper instead of moving it when the source/built/package bin
  surfaces already cover its behavior.
- [ ] Run package-bin and CLI smoke verification.

**Acceptance:** There is one documented Astrograph executable path and no
unreferenced wrapper to maintain.

## Story 5: Keep the Benchmark Boundary Honest

**Files:** `bench/README.md`, benchmark-focused tests, and package scripts.

- [ ] Add only a narrow command-target contract if Story 1 reveals that plain
  moves are otherwise untested.
- [ ] Keep the corpus harness and micro/perf scripts distinct in documentation;
  do not force them through a new abstraction.
- [ ] Make benchmark fixture storage hermetic only after characterizing the
  existing global-cache contract; do not hide this environment dependency in
  an unrelated script move.
- [ ] Record explicit selection gates for any later metric unification or
  benchmark-framework rewrite.

**Acceptance:** A contributor can identify the benchmark class, owner, command,
and expected output without reading root scripts.

## Story 6: Restore Broken Benchmark Baselines

**Files:** the selected benchmark script(s), their focused tests, and this
record.

- [ ] Characterize the intended current `query_code`/task-context measurement
  before replacing the removed `assemble` intent; do not relabel two discovery
  samples as an assembly benchmark.
- [ ] Reproduce compact-output daemon startup with a clean runtime/cache and
  identify whether the issue is stale state, process ownership, or timeout.
- [ ] Repair each independently with an executable focused test and record any
  resulting output-schema change.

**Acceptance:** The affected commands run from a clean checkout under the
supported Node 22 toolchain and measure the operation their labels describe.

## Verification and Commit Checkpoint

For every source, script, test, bench, or package change, run the narrowest
relevant command first, then:

```bash
pnpm type-lint
pnpm check:version-bump
git diff --check
```

Run `pnpm build` and `pnpm test:package-bin` for Stories 1 and 4. Use
`pnpm release:plan` before deciding a version bump. Keep each story in its own
PR; do not combine workflow edits with benchmark relocation.

## Rollback

Each story is a behavior-preserving file/layout change. Revert its individual
PR to restore the preceding paths; no storage migration, schema change, or
external state is involved.
