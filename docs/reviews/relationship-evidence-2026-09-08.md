# Relationship Evidence — 2026-09-08

## Outcome

Astrograph stopped promoting arbitrary importer symbols as references. Reference
recall and precision rose from 0% to 100%, false symbol claims fell from two to
zero, and every returned relation now carries evidence and confidence. The
honest responses cost 883 more tokens in the complete four-operation workflow
because they include two real use-sites and explicit evidence. Median retrieval
latency increased by 7.756 ms (36.7%).

## Exact Comparison

Five sequential runs used the same generated TypeScript fixture, task outcomes,
privacy rules, and `cl100k_base` tokenizer. The fixture contains two exported
targets, an aliased import, an unrelated first symbol, two real use-site symbols,
a sibling importer, and a barrel re-export. Each engine indexed the fixture once
before the timed runs. Both checkouts were clean, every run returned the target
seed, and repeated ordering was stable.

| Measure | Before | After |
| --- | ---: | ---: |
| Engine commit | `5e50606a738d7fd209606c15041c470c1ceb19c1` | `2359d6c882646ea0138fca2b2f73069467c30039` |
| Engine version | `1.0.3-alpha.251` | `1.0.4-alpha.252` |
| Valid runs | 5/5 | 5/5 |
| Relation recall | 0% | 100% |
| Relation precision | 0% | 100% |
| False symbol claims | 2 | 0 |
| Evidence coverage | 0% | 100% |
| Confidence coverage | 0% | 100% |
| Discovery response tokens, median | 412 | 642 |
| Context-bundle response tokens, median | 447 | 685 |
| Task-context response tokens, median | 795 | 1,037 |
| Complete workflow response tokens, median | 2,185 | 3,068 |
| Retrieval latency, median | 21.111 ms | 28.867 ms |
| Stable repeated ordering | yes | yes |

Correctness is the acceptance gate; the increased payload is not described as a
saving. File imports and re-exports are high-confidence file-scoped evidence.
Specifier-backed identifier mentions are medium-confidence symbol references,
not proven calls; semantic binding and call evidence remain P4 work.

## Reproduction

Run the checked-out engine:

```bash
pnpm bench:relationship-evidence -- --runs 5
```

Compare another clean checkout with the identical fixture and runner:

```bash
pnpm bench:relationship-evidence -- --engine-root /absolute/path/to/checkout --runs 5
```

The runner rejects dirty engine roots, fewer than three runs, missing seed
outcomes, and unstable repeated ordering. `--allow-dirty` exists only for local
development smoke tests and marks the output dirty. The command prints aggregate
measurements only; it removes its source-bearing fixture and index after the run.
