# AGC2 Alias-Symbols Candidate — 2026-07-26

## Hypothesis

Broad `search_symbols` responses can repeat the same semantic values in every
row: `qualifiedName === name`, `summary === signature`, a file-path prefix,
and small `kind`/`summarySource` domains. A fixed schema can restore those
values losslessly, so it should save materially more than AGC1 when the
response contains many similarly shaped symbols.

## Codec boundary

`agc2-alias-symbols` is non-serving research code. It supports only
`search_symbols`, and only emits a payload when all alias relationships hold
and the exact encoded result is smaller than frozen AGC1. Its decoder rejects
unknown schemas, invalid dictionary indexes, malformed rows, and invalid
metadata. No MCP formatter or public decoder uses it.

## Exact-token result

The same deterministic four-fixture corpus and `cl100k_base` tokenizer were
used for every measurement. Only two broad symbol captures met the candidate's
strict lossless/payback preconditions:

| Fixture | Comparable captures | AGC1 serving tokens | Alias-symbol tokens | Savings | Non-wins |
| --- | ---: | ---: | ---: | ---: | ---: |
| product monorepo | 1 | 820 | 548 | 33.17% | 0 |
| dead-code workspace | 1 | 677 | 494 | 27.03% | 0 |
| **Eligible weighted total** | **2** | **1,497** | **1,042** | **30.39%** | **0** |

The small-frontend and text-heavy fixtures, empty searches, and every other
tool are deliberately refused rather than silently encoded at a tie or loss.
Each accepted payload round-trips through the candidate decoder exactly.

## Decision

Do **not** select AGC2 for production. Although the accepted subset beats the
numeric 15% token threshold, it is not a full replacement candidate: it covers
only 2 of the 8 successful `search_symbols` captures and none of the retained
AGC1 `get_file_tree` or `get_file_outline` contract. ADR-010 requires a
representative replacement without regressions; a narrow, data-dependent
optimization is insufficient evidence to change the public format.

Keep AGC1 serving and retain this codec only as a promising, independently
tested laboratory result. A later candidate must cover the remaining compact
tool shapes or explicitly establish a separately gated, mixed-format product
contract.

## Reproduction

```bash
pnpm bench:compact-output-matrix -- --fixture=product-monorepo --summary
pnpm bench:compact-output-matrix -- --fixture=dead-code-workspace --summary
pnpm bench:compact-output-matrix -- --json
```
