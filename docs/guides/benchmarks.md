# Benchmark Evidence

Astrograph measures retrieval behavior rather than claiming that a fixed number
applies to every repository, model, or agent workflow. Results vary with the
repository, question, and the agent's tool use.

## What is measured today

The checked-in workflow corpus compares a broad **read-all** baseline with
Astrograph retrieval workflows. Each task records exact `cl100k_base` tokens,
retrieved tokens, tool calls, latency, target recall, and ranking metrics.

Run it from a source checkout:

```bash
pnpm bench:corpus
```

Every supported `pnpm bench:*` command builds first, so the report uses the
current source and generated `dist/` files. Do not call its underlying Node
script directly when recording evidence.

It writes a fast-rendering Markdown report and the corresponding JSON evidence
to `.benchmarks/astrograph/latest/`. The Markdown report is the public-facing
view; the JSON retains the per-task evidence needed to audit it.

The corpus is tied to a repository snapshot. Do not compare a result with a
different checkout as though it were the same experiment. Refresh the corpus
and rerun it before publishing a new workflow-level claim.

## Compare jCodeMunch with Astrograph

The comparison harness pins jCodeMunch, disables its remote/AI/telemetry paths,
uses fresh per-run index stores, counts both products with `cl100k_base`, and
keeps source-bearing output under ignored `.benchmarks/`.

Install the pinned global test tool with an existing uv-managed Python 3.13:

```bash
uv tool install --python "$(uv python find 3.13)" "jcodemunch-mcp==1.108.317"
jcodemunch-mcp --version
uv tool list
```

Create a dedicated store rather than changing an existing `~/.code-index`:

```bash
export JCODEMUNCH_BENCHMARK_INDEX="$HOME/.code-index-astrograph-benchmark"
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp config --init
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp config set use_ai_summaries false
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp config set context_providers false
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp config set allow_remote_summarizer false
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp config set share_savings false
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp config set perf_telemetry_enabled false
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp config set tool_profile core
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp config set compact_schemas true
```

The project `.jcodemunch.jsonc` carries the same behavioral controls. The
dedicated global config is still required because project config is unavailable
during the repository-less initial MCP `tools/list` handshake.

Register the resolved binary with Codex and verify both registrations:

```bash
codex mcp add --env CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" \
  jcodemunch -- "$HOME/.local/bin/jcodemunch-mcp"
codex mcp get jcodemunch --json
codex mcp get astrograph --json
```

Index this checkout for manual agent trials, then run the deterministic
comparison:

```bash
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" \
  jcodemunch-mcp index "$PWD" --no-ai-summaries
pnpm bench:jcodemunch-comparison -- --runs 3 \
  --output ".benchmarks/jcodemunch-comparison/$(git rev-parse --short HEAD)"
```

If the checkout commit changed and jCodeMunch reports both local and Git
identities, delete only the named dedicated-store index returned by
`list-repos`, then re-index:

```bash
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp list-repos --json
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" \
  jcodemunch-mcp delete-index local/jcodemunch-benchmark-54b86399 --json
```

Read the dated [2026-09-06 comparison](../reviews/jcodemunch-comparison-2026-09-06.md)
before interpreting results. It separates deterministic payloads from fresh
agent sessions and documents catalog, indexing, and symbol-ID mismatches.

Remove the global test setup without touching Astrograph or an older
`~/.code-index`:

```bash
codex mcp remove jcodemunch
CODE_INDEX_PATH="$JCODEMUNCH_BENCHMARK_INDEX" jcodemunch-mcp list-repos --json
uv tool uninstall jcodemunch-mcp
mv "$JCODEMUNCH_BENCHMARK_INDEX" \
  "$HOME/.Trash/code-index-astrograph-benchmark-$(date +%Y%m%d-%H%M%S)"
```

Run the inventory command before the move and remove only the dedicated path.
The Trash move is recoverable; it does not remove a preserved pipx environment
or change the Astrograph registration/cache.

## Current reproducible baseline

`pnpm bench:agc1-compact-output -- --summary` exercises four deterministic
repository fixtures using the actual MCP serving path. It showed these token
reductions for supported compact responses:

| Response | Token reduction |
| --- | ---: |
| Successful symbol search | 55.6% |
| Empty symbol search | 57.4% |
| File tree | 66.7% |
| File outline | 59.0% |

These figures measure response-envelope size only. They do not prove agent
task success, latency on a real repository, or a general productivity gain.
Ordinary JSON is still the default; compact output is opt-in.

## Reproduce and extend

For index, query, freshness, and MCP-envelope measurements, use the
[performance guide](./performance.md). The workflow corpus and its report
format live in [`bench/`](../../bench/); task cards define the allowed files and
success targets, so a new real-world scenario can be reviewed before it is
advertised.
