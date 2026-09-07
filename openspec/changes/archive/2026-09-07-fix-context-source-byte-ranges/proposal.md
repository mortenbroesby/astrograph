## Why

Astrograph persists symbol ranges as UTF-8 byte offsets, but task-context and
context-bundle assembly currently pass those offsets to JavaScript string
`slice`. Any multibyte text before or inside a symbol can therefore return the
wrong source while the response still advertises byte-accurate provenance.

## What Changes

- Use one UTF-8-aware indexed-range extraction path for exact symbol source,
  task context, and context bundles.
- Keep returned source, source hashes, line ranges, byte ranges, and token
  accounting consistent for Unicode, emoji, CRLF, and same-line symbols.
- Add focused regression coverage at the shared retrieval boundary.
- Preserve the existing MCP and CLI response shapes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-retrieval-efficiency`: Exact and assembled retrieval must preserve the
  indexed UTF-8 source range and report internally consistent provenance.

## Impact

- Expected implementation scope: `src/retrieval.ts` and focused retrieval tests.
- Public behavior changes only for currently incorrect multibyte or line-ending
  cases; schemas and tool names remain unchanged.
- No new dependency, daemon, index schema, cache, or migration is required.
- Non-goals: search ranking, stable symbol identity, relation inference,
  language expansion, or compact encoding changes.
