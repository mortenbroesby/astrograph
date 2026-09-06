# jCodeMunch Comparison — 2026-09-06

## Outcome

On the bounded corpus-loader task, jCodeMunch produced a much smaller
deterministic retrieval payload and indexed faster. Astrograph used fewer total
model input tokens, fewer tool calls, and less wall time in the fresh-agent
trials. Both products completed every accepted run correctly.

These results do not establish a general winner. They show why payload evidence
and end-to-end agent evidence must be reported separately.

## Deterministic MCP Results

Three isolated runs used commit `15e931d1968841f2cab618801d84ca580b032254`,
Astrograph `0.14.1-alpha.241`, jCodeMunch `1.108.317`, and the repository's
`cl100k_base` counter. Each run used a new index store, called `index_folder`
twice, then used `search_symbols` and `get_symbol_source` to retrieve
`loadBenchmarkCorpus` and `loadBenchmarkTaskCard` from `bench/src/corpus.ts`.

| Measure | Astrograph | jCodeMunch |
| --- | ---: | ---: |
| Task success | 3/3 | 3/3 |
| Advertised tools | 14 | 20 |
| Tool-schema tokens | 2,849 | 4,204 |
| Retrieval tokens, median | 1,129 | 181 |
| Reduction from 2,929-token read-all baseline | 61.5% | 93.8% |
| Cold index, median | 40.78 s | 6.48 s |
| Warm index, median | 11.14 s | 0.85 s |
| Retrieval latency, median | 1.39 s | 1.33 s |
| Retrieval calls | 2 | 2 |

jCodeMunch used 84.0% fewer retrieval tokens and indexed 84.1% faster cold and
92.4% faster warm. Its complete advertised schema was 47.6% larger. Hosts may
defer or cache schema blocks, so schema cost is not added to retrieval tokens.

The warm measurement is a real second index operation: Astrograph reported 217
reused files; jCodeMunch reported `performed_incremental: true`. An earlier
draft incorrectly timed a jCodeMunch identity-collision error as a warm run.
That evidence was rejected, the harness now fails on unsuccessful envelopes,
and the reported runs use explicit jCodeMunch `identity_mode: local`.

## Fresh-Agent Results

The agent layer used clean commit
`058e2cb902df066540783caa68e378d4d9af10b5`. The target corpus file is unchanged
between that commit and the final deterministic commit. Every accepted run used
`gpt-5.3-codex-spark`, low reasoning, a read-only sandbox, a fresh ephemeral
session, and exactly two exposed retrieval tools for the named product.

| Measure | Astrograph | jCodeMunch |
| --- | ---: | ---: |
| Correct answers | 3/3 | 3/3 |
| Input tokens, median | 64,871 | 96,349 |
| Input-token range | 50,569–70,595 | 79,528–291,925 |
| Cached input tokens, median | 52,480 | 90,624 |
| Wall time, median | 21.55 s | 28.76 s |
| Wall-time range | 19.10–23.63 s | 27.71–60.71 s |
| Tool calls, median | 2 | 4 |
| Tool-call range | 2–2 | 4–13 |

For this task, Astrograph used 32.7% fewer median input tokens. Astrograph's
search returned stable literal symbol IDs and its source tool accepted both IDs
in one request. jCodeMunch's compact search aliases were not accepted by its
source tool; agents recovered using file-qualified IDs, but one run repeated
that resolution path enough to become a 291,925-token outlier.

One jCodeMunch run was discarded and replaced because the agent invoked a shell
command despite the retrieval-only prompt. Early protocol-development dry runs
were also excluded: `--ignore-user-config` cancelled Astrograph calls in this
Codex build, and one normal-config Astrograph dry run had to hydrate a missing
global index. No accepted run used shell, filesystem, web, another MCP server,
or changed the repository.

## Coverage and Semantic Mismatches

- Astrograph indexed 217 files and 1,769 symbols; jCodeMunch indexed 235 files
  and 11,543 symbols. jCodeMunch included more languages and configuration
  files, so symbol counts are not comparable measures of recall or quality.
- Deterministic runs compare the same task outcome, tokenizer, file, and source
  commit, not identical response formats or ranking algorithms.
- Agent runs exposed two tools per product, while the complete deterministic
  schema measurement reflects each configured catalog (14 versus 20 tools).
- Neither product's self-reported token-savings counter is used as cross-product
  evidence.

## Evidence and Reproduction

Run the source-free aggregate workflow with:

```bash
pnpm bench:jcodemunch-comparison -- --runs 3 \
  --output ".benchmarks/jcodemunch-comparison/$(git rev-parse --short HEAD)"
```

The ignored output contains `results.json`, `report.md`, and source-bearing raw
MCP responses. Agent JSONL, stderr timing, and the source-free agent aggregate
remain under `.benchmarks/jcodemunch-comparison/058e2cb/agent/`. Global install,
registration, re-index, and removal commands are in the
[benchmark guide](../guides/benchmarks.md#compare-jcodemunch-with-astrograph).
