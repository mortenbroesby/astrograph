---
id: task-corpus-loader
slice: bench
query: loadBenchmarkCorpus
workflowSet: [baseline, symbol-first]
allowedPaths:
  - bench/src/corpus.ts
targets:
  - kind: symbol
    value: loadBenchmarkCorpus
    mode: exact
successCriteria:
  - the corpus loader is retrieved from its allowed source file
---

This benchmark task compares read-all against exact-symbol retrieval for the
corpus loader.
