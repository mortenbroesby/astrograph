# CLI API

The `astrograph` binary exposes package operations and a JSON CLI surface.

## Commands

- `astrograph cli <command>` runs JSON code-intelligence commands.
- `astrograph mcp` starts the stdio MCP server.
- `astrograph cli get-task-context --repo <path> --query <query> --payload-token-budget <n>`
  returns the canonical source-attributed task-context payload. It is the only
  bounded-context command; `query-code` remains discovery/source only.
- `astrograph git-refresh <event>` plans or executes index refreshes for git workflows.
- `astrograph install --ide codex` writes managed local MCP configuration.
- `astrograph install --global --ide codex` writes only the marker-owned user
  Codex registration and user Astrograph default; it never edits a repository.
- `astrograph doctor --repo <path>` verifies the current repository’s local
  and global client registration, managed agent guidance, Git refresh-hook
  state, and index readiness without writing configuration.
- `astrograph status --repo <path>` is the read-only lifecycle status surface;
  it returns the same setup readiness in human or `--json` form without a
  freshness scan or configuration write.
- `astrograph update`, `repair`, and `reconfigure` require `--yes`, `--scope`,
  and `--ide`; they deliberately rewrite only Astrograph-managed registration.
- `astrograph uninstall` has the same explicit selectors and removes only the
  selected MCP registration. It leaves package installation and index/cache
  data untouched.
- `astrograph report-issue --diagnostics-consent --message <summary>` returns
  a sanitized GitHub issue URL only after affirmative consent. It cannot open a
  browser or create an issue and excludes paths, config contents, and common
  credential forms.
- `astrograph cache status --repo <path>` returns a versioned JSON cache
  status, including the persisted checkout identity that last populated the
  selected cache (or `checkout: null` before indexing). `astrograph cache
  migrate`, `astrograph cache remove`, and `astrograph cache prune` default to
  dry-run and require `--yes` to mutate scoped cache data. Mutations archive
  rather than delete and return a receipt with byte count and recovery command.
  `astrograph cache restore
  --repo <path> --receipt <path> --yes` restores only a receipt-owned archive
  into an absent canonical cache location. The restore preview validates the
  same receipt and path-safety invariants as the mutation. Cache mutations are
  not MCP tools.

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
- `diagnostics` and JSON `doctor` also expose a source-free `runtime` summary
  of live Astrograph MCP processes plus pruned stale or invalid registry-record
  counts. It is local-user metadata only; it never contains repository paths,
  source, or queries.

## Verification

Primary tests:

- `tests/interface.test.ts`
- `tests/cli-boundary.test.ts`
- `tests/engine-contract.test.ts`
- `src/scripts/smoke-package-bin.ts`
## Local Astrograph Report

`astrograph report` emits a source-free local JSON aggregate. With
`--repo /abs/repo` it reports only that repository; without `--repo`,
repository-local storage reports the current repository and global storage
aggregates existing Astrograph repository stores. `--reset --yes` requires
`--repo` and clears only that repository's local report input.
`savedTokens` includes only responses with a known canonical comparison;
reference responses increment `unavailableSavingsSamples` instead.
