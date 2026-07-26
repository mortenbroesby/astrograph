# Current Implementation Focuses

This directory contains implementation work currently in focus. Its checklists
are the authoritative detail for their own scope and verification, but this is
not an exclusive authorization queue: multiple focuses may proceed at once,
and a clear user request may concern another roadmap item.

Completed evidence belongs in `../closed/`; deferred candidates belong in
`../planned/`. Check the [Delivery Roadmap](../roadmap.md) and
[`pointer.md`](../../../pointer.md) before starting unspecified work so that
new work complements rather than duplicates existing plans.

## Current focuses

1. [Tree-Sitter Polyglot Language Support Delivery Checklist](./1_tree-sitter-polyglot-language-support-delivery-checklist.md)
   — expand parser coverage through the documented compatibility and evidence
   gates.
2. [Local Daemon Runtime Ownership Delivery Checklist](./5_local-daemon-runtime-ownership-delivery-checklist.md)
   — selected by the user: one user-local daemon owns isolated repository
   runtimes, watches, workers, and SQLite lifecycles for MCP stdio clients.
3. [Repository Structure Cleanup Epic](./7_repository-structure-cleanup-epic.md)
   — selected by the user: collate benchmark ownership, remove unsupported
   script surfaces, and simplify repository automation one focused PR at a time.
4. [Publishable Workflow Benchmark](./9_publishable-workflow-benchmark.md)
   — selected by the user: publish a small, snapshot-locked comparison between
   broad file reading and Astrograph retrieval, with auditable evidence.

Use the [Delivery Roadmap](../roadmap.md) to understand planned, parked,
descoped, idea, and completed work. Update the roadmap, this index, and the
pointer when a work item's status or the current-focus summary materially
changes; do not make a mechanical pointer update a prerequisite for a valid
user-requested change.
