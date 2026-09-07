# jCodeMunch Comparison — 2026-09-06

## Outcome

On the bounded corpus-loader task, Astrograph's new compact exact-source format
reduced its source response from 1,139 to 626 tokens and brought it within 46
tokens of jCodeMunch's 580-token response. jCodeMunch still used fewer tokens
across the complete two-call workflow and indexed substantially faster. Both
products returned both requested implementations in all three corrected runs.

These results do not establish a general winner. They show why payload evidence
and end-to-end agent evidence must be reported separately.

## Deterministic MCP Results

Three isolated runs used merged commit `6a9335169bf013d5a2a21b3c98fe0de9c2096603`,
Astrograph `1.0.0-alpha.246`, jCodeMunch `1.108.317`, and the repository's
`cl100k_base` counter. Each run used a new index store, called `index_folder`
twice, then used compact `search_symbols` and batched `get_symbol_source` to retrieve
`loadBenchmarkCorpus` and `loadBenchmarkTaskCard` from `bench/src/corpus.ts`.

| Measure | Astrograph | jCodeMunch |
| --- | ---: | ---: |
| Task success | 3/3 | 3/3 |
| Advertised tools | 14 | 20 |
| Tool-schema tokens | 2,849 | 4,204 |
| Complete two-call workflow tokens, median | 922 | 742 |
| Exact-source response tokens, median | 626 | 580 |
| Exact-source response bytes | 2,156 | 2,142 |
| Reduction from 2,929-token read-all baseline | 68.5% | 74.7% |
| Cold index, median | 21.15 s | 3.42 s |
| Warm index, median | 5.40 s | 0.46 s |
| Retrieval latency, median | 0.78 s | 0.67 s |
| Retrieval calls | 2 | 2 |

jCodeMunch used 19.5% fewer complete-workflow tokens and 7.3% fewer source-response
tokens. Astrograph advertised 31.6% fewer schema tokens. jCodeMunch indexed
83.8% faster cold and 91.4% faster warm. Hosts may defer or cache schema blocks,
so schema cost is not added to retrieval tokens.

Astrograph ordinary JSON remains the compatibility default. Decoding each
compact source response from the same merged-main trials and serializing its
ordinary v1 envelope measured 1,139 tokens; selecting compact at the formatting
boundary reduced that response by 45.0% without changing the decoded fields.

The warm measurement is a real second index operation: Astrograph reported 217
reused files and zero parsed files; jCodeMunch reported
`performed_incremental: true`. The remaining warm-index gap is material enough
for a separate optimization investigation, but no indexing work is included in
this exact-source change.

### Warm-index follow-up

Three isolated runs on candidate `af3ee2ab6bd700995a196ced82c8e82a6f7c2699`
removed redundant per-file Git ignore checks after path discovery had already
validated each file. Both products completed 3/3 runs with unchanged retrieval
results.

| Warm index, median | Before | Candidate |
| --- | ---: | ---: |
| Astrograph | 5.40 s | 0.75 s |
| jCodeMunch | 0.46 s | 0.43 s |

Astrograph's warm median improved by 86.1%, reducing the gap from about 11.8x
to 1.75x. A separate direct 217-file run measured 5.61 s before and 0.88 s
after; the candidate still reported all 217 files reused and zero parsed files.
Cold-index median also improved from 21.15 s to 5.32 s because the same
redundant subprocesses affected first-time indexing.

The earlier 181-token jCodeMunch result was invalid. Compact search returned an
alias such as `@1::loadBenchmarkCorpus#function`; the harness passed that alias
directly to `get_symbol_source`, received `Symbol not found`, then incorrectly
counted target names from search as success. The corrected adapter expands the
alias table to canonical file-qualified IDs, batches both targets, rejects tool
errors or missing source bodies, and excludes failed runs from aggregates.

## Historical Fresh-Agent Results

These earlier agent-layer trials used clean commit
`058e2cb902df066540783caa68e378d4d9af10b5`. The target corpus file is unchanged
between that commit and the corrected deterministic commit. They were not rerun
for the compact exact-source feature and are not part of the deterministic
payload comparison above. Every accepted run used
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

For this historical task, Astrograph used 32.7% fewer median input tokens.
Astrograph search returned stable literal symbol IDs. jCodeMunch agents had to
expand compact search aliases to file-qualified IDs; one run repeated that
resolution path enough to become a 291,925-token outlier. The deterministic
harness now performs that expansion directly rather than charging either agent
for protocol recovery.

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
  commit. Each product uses its supported compact discovery encoding;
  Astrograph's compact exact-source response is decoded and checked against its
  ordinary v1 contract before success is accepted.
- Workflow tokens include compact discovery plus exact source. Source-response
  tokens isolate the call affected by exact-source compaction.
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

The ignored output contains source-free `results.json` and `report.md`, plus
source-bearing raw MCP responses. Agent JSONL, stderr timing, and the source-free agent aggregate
remain under `.benchmarks/jcodemunch-comparison/058e2cb/agent/`. Global install,
registration, re-index, and removal commands are in the
[benchmark guide](../guides/benchmarks.md#compare-jcodemunch-with-astrograph).
