---
id: task-token-accounting
slice: bench
query: countTokens
workflowSet: [baseline, symbol-first]
allowedPaths:
  - bench/src/tokenizer.ts
  - bench/src/workflows.ts
targets:
  - kind: symbol
    value: countTokens
    mode: exact
successCriteria:
  - the exact tokenizer is retrieved from its allowed source file
---

This task compares broad reading against exact-symbol retrieval for exact token
counting.
