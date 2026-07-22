---
id: task-bundle-workflow
slice: bench
query: Which workflow assembles payload-budgeted task context for benchmark queries?
workflowSet: [baseline, discovery-first, text-first, bundle]
allowedPaths:
  - bench/src/workflows.ts
targets:
  - kind: symbol
    value: taskContextWorkflow
    mode: exact
  - kind: symbol
    value: getTaskContext
    mode: exact
successCriteria:
  - the task-context workflow remains identifiable from the workflow registry
  - the retrieval path still points back to the canonical task-context call
---

This query measures whether the harness can retrieve the payload-budgeted
task-context workflow rather than only raw symbol and text search flows.
