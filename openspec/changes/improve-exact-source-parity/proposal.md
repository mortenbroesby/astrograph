## Why

The jCodeMunch comparison can count a failed exact-source call as a successful low-token retrieval because its success check also accepts target names from symbol search. Astrograph's successful exact-source response also repeats the first item in legacy top-level fields, so we need trustworthy evidence and an opt-in compact response before treating the measured payload gap as product parity work.

## What Changes

- Require the comparison harness to reject tool errors and prove that requested implementation source came from the source-retrieval step.
- Report minimum successful workflow cost separately from an isolated exact-source response so product-specific search encodings cannot create a false advantage.
- Add `json`, `compact`, and `auto` output selection to `get_symbol_source`, preserving ordinary JSON as the default and its existing parsed v1 contract.
- Encode compact exact-source results without duplicating the first item, while retaining symbol identity, exact source, verification state, line range, provenance, and lossless decode support.
- Re-run the matched comparison three times and correct the dated report with source-free aggregates and disclosed semantic differences.
- Non-goals: warm or cold indexing optimization, tool tiers or routers, broader language coverage, ranking changes, and removal of legacy JSON fields.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-retrieval-efficiency`: Make exact-source responses optionally compact and require comparison evidence to represent successful source retrieval.

## Impact

- MCP schema and formatting paths for `get_symbol_source`.
- Compact-envelope encoding/decoding and focused compatibility tests.
- The jCodeMunch comparison harness and dated benchmark report.
- No new runtime dependency, remote service, or default-response breaking change.
