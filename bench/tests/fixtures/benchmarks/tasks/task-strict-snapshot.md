---
id: task-strict-snapshot
slice: bench
query: assertStrictSnapshot
workflowSet: [baseline, symbol-first]
allowedPaths:
  - bench/src/runner.ts
  - bench/src/snapshot.ts
targets:
  - kind: symbol
    value: assertStrictSnapshot
    mode: exact
successCriteria:
  - the strict snapshot guard is retrieved from its allowed source file
---

This task compares broad reading against exact-symbol retrieval for the strict
snapshot guard.
