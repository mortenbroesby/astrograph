# Astrograph Bench

Benchmark harness for [`astrograph`](../README.md).

The harness is package-local and remains an internal evaluation surface with its own CLI, corpus loading, token accounting, and reporting code.

## Command Map

All benchmark and profiling entrypoints live in `bench/`. The package commands
are the supported way to run them:

| Surface | Commands | Owner |
| --- | --- | --- |
| Corpus workflows | `bench:corpus`, `bench:tokenizer-research` | `bench/src/` |
| Small fixtures | `bench:small`, `bench:cli` | `bench/scripts/benchmark-*.mjs` |
| Repository performance | `bench:perf`, `bench:perf:index`, `bench:perf:query` | `bench/scripts/perf*.mjs` |
| Behavior baselines | `bench:freshness-lifecycle`, `bench:mcp-envelopes`, `bench:agc1-compact-output` | `bench/scripts/measure-*.mjs` |
| Profiling | `profile:index:clinic`, `profile:query:clinic`, `profile:index:0x`, `profile:query:0x` | `bench/scripts/perf-*.mjs` |

`bench/tests/` verifies the corpus harness. The focused root tests verify the
public perf and compact-output script contracts. Benchmark runs are local
evidence, not CI performance targets.

## Current state

This harness now has a runnable MVP setup with:

- corpus loading from package-local benchmark manifests
- fixed workflow execution against `astrograph`
- deterministic JSON and markdown report output
- real token accounting with `tiktoken` using `cl100k_base`
- optional approximate sidecar estimates with `tokenx` for cheaper preflight
  cost/budget comparisons without replacing the exact benchmark numbers
