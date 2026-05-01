# MCP Tools

Astrograph's MCP server exposes a small tool surface for local code discovery,
exact retrieval, bounded assembly, and health reporting.

## Current Tools

- `index_folder`
- `index_file`
- `find_files`
- `search_text`
- `get_file_summary`
- `get_project_status`
- `get_repo_outline`
- `get_file_tree`
- `get_file_outline`
- `suggest_initial_queries`
- `query_code`
- `diagnostics`

## Contract Rules

- Tool names are snake_case and stable.
- Every tool accepts an absolute or resolvable `repoRoot` when repository state is needed.
- Results must be bounded by config limits or explicit options.
- Diagnostic and readiness state must distinguish `fresh`, `stale`, and `unknown`.
- Source-returning tools should support exact source verification where applicable.

## Verification

Primary tests:

- `tests/interface.test.ts`
- `tests/engine-contract.test.ts`
- `tests/serialization.test.ts`
