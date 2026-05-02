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
- `search_symbols` (new v1)
- `get_symbol_source` (new v1)
- `get_context_bundle` (new v1)
- `get_ranked_context` (new v1)
- `diagnostics`

## Contract Rules

- Tool names are snake_case and stable.
- Every tool accepts an absolute or resolvable `repoRoot` when repository state is needed.
- v1 tools use strict response schemas. Every successful response returns:

```ts
{
  ok: true,
  data: <tool-specific payload>,
  meta: {
    toolVersion: "1",
    tokenBudgetUsed: number | null,
    dataFreshness: "fresh" | "stale" | "unknown",
    warnings?: string[],
  },
}
```

- Every failed tool call returns:

```ts
{
  ok: false,
  data: null,
  error: {
    code: string,
    message: string,
    details?: Record<string, unknown>,
  },
  meta: {
    toolVersion: "1",
    tokenBudgetUsed: null,
    dataFreshness: "unknown",
  },
}
```

- `query_code` is not part of v1 MCP (hard-switch release).
- v1 does not expose caching behavior or cache-related MCP operations.
- Compact schema variants remain disabled in v1 for predictable parsing and easier migration.
- Results must be bounded by config limits or explicit options.
- Diagnostic and readiness state must distinguish `fresh`, `stale`, and `unknown`.
- Source-returning tools should support exact source verification where applicable.

## Contract Versioning

- Tool registration metadata includes `version: "1"` for each v1 tool.
- Response metadata includes `meta.toolVersion`.
- Plain tool names are kept (no suffixing like `_v1`) during v1.

## Verification

Primary tests:

- `tests/interface.test.ts`
- `tests/engine-contract.test.ts`
- `tests/serialization.test.ts`
