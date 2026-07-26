# AGC2 Compact Output Research Result

**Status:** Rejected for production on 2026-07-26.

The AGC2 codec laboratory evaluated packed rows, schema rows, path-prefix
legends, typed rows, and a bounded generic-row fallback against the four-fixture
corpus with exact `cl100k_base` counts. No candidate met the required 15%
weighted saving over AGC1 while avoiding every representative regression.

The full evidence is in
[the packed-rows baseline review](../../docs/reviews/agc2-packed-rows-baseline-2026-07-26.md)
and `pnpm bench:compact-output-matrix -- --json`.
The later [alias-symbol candidate](../../docs/reviews/agc2-alias-symbols-research-2026-07-26.md)
showed strong savings on two broad symbol captures but did not cover the
complete retained compact-tool contract, so it also remains non-serving.

## Serving contract

Astrograph retains the proven `agc1` compact contract for successful
`search_symbols`, `get_file_tree`, and `get_file_outline` calls. Other tools
and all errors use strict MCP v1 JSON. JSON remains the default for every tool.

```ts
[
  "agc1",
  toolName,
  payload,
  ["1", tokenBudgetUsed, dataFreshness],
]
```

`format: "compact"` explicitly requests AGC1 for those three tools. `auto`
uses it only when it saves at least 20 exact `cl100k_base` tokens and 25% of
the strict JSON envelope. The exported `decodeCompactMcpEnvelope` restores the
ordinary success envelope and rejects unknown versions, tools, and malformed
rows.

AGC2 remains non-serving research code. A future proposal must rerun the same
corpus and pass ADR-010 before changing this contract.
