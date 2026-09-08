# jCodeMunch Comparison — 2026-09-08 Baseline

## Outcome

Astrograph and jCodeMunch both completed the bounded corpus-loader task in all
three deterministic and all three accepted fresh-agent runs. jCodeMunch still
used smaller retrieval payloads and was faster, while Astrograph advertised a
smaller tool schema and produced fewer agent output tokens.

This is a task-specific baseline, not a general winner declaration. It records
payload and agent evidence separately so later retrieval changes can be
compared against the same contract.

## Deterministic MCP Results

Three isolated runs used commit
`9e66efc68d09b39446c564ba2ceb041c5e3e09c3`, Astrograph
`1.0.2-alpha.250`, jCodeMunch `1.108.317`, and `cl100k_base`. Every run used a
fresh per-product index, disabled jCodeMunch AI, remote summarization, context
providers, sharing, and telemetry, then retrieved `loadBenchmarkCorpus` and
`loadBenchmarkTaskCard` from `bench/src/corpus.ts` with exactly two retrieval
calls. Failed source retrieval cannot enter the medians.

| Measure | Astrograph | jCodeMunch |
| --- | ---: | ---: |
| Task success | 3/3 | 3/3 |
| Advertised tools | 14 | 20 |
| Tool-schema tokens | 2,875 | 4,204 |
| Complete two-call workflow tokens, median | 922 | 742 |
| Complete two-call workflow bytes, median | 3,291 | 2,707 |
| Exact-source response tokens, median | 626 | 580 |
| Exact-source response bytes, median | 2,156 | 2,142 |
| Reduction from 2,929-token read-all baseline | 68.5% | 74.7% |
| Cold index, median | 5.32 s | 3.46 s |
| Warm index, median | 0.87 s | 0.51 s |
| Retrieval latency, median | 1.03 s | 0.71 s |
| Retrieval calls | 2 | 2 |

jCodeMunch used 19.5% fewer complete-workflow tokens and 7.3% fewer
exact-source tokens. Astrograph advertised 31.6% fewer schema tokens. The warm
index gap is now about 1.70x, compared with 11.8x before the redundant Git-ignore
subprocesses were removed.

## Fresh-Agent Results

Each accepted run used a fresh ephemeral Codex session with
`gpt-5.3-codex-spark`, low reasoning, a read-only sandbox, ignored user config,
and exactly two enabled retrieval tools for the named product. The prompt fixed
the repository, file, query, result limit, two target functions, batched exact
source retrieval, verification, and prohibition on shell or other fallback
tools. The jCodeMunch prompt additionally required its documented compact-alias
expansion before source retrieval.

| Measure | Astrograph | jCodeMunch |
| --- | ---: | ---: |
| Correct answers | 3/3 | 3/3 |
| Input tokens, median | 69,312 | 67,184 |
| Cached input tokens, median | 54,016 | 52,992 |
| Output tokens, median | 764 | 1,177 |
| Tool calls | 2 in every run | 2 in every run |
| Shell or fallback calls | 0 | 0 |

jCodeMunch used 3.1% fewer median input tokens in this fresh-agent sample.
Astrograph used 35.1% fewer median output tokens. One earlier Astrograph attempt
was rejected before these samples because the isolated Codex configuration
omitted per-tool approval entries and Codex cancelled every MCP call; it is a
harness-configuration failure and is excluded from the accepted-run metrics.

## Reproduction and Evidence

Run the deterministic comparison with:

```bash
pnpm bench:jcodemunch-comparison -- --runs 3 \
  --output ".benchmarks/jcodemunch-comparison/$(git rev-parse --short HEAD)-baseline"
```

The ignored output contains `results.json`, `report.md`, and source-bearing raw
responses. Only the source-free aggregate values above are committed. Neither
product's self-reported savings counter is used as cross-product evidence.
