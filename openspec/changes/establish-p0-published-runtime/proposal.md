## Why

Astrograph cannot currently be trusted as a device-wide Codex and Copilot tool:
repository-local npm resolution, runtime-manager shims, unpublished version
pins, and long-lived MCP startup failures can select different versions or hide
the server entirely. This is the highest-priority work because every later
Astrograph task depends on reliable dogfooding through the same package path
users receive.

## What Changes

- Make `BACKLOG.md` the lightweight source of truth for priority and execution
  order while retaining OpenSpec for the detailed contract of selected work.
- Add an npm `snapshot` channel that publishes the exact packed tarball already
  verified by package and MCP smoke tests; keep production on `latest`.
- Replace current-directory and runtime-manager-dependent client commands with
  one stable device-owned runtime selection.
- Permit separate Codex and Copilot configuration adapters while requiring both
  to resolve the same selected package version, cache, and compatible daemon.
- Preserve distinct indexes for different repositories and worktrees behind a
  shared multi-repository runtime.
- Add bounded MCP startup recovery and diagnostics that expose effective
  version/runtime identity instead of leaving a failed server absent silently.

Non-goals: publish snapshots from a developer credential, share one stdio
transport between clients, merge worktree indexes, add a network service, or
prioritize feature work ahead of this reliability gate.

## Capabilities

### New Capabilities

- `package-channels`: Immutable npm snapshot dogfooding and guarded production
  publication using the exact verified package artifact.
- `device-runtime`: Stable device-owned package selection, client registration,
  shared daemon behavior, multi-repository/worktree isolation, and startup
  recovery.

### Modified Capabilities

- `repository-workflow`: Separate lightweight backlog priority from the detailed
  OpenSpec contract used only for selected durable work.

## Impact

Planning policy and documentation will change first. Implementation will affect
the existing CI/release workflow, package smoke harness, installer and
diagnostics, Codex TOML and Copilot JSON registration generation, daemon/runtime
selection, tests, and this computer's installed snapshot configuration. It
must preserve npm trusted publishing, the GitHub Actions cost guardrail, MCP
stdio transport, and existing cache data unless an explicit reversible
migration is required.
