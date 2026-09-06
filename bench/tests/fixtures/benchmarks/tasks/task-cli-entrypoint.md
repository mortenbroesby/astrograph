---
id: task-cli-entrypoint
slice: .
query: main
workflowSet: [baseline, symbol-first]
allowedPaths:
  - bench/src/cli.ts
  - package.json
targets:
  - kind: symbol
    value: main
    mode: exact
successCriteria:
  - the benchmark CLI entrypoint is retrieved from its allowed source file
---

This task compares broad reading against exact-symbol retrieval for the CLI.
