# Current Focus

This tracked file is a quick orientation point for work in the Astrograph
repository. Read it before choosing unspecified work, then use the user's
request and the [Delivery Roadmap](./specs/implementation/roadmap.md) to set
scope. It is not an exclusive queue or authorization gate: multiple focuses
can progress at once, and a clear request can legitimately concern other work.

Do not revive a closed or deferred story merely because it appears in history;
use its recorded evidence or selection gate instead.

## Current focuses

- [Tree-Sitter Polyglot Language Support Delivery
  Checklist](./specs/implementation/active/1_tree-sitter-polyglot-language-support-delivery-checklist.md)
  — expand parser coverage through the documented compatibility and evidence
  gates.
- [Local Daemon Runtime Ownership Delivery
  Checklist](./specs/implementation/active/5_local-daemon-runtime-ownership-delivery-checklist.md)
  — run one user-local, on-demand daemon that owns isolated repository runtime
  lifecycles for concurrent stdio MCP clients.
- [Repository Structure Cleanup Epic](./specs/implementation/active/7_repository-structure-cleanup-epic.md)
  — collate benchmark/profiling ownership and simplify repository automation
  through small, behavior-preserving pull requests.
- [Publishable Workflow Benchmark](./specs/implementation/active/9_publishable-workflow-benchmark.md)
  — establish a small, honest, snapshot-locked comparison between broad file
  reading and Astrograph retrieval before making workflow-level claims.

## Keeping this useful

Update this summary when the current focus materially changes. Update the
roadmap and implementation indexes when a work item's status changes, but do
not require a pointer update for every implementation change or force a
successor before completing unrelated work.
