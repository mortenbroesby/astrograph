# MCP Tools

Astrograph's MCP server exposes a small tool surface for local code discovery,
exact retrieval, bounded assembly, and health reporting.

## MCP v1 Tools

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
- `query_code` is not part of v1 MCP (hard-switch release). The TypeScript/CLI
  `queryCode` surface can remain outside MCP where direct consumers need it.
- MCP v1 exposes no cache behavior: no cache tools, cache-hit metadata, cache
  invalidation calls, or cache-backed response semantics. Any future cache
  design requires a separate post-v1 plan.
- Compact schema variants remain disabled in v1 for predictable parsing and easier migration.
- Results must be bounded by config limits or explicit options.
- Diagnostic and readiness state must distinguish `fresh`, `stale`, and `unknown`.
- Source-returning tools should support exact source verification where applicable.
- Every MCP v1 tool registration includes contract metadata:

```ts
{
  toolVersion: "1",
}
```

- Every MCP v1 tool call returns exactly one strict envelope. Successful calls
  omit `error` and return:

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

- Failed calls return:

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

## Explicit Retrieval Tools

### `search_symbols`

Registration metadata:

```ts
{ toolVersion: "1" }
```

Request:

```ts
{
  repoRoot: string,
  query: string,
  kind?: "function" | "class" | "method" | "constant" | "type",
  language?: "ts" | "tsx" | "js" | "jsx",
  filePattern?: string,
  limit?: number,
}
```

Success `data`:

```ts
SymbolSummary[]
```

Where `SymbolSummary` is the public summary shape with `id`, `name`,
`qualifiedName`, `kind`, `filePath`, `signature`, `summary`, `summarySource`,
`startLine`, `endLine`, and `exported`.

### `get_symbol_source`

Registration metadata:

```ts
{ toolVersion: "1" }
```

Request:

```ts
{
  repoRoot: string,
  symbolId?: string,
  symbolIds?: string[],
  contextLines?: number,
  verify?: boolean,
}
```

At least one of `symbolId` or `symbolIds` is required.

Success `data`:

```ts
{
  requestedContextLines: number,
  items: Array<{
    symbol: SymbolSummary,
    source: string,
    verified: boolean,
    startLine: number,
    endLine: number,
  }>,
  symbol?: SymbolSummary,
  source?: string,
  verified?: boolean,
  startLine?: number,
  endLine?: number,
}
```

The single-symbol convenience fields mirror the first item and must not replace
the canonical `items` array.

### `get_context_bundle`

Registration metadata:

```ts
{ toolVersion: "1" }
```

Request:

```ts
{
  repoRoot: string,
  query?: string,
  symbolIds?: string[],
  tokenBudget?: number,
  includeDependencies?: boolean,
  includeImporters?: boolean,
  includeReferences?: boolean,
  relationDepth?: number,
}
```

At least one of `query` or `symbolIds` is required.

Success `data`:

```ts
{
  repoRoot: string,
  query: string | null,
  tokenBudget: number,
  estimatedTokens: number,
  usedTokens: number,
  truncated: boolean,
  items: Array<{
    role: "target" | "dependency",
    reason: string,
    symbol: SymbolSummary,
    source: string,
    tokenCount: number,
  }>,
}
```

### `get_ranked_context`

Registration metadata:

```ts
{ toolVersion: "1" }
```

Request:

```ts
{
  repoRoot: string,
  query: string,
  tokenBudget?: number,
  includeDependencies?: boolean,
  includeImporters?: boolean,
  includeReferences?: boolean,
  relationDepth?: number,
}
```

Success `data`:

```ts
{
  repoRoot: string,
  query: string,
  tokenBudget: number,
  candidateCount: number,
  selectedSeedIds: string[],
  candidates: Array<{
    rank: number,
    score: number,
    reason: string,
    symbol: SymbolSummary,
    selected: boolean,
  }>,
  bundle: ContextBundle,
}
```

## Contract Versioning

- Tool registration metadata includes `toolVersion: "1"` for each v1 tool.
- Response metadata includes `meta.toolVersion`.
- Plain tool names are kept (no suffixing like `_v1`) during v1.

## Verification

Primary tests:

- `tests/interface.test.ts`
- `tests/engine-contract.test.ts`
- `tests/serialization.test.ts`
