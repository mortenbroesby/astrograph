# Search Selection and Ranking — 2026-09-08

## Outcome

The scoped selection and ranking fix recovered all three deterministic targets:
target recall rose from 33.3% to 100%, scoped recall rose from 0% to 100%, and
the exact-name target moved from rank 2 to rank 1. The complete corrected
responses used 194 more tokens because they now include the two previously
omitted relevant results. Median retrieval latency increased by 0.197 ms (0.7%).

## Exact Comparison

Five sequential runs used the same generated TypeScript fixture and
`cl100k_base` tokenizer. The fixture contains 401 stronger out-of-scope FTS
decoys, one scoped target, one lexical-only target, and an exact name competing
with a weaker summary-heavy match. Each engine indexed the fixture once before
the timed runs; latency is the median combined time for the three searches.

| Measure | Before | After |
| --- | ---: | ---: |
| Engine commit | `18ade915d6c8e4bfd85d6c6b465bcadfe5ef63f0` | `5418c593a2f468372aa13039631daed8360fc3a6` |
| Engine version | `1.0.2-alpha.250` | `1.0.3-alpha.251` |
| Valid runs | 5/5 | 5/5 |
| Target recall | 33.3% | 100% |
| First relevant rank | 2 | 1 |
| False positives before exact target | 1 | 0 |
| Scoped recall | 0% | 100% |
| Response tokens, median | 295 | 489 |
| Retrieval latency, median | 29.955 ms | 30.152 ms |
| Stable repeated ordering | yes | yes |

## Reproduction

Run the checked-out engine:

```bash
pnpm bench:search-ranking -- --runs 5
```

Compare another checkout with the identical fixture and runner:

```bash
pnpm bench:search-ranking -- --engine-root /absolute/path/to/checkout --runs 5
```

The command prints aggregate symbol metadata and measurements only. It creates
the source-bearing fixture in a temporary directory and removes it after the
run; no raw source or index is committed.
