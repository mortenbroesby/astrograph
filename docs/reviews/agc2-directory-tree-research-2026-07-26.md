# AGC2 Directory-Tree Candidate — 2026-07-26

## Hypothesis

`get_file_tree` repeats directory prefixes and language names across many rows.
Interning each directory and language once, then encoding rows as directory and
language indexes plus basename and symbol count, should materially reduce token
cost without losing a single tree entry.

## Result

`agc2-directory-tree` is a non-serving, lossless candidate. It emits only
when its exact `cl100k_base` token count beats serving AGC1; malformed headers,
metadata, indexes, and rows are rejected by its decoder.

| Fixture | Comparable captures | AGC1 serving tokens | Directory-tree tokens | Savings | Non-wins |
| --- | ---: | ---: | ---: | ---: | ---: |
| product monorepo | 1 | 1,147 | 765 | 33.30% | 0 |
| dead-code workspace | 1 | 1,507 | 1,129 | 25.08% | 0 |
| **Eligible weighted total** | **2** | **2,654** | **1,894** | **28.64%** | **0** |

The small-frontend and text-heavy tree captures do not repay the directory and
language table overhead, so the candidate explicitly refuses them.

## Decision

Do **not** select AGC2 for production. This candidate has no `search_symbols`
or `get_file_outline` representation and covers only 2 of the 4 representative
tree captures. It is evidence that structural interning can work for large
trees, not evidence for an AGC1 replacement.

## Reproduction

```bash
pnpm bench:compact-output-matrix -- --fixture=product-monorepo --summary
pnpm bench:compact-output-matrix -- --fixture=dead-code-workspace --summary
```
