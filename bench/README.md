# Astrograph Bench

Benchmark harness for [`astrograph`](../README.md).

The harness is package-local and remains an internal evaluation surface with its own CLI, corpus loading, token accounting, and reporting code.

## Current state

This harness now has a runnable MVP setup with:

- corpus loading from package-local benchmark manifests
- fixed workflow execution against `astrograph`
- deterministic JSON and markdown report output
- real token accounting with `tiktoken` using `cl100k_base`
- optional approximate sidecar estimates with `tokenx` for cheaper preflight
  cost/budget comparisons without replacing the exact benchmark numbers
