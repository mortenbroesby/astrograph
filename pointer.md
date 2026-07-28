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
- [MCP Runtime Hygiene Delivery
  Checklist](./specs/implementation/active/mcp-runtime-hygiene-delivery-checklist.md)
  — finish review/merge evidence for visible stdio MCP processes and clean
  process-lifetime shutdown.
- [Interactive Install Lifecycle Epic](./specs/implementation/active/11_interactive-install-lifecycle-epic.md)
  — selected by the user: deliver one explicit, reversible lifecycle for setup,
  update, repair, diagnostics, and removal.
- [Git Ref Watch Reconciliation Delivery
  Checklist](./specs/implementation/active/3_git-ref-watch-reconciliation-delivery-checklist.md)
  — keep active watch sessions correct when Git checkout identity changes
  without dependable filesystem events.
- [Local Daemon Runtime Ownership Delivery
  Checklist](./specs/implementation/active/5_local-daemon-runtime-ownership-delivery-checklist.md)
  — run one user-local, on-demand daemon that owns isolated repository runtime
  lifecycles for concurrent stdio MCP clients.
- [Repository Structure Cleanup Epic](./specs/implementation/active/7_repository-structure-cleanup-epic.md)
  — collate benchmark/profiling ownership and simplify repository automation
  through small, behavior-preserving pull requests.
- [VoidZero Toolchain Epic](./specs/implementation/active/8_voidzero-toolchain-epic.md)
  — migrate package builds to tsdown first, then prove any runtime-loader,
  alias, or Oxc adoption independently.
- [Local Token-Savings Analytics Delivery
  Checklist](./specs/implementation/active/6_local-token-savings-analytics-delivery-checklist.md)
  — make already-proven token savings inspectable locally, without a tracking
  service or additional normal-request work.
- [Publishable Workflow Benchmark](./specs/implementation/active/9_publishable-workflow-benchmark.md)
  — establish a small, honest, snapshot-locked comparison between broad file
  reading and Astrograph retrieval before making workflow-level claims.
- [Runtime Acceleration Epic](./specs/implementation/active/10_runtime-acceleration-epic.md)
  — most urgent current focus: make repeated local MCP work faster by retaining
  daemon-owned index resources and prove it with representative measurements.
- [WASM Parser Runtime Migration](./specs/implementation/active/11_wasm-parser-runtime-migration.md)
  — replace the native Tree-sitter installation boundary and prove Node 20–24
  packaged installs without consumer compiler requirements.

## Keeping this useful

Update this summary when the current focus materially changes. Update the
roadmap and implementation indexes when a work item's status changes, but do
not require a pointer update for every implementation change or force a
successor before completing unrelated work.
