---
id: task-retrieval-quality-abbrev-symbol-search
slice: src
query: sym srch entry
workflowSet: [symbol-first]
allowedPaths:
  - src/**/*.ts
targets:
  - kind: symbol
    value: searchSymbols
    mode: exact
successCriteria:
  - the symbol-search entrypoint remains discoverable from an abbreviated query
---

This task records how the current symbol search handles a compact, task-card
style abbreviation instead of an exact API name.
