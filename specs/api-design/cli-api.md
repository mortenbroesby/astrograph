# CLI API

The `astrograph` binary exposes package operations and a JSON CLI surface.

## Commands

- `astrograph cli <command>` runs JSON code-intelligence commands.
- `astrograph mcp` starts the stdio MCP server.
- `astrograph cli get-task-context --repo <path> --query <query> --payload-token-budget <n>`
  returns the canonical source-attributed task-context payload. It is the only
  bounded-context command; `query-code` remains discovery/source only.
- `astrograph git-refresh <event>` plans or executes index refreshes for git workflows.
- `astrograph init --ide codex` writes managed local MCP configuration.
- `astrograph install --global --ide codex` writes only the marker-owned user
  Codex registration and user Astrograph default; it never edits a repository.
- `astrograph cache status --repo <path>` returns a versioned JSON cache
  status, including the persisted checkout identity that last populated the
  selected cache (or `checkout: null` before indexing). `astrograph cache
  migrate`, `astrograph cache remove`, and `astrograph cache prune` default to
  dry-run and require `--yes` to mutate scoped global cache data. Mutations
  archive rather than delete and return a receipt. `astrograph cache restore
  --repo <path> --receipt <path> --yes` restores only a receipt-owned archive
  into an absent canonical cache location. Cache mutations are not MCP tools.

## JSON CLI Rules

- Commands should emit machine-readable JSON unless explicitly documented as a human report.
- Errors should fail with non-zero exit status and actionable messages.
- Command names use kebab-case; MCP tools use snake_case.
- CLI behavior should stay aligned with library and MCP behavior.
- `search-symbols` emits the same bounded symbol envelope as MCP, including
  exact `tokenSavings` for the returned `items` relative to all ranked items.
- `diagnostics`, `get-project-status`, and JSON `doctor` expose `retrievalHealth`
  with a safety class, affected and safe operation lists, and one recovery
  action. The human `doctor` report renders the same safety guidance.

## Verification

Primary tests:

- `tests/interface.test.ts`
- `tests/cli-boundary.test.ts`
- `tests/engine-contract.test.ts`
- `src/scripts/smoke-package-bin.ts`
