---
id: task-bundle-workflow
slice: bench
query: taskContextWorkflow
workflowSet: [baseline, bundle]
allowedPaths:
  - bench/src/workflows.ts
targets:
  - kind: symbol
    value: taskContextWorkflow
    mode: exact
successCriteria:
  - the task-context workflow is retrieved from its allowed source file
---

This task compares broad reading with Astrograph's task-context workflow.
