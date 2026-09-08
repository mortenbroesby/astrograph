## Why

JSON object and array values are currently copied into structural symbol signatures, so one large configuration value can consume most of a bounded discovery response. P2.4 closes that gap while preserving the indexed range used for explicit, lossless source retrieval.

## What Changes

- Represent top-level JSON properties with bounded structural signatures that identify the key without embedding the complete value.
- Preserve the complete property range and source for explicit retrieval.
- Add deterministic before/after evidence for discovery bytes, exact tokenizer-counted tokens, ranking, and exact-source fidelity.
- Keep ordinary JSON responses and existing retrieval schemas compatible.
- Do not add a new encoding, parser dependency, nested JSON symbol expansion, or user-configurable signature limit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-retrieval-efficiency`: Require bounded JSON discovery records, lossless explicit retrieval, and comparable output-size evidence.

## Impact

- Affects JSON structural signature extraction, parser and public retrieval tests, the benchmark harness, performance documentation, and the prerelease version.
- Does not change stored source ranges, public response field names, supported formats, dependencies, or non-JSON language behavior.
