## Context

See `proposal.md` for motivation. The current event stream already records MCP
start/finish/failure events and response metrics. It shows repeated unhealthy
client retries, a successful 34.5-second index of 214 files, search latency of
320–467 ms, and negligible response-formatting cost, but it cannot attribute
index time to phases. Separately, the repository has multiple dirty or stale
worktrees whose intent is not visible from the current backlog.

The untouched broad test suite is presently noisy: it includes build-order,
timeout, daemon, and stale benchmark assertions. Focused tests and a build are
the reliable baseline until the P1 verification task repairs that gate.

## Goals / Non-Goals

**Goals:**

- Reuse the existing event and report paths.
- Make verbose evidence safe to retain and cheap when disabled.
- Make cleanup recoverable from Git plus `BACKLOG.md`.
- Bound the first measurement/optimization pass to one confirmed hot path.

**Non-Goals:**

- A new logging dependency, trace backend, dashboard, or cleanup daemon.
- Cross-process event writes from the index worker.
- Combining unrelated dirty worktrees into this product patch.
- Making every historical branch build on current `main`.

## Decisions

### Extend the existing observability path

Add `observability.verbosePerformance`, defaulting to `false`, through
`src/types/config.ts` and `src/config.ts`. In daemon/direct indexing mode,
`src/storage.ts` emits one sanitized profile event containing total, discovery,
analysis, persistence, and finalization milliseconds; file/count totals; and
effective concurrency/worker settings. The worker child will not write profile
events because the current file sink is process-local and concurrent rewrites
could clobber data. Alternative rejected: a second logger or tracing package.

### Keep default reports compatible

`src/report.ts` keeps the current aggregate shape for normal calls. A verbose
option adds bounded sanitized operation/profile rows, including failures and
unfinished attempts so the report no longer hides retry costs. `src/cli.ts`
parses `--verbose`, and `src/astrograph.ts` routes top-level `report` to the
existing CLI implementation. Focused verification lives in
`tests/report.test.ts`, `tests/cli-boundary.test.ts`,
`tests/engine-contract.test.ts`, and one existing storage runtime-mode test.

### Use BACKLOG.md as the manifest

Add an active-work inventory under the selected P1 section instead of creating
a competing tracker. Each entry contains goal, owner/state, branch, worktree,
base, verification, and next action. `.agents/rules/worktrees.md` and the
repository workflow spec require updating it at interruption and cleanup.
Alternative rejected: a generated manifest that becomes stale unless run.

### Preserve before cleanup

Each dirty worktree and stash is reviewed independently. Coherent work is
secret-scanned, committed with an explicit unfinished marker when needed,
pushed, and then recorded. Unknown or mixed work remains untouched. Clean,
merged, or remotely recoverable worktrees can then be removed, followed by
`git worktree prune`. Branch and stash deletion happens only after an equivalent
remote commit is read back.

### Use a fixed bounded performance run

Capture a default report, enable verbose capture in a fresh managed runtime,
then run exactly status, one hydration, one status retry, one search, and
diagnostics against a fixed temporary checkout. Repeat indexing three times
with the same Node version, revision, storage mode, and concurrency; optimize
only the dominant phase if it is both actionable and material, then repeat.

## Risks / Trade-offs

- [Verbose data increases local event volume] -> keep it opt-in, bounded, and
  under the existing retention policy.
- [Manual backlog entries can drift] -> require updates at explicit lifecycle
  transitions and verify them before worktree removal.
- [A WIP commit may not pass all tests] -> name it unfinished, record exact
  gaps, and never merge it solely because it was preserved.
- [Cleanup can destroy unique work] -> remove only after remote-ref and
  no-unique-file checks; otherwise preserve the worktree.
- [Current broad-suite failures obscure regressions] -> use named focused tests
  during the slice and repair the authoritative fast gate before declaring P1
  complete.

## Migration Plan

1. Land the compatible report/config/index profile changes and focused tests.
2. Enable verbose capture only in the managed dogfood runtime and run the fixed
   before/after measurement.
3. Add the active-work inventory and lifecycle policy, then classify each
   existing worktree/stash without bulk mutation.
4. Commit and push recoverable interrupted work on its own branch; remove only
   verified redundant worktrees and prune stale metadata.
5. Roll back product telemetry by disabling the flag; restore a removed
   worktree from its recorded remote branch if needed.
