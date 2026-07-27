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
2. [MCP Runtime Hygiene Delivery Checklist](./mcp-runtime-hygiene-delivery-checklist.md)
   — selected by the user: make stdio-server process sprawl visible and ensure
   normal shutdown releases process-lifetime resources.
3. [Comforting Install Experience](./2_comforting-global-install-experience.md)
   — make package installation plus global and repository-local client setup
   understandable without hidden configuration writes.
4. [Git Ref Watch Reconciliation Delivery Checklist](./3_git-ref-watch-reconciliation-delivery-checklist.md)
   — selected by the user: reconcile active watch sessions after a Git checkout
   identity changes, without adding a daemon or another cache.
5. [Guided Install and Refresh Hooks](./3_guided-install-and-refresh-hooks.md)
   — selected by the user: unify local/global onboarding, add opt-in
   integrations, and verify harness readiness.
6. [Local Daemon Runtime Ownership Delivery Checklist](./5_local-daemon-runtime-ownership-delivery-checklist.md)
   — selected by the user: one user-local daemon owns isolated repository
   runtimes, watches, workers, and SQLite lifecycles for MCP stdio clients.
7. [Local Token-Savings Analytics Delivery Checklist](./6_local-token-savings-analytics-delivery-checklist.md)
   — selected by the user: make existing local efficiency evidence useful as a
   source-free, negligible-overhead report without adding tracking infrastructure.
8. [Repository Structure Cleanup Epic](./7_repository-structure-cleanup-epic.md)
   — selected by the user: collate benchmark ownership, remove unsupported
   script surfaces, and simplify repository automation one focused PR at a time.
9. [Publishable Workflow Benchmark](./9_publishable-workflow-benchmark.md)
   — selected by the user: publish a small, snapshot-locked comparison between
   broad file reading and Astrograph retrieval, with auditable evidence.
10. [VoidZero Toolchain Epic](./8_voidzero-toolchain-epic.md)
    — migrate package builds to tsdown first; add runtime loaders, aliases, and
    Oxc only through separate proof-gated stories.
11. [Runtime Acceleration Epic](./10_runtime-acceleration-epic.md)
    — urgent one-PR delivery: retain daemon-owned index resources, serialize
    mutable repository work, and establish honest warm-runtime evidence.
12. [WASM Parser Runtime Migration](./11_wasm-parser-runtime-migration.md)
    — selected by the user: remove the native Tree-sitter install boundary and
    prove packed global installs on Node 20, 22, and 24.

Use the [Delivery Roadmap](../roadmap.md) to understand planned, parked,
descoped, idea, and completed work. Update the roadmap, this index, and the
pointer when a work item's status or the current-focus summary materially
changes; do not make a mechanical pointer update a prerequisite for a valid
user-requested change.
