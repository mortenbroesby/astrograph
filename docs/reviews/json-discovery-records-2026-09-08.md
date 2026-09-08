# Bounded JSON Discovery Records — 2026-09-08

## Outcome

Astrograph now keeps complete JSON values out of structural discovery records.
On the deterministic five-property fixture, median discovery size fell by
12,012 `cl100k_base` tokens (96.3%) and 52,044 bytes (96.9%). The target kept
the same rank, and explicit retrieval kept the complete source with 100%
fidelity.

## Exact Comparison

Five sequential runs used the same generated JSON fixture, query, five-result
limit, privacy rules, and exact tokenizer. Each engine indexed the fixture once
before the timed runs. Both checkouts were clean, all runs passed exact source,
range, hash, and token-count validation, and repeated ordering was stable.

| Measure | Before | After |
| --- | ---: | ---: |
| Engine commit | `5d6d29f043d6631cbd4cc4b743aa66b3222101fc` | `5745a4c98f535dfabf598a454b8d22f83bb2cf36` |
| Engine version | `1.0.4-alpha.253` | `1.0.4-alpha.254` |
| Valid runs | 5/5 | 5/5 |
| Discovery bytes, median | 53,736 | 1,692 |
| Discovery tokens, median | 12,474 | 462 |
| Target rank | 5 | 5 |
| Exact-source bytes | 5,017 | 5,017 |
| Exact-source tokens | 1,005 | 1,005 |
| Source fidelity | 100% | 100% |
| Retrieval latency, median | 1,052.928 ms | 211.855 ms |
| Stable repeated ordering | yes | yes |

The latency reduction was 841.073 ms (79.9%) on this synthetic large-value
fixture. It is supporting evidence, not a general runtime claim. The token
reduction applies to the five-result discovery response; exact source remains
lossless and intentionally unchanged.

## Reproduction

Run the checked-out engine:

```bash
pnpm bench:json-discovery-records -- --runs 5
```

Compare another clean checkout with the identical fixture and runner:

```bash
pnpm bench:json-discovery-records -- --engine-root /absolute/path/to/checkout --runs 5
```

The runner rejects dirty engine roots, fewer than three runs, a missing target,
unstable ordering, and any exact source, range, hash, or token-count mismatch.
`--allow-dirty` exists only for focused development tests and marks the output
dirty. Output contains aggregate measurements only; the source-bearing fixture
and index are removed after each invocation.
