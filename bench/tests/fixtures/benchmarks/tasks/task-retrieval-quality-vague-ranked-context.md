---
id: task-retrieval-quality-vague-ranked-context
slice: src
query: Which symbol assembles ranked context for vague code questions?
workflowSet: [symbol-first]
allowedPaths:
  - src/**/*.ts
targets:
  - kind: symbol
    value: getRankedContext
    mode: exact
successCriteria:
  - the ranked-context entrypoint is discoverable from a natural-language task card
---

This task records how the current symbol search handles a vague retrieval-quality
query that talks about ranked context without naming the implementation symbol.
