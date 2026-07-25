# AGC2 Packed-Rows Baseline — 2026-07-26

## Scope

This is the first exact-token baseline from the AGC2 research corpus. It uses
the real MCP dispatcher, normalized deterministic captures, and
`cl100k_base`. AGC1 is a frozen comparison encoder only; this report does not
make either format a serving or compatibility commitment.

Run the full machine-readable report with:

```bash
pnpm bench:compact-output-matrix -- --json
```

Use `-- --fixture=<name> --summary` to inspect one fixture in constrained
environments.

## Packed-rows result versus AGC1

| Fixture | Comparable captures | AGC1 tokens | Packed-row AGC2 tokens | Savings | Non-winning captures |
| --- | ---: | ---: | ---: | ---: | ---: |
| small frontend | 4 | 536 | 523 | 2.43% | 1 |
| product monorepo | 4 | 2,131 | 2,057 | 3.47% | 1 |
| text-heavy workspace | 4 | 254 | 243 | 4.33% | 2 |
| dead-code workspace | 4 | 2,343 | 2,236 | 4.57% | 1 |
| **Weighted total** | **16** | **5,264** | **5,059** | **3.90%** | **5** |

The packed-row baseline fails both production gates: it is below the required
15% weighted saving and has five captures that do not beat AGC1. It is
therefore rejected as a production selection, while remaining Candidate A in
the non-serving codec laboratory.

## Next experiment

Evaluate independent schema-ID, prefix-legend, typed-delimited-row, and
bounded homogeneous-list candidates against this same corpus. A candidate must
round-trip every declared shape and beat AGC1 in every comparable capture
before the product contract can change.
