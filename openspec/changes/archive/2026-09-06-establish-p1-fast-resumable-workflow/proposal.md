## Why

Recent Astrograph sessions lost time to repeated calls against an unhealthy MCP
runtime, broad verification runs, and worktree state that was difficult to
resume after interruption. Astrograph already records privacy-safe local events,
so the urgent opportunity is to expose the missing timing detail and make every
active worktree recoverable from committed, visible state.

## What Changes

- Define one fast local verification path that matches the required pull-request
  signal, while keeping expensive reliability, package, and performance checks
  explicit.
- Extend the existing local event sink with opt-in index phase timings and expose
  sanitized, bounded detail through `astrograph report --verbose`; keep the
  default aggregate report unchanged.
- Make the documented top-level `astrograph report` command route correctly.
- Define a bounded measurement run and permit at most one optimization of the
  measured dominant phase; do not optimize already-fast search or formatting
  without evidence.
- Make interrupted work resumable by recording each active goal's branch,
  worktree, state, verification, and next action in the existing backlog/workflow
  system, then committing and pushing coherent partial work before a worktree is
  retired.
- Reconcile the current Astrograph worktree/stash inventory without combining
  unrelated changes or deleting unrecoverable work.
- Non-goals: a second logging framework, raw query/source/session capture, a
  continuously running cleanup daemon, or automatic deletion of dirty work.

## Capabilities

### New Capabilities

- `development-feedback-loop`: Fast verification, optional performance detail,
  bounded measurement, and concise failure-layer reporting for local development.

### Modified Capabilities

- `repository-workflow`: Interrupted tasks and completed worktrees become
  recoverable through committed goal state, explicit ownership, and safe cleanup.

## Impact

This affects the report/config/indexing paths, CLI dispatch, focused tests,
performance documentation, `BACKLOG.md`, and repository agent/worktree policy.
It adds no dependency and keeps verbose telemetry local and opt-in. Existing
dirty worktrees and stashes are handled as separate owned recovery items rather
than folded into the product diff.
