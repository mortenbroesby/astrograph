# CLI API

The `astrograph` binary exposes package operations and a JSON CLI surface.

## Commands

- `astrograph cli <command>` runs JSON code-intelligence commands.
- `astrograph mcp` starts the stdio MCP server.
- `astrograph git-refresh <event>` plans or executes index refreshes for git workflows.
- `astrograph init --ide codex` writes managed local MCP configuration.

## JSON CLI Rules

- Commands should emit machine-readable JSON unless explicitly documented as a human report.
- Errors should fail with non-zero exit status and actionable messages.
- Command names use kebab-case; MCP tools use snake_case.
- CLI behavior should stay aligned with library and MCP behavior.

## Verification

Primary tests:

- `tests/interface.test.ts`
- `tests/cli-boundary.test.ts`
- `tests/engine-contract.test.ts`
- `src/scripts/smoke-package-bin.ts`
