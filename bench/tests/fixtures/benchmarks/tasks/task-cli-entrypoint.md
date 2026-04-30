---
id: task-cli-entrypoint
slice: .
query: What is the one-command Astrograph entrypoint for running the benchmark corpus locally?
workflowSet: [baseline, text-first]
allowedPaths:
  - bench/src/cli.ts
  - package.json
targets:
  - kind: symbol
    value: main
    mode: exact
  - kind: text
    value: bench:corpus
    mode: exact
successCriteria:
  - the benchmark CLI entrypoint remains discoverable
  - the package script stays visible as the default one-command contract
---

This query anchors the Phase 1 requirement that a developer can run the corpus
benchmark from one clear workspace command.
