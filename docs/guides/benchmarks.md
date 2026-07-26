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
