## Why

Real GitHub Copilot CLI use confirmed that malformed client session metadata is rejected correctly, but an unavailable or timed-out index leaves the client with an opaque `internal_error` rather than a clear hydration-and-retry outcome. Agents then lose the local-first retrieval path or fall back late and opaquely.

## What Changes

- Preserve the existing validated MCP session envelope, with focused coverage for compatible client metadata and malformed input.
- Exclude nested `.worktrees` checkouts from repository discovery so a parent checkout does not hydrate every local branch copy.
- Make index hydration and the subsequent status/search retry deterministic and actionable when a daemon or index request fails or times out.
- Add focused Copilot-driven integration coverage for stale/missing index hydration, retry success, and bounded recovery failure.
- Record the observed client friction in the local Copilot × Astrograph report.

Non-goals: redesigning storage, changing repository data isolation, adding remote telemetry, or broadening filesystem fallback.

## Capabilities

### New Capabilities

- `mcp-client-reliability`: Reliable MCP behavior for supported client sessions and unavailable local repository indexes.

### Modified Capabilities

- None.

## Impact

Likely affects MCP request validation, daemon/index request handling, targeted tests, and the user-local Copilot trial configuration. No new dependencies or public configuration files are expected.
