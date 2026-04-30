---
id: task-bundle-workflow
slice: bench
query: Which workflow assembles bounded context for benchmark queries?
workflowSet: [baseline, discovery-first, text-first, bundle]
allowedPaths:
  - bench/src/workflows.ts
targets:
  - kind: symbol
    value: bundleWorkflow
    mode: exact
  - kind: symbol
    value: getContextBundle
    mode: exact
successCriteria:
  - the bounded-context workflow remains identifiable from the workflow registry
  - the retrieval path still points back to the underlying context bundle call
---

This query measures whether the harness can retrieve the bounded-context
workflow rather than only the raw symbol and text search flows.
