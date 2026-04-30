---
id: task-runner-artifacts
slice: bench
query: Where does the benchmark runner build and persist results.json, report.md, and corpus.lock.json artifacts?
workflowSet: [baseline, text-first, bundle]
allowedPaths:
  - bench/src/runner.ts
  - bench/src/report.ts
targets:
  - kind: symbol
    value: runBenchmark
    mode: exact
  - kind: symbol
    value: createBenchmarkResultsArtifact
    mode: exact
  - kind: symbol
    value: renderBenchmarkReportMarkdown
    mode: exact
successCriteria:
  - the runner traces from execution to written benchmark artifacts
  - the report generator and JSON serializer stay part of the expected path
---

This query measures whether the harness can surface the code path that creates
the persisted JSON and Markdown benchmark outputs.
