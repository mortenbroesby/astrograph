---
id: task-runner-artifacts
slice: bench
query: runBenchmark
workflowSet: [baseline, symbol-first]
allowedPaths:
  - bench/src/runner.ts
  - bench/src/report.ts
targets:
  - kind: symbol
    value: runBenchmark
    mode: exact
successCriteria:
  - the benchmark runner is retrieved from its allowed source file
---

This task compares broad reading against exact-symbol retrieval for the runner.
