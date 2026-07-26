# AGC1 Compact-Output Baseline — 2026-07-26

## Decision

AGC1 remains Astrograph's serving compact-output format for
`search_symbols`, `get_file_tree`, and `get_file_outline`. Strict JSON remains
the default for every other tool and for errors.

## Durable regression evidence

The deterministic compact-output corpus contains four repository shapes:
small frontend, polyglot product monorepo, text-heavy workspace, and a
dead-code workspace. For every capture, the harness records exact
`cl100k_base` token and byte counts for strict JSON and the actual output of
`formatMcpEnvelope(..., "compact", ...)`.

Eligible AGC1 outputs are parsed by the public decoder and must restore the
normalized MCP v1 envelope exactly. Unsupported tools and errors are explicit
JSON fallbacks; they are not misreported as compact results.

## Reproduction

```bash
pnpm exec vitest run tests/compact-agc1-harness.test.ts tests/compact-output-fixtures.test.ts
pnpm bench:agc1-compact-output -- --summary
```

This baseline is intentionally codec-neutral: it does not introduce AGC2,
storage/cache migration, or an MCP contract change. Any future compact format
must improve on this serving baseline with complete corpus evidence.
