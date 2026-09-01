## Why

Global Codex and Copilot CLI setup currently share Astrograph's cache root but can launch different package installations: Codex may use the global command while Copilot uses a version-pinned `npx` package. That version split can prevent daemon reuse and makes one-device setup unreliable.

## What Changes

- Bootstrap one device-installed `astrograph` command during global setup, then register every selected client against it instead of resolving a separate `npx` package per client.
- Keep one global cache and runtime directory for every globally configured client, so compatible Codex and Copilot CLI sessions reuse the same per-repository indexes and daemon.
- Validate the installed command before writing global client registrations and report an actionable recovery when it is unavailable or incompatible.
- Add regression coverage for Codex and Copilot CLI convergence, including daemon reuse and a bounded Copilot recovery path.

Non-goal: merge client stdio MCP bridge processes. Each client session needs its own stdio transport; this change shares the device-level service behind them.

## Capabilities

### New Capabilities

- `device-runtime`: Device-wide Astrograph installation, cache, and daemon behavior shared by supported global MCP clients.

### Modified Capabilities

- None.

## Impact

- Affects global setup in `src/scripts/install.ts`, daemon/runtime resolution, diagnostics, and MCP recovery behavior.
- Updates installation and daemon tests; no new runtime dependency or external service is introduced.
