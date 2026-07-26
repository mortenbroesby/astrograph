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
- [Comforting Install Experience](./specs/implementation/active/2_comforting-global-install-experience.md)
  — finish the remaining delivery/PR evidence for understandable global and
  repository-local setup.
- [Git Ref Watch Reconciliation Delivery
  Checklist](./specs/implementation/active/3_git-ref-watch-reconciliation-delivery-checklist.md)
  — keep active watch sessions correct when Git checkout identity changes
  without dependable filesystem events.
- [Guided Install and Refresh Hooks](./specs/implementation/active/3_guided-install-and-refresh-hooks.md)
  — simplify setup to one install command, make integrations opt-in, and
  verify harness readiness before relying on it.
- [Local Daemon Runtime Ownership Delivery
  Checklist](./specs/implementation/active/5_local-daemon-runtime-ownership-delivery-checklist.md)
  — run one user-local, on-demand daemon that owns isolated repository runtime
  lifecycles for concurrent stdio MCP clients.
- [Repository Structure Cleanup Epic](./specs/implementation/active/7_repository-structure-cleanup-epic.md)
  — collate benchmark/profiling ownership and simplify repository automation
  through small, behavior-preserving pull requests.
- [Local Token-Savings Analytics Delivery
  Checklist](./specs/implementation/active/6_local-token-savings-analytics-delivery-checklist.md)
  — make already-proven token savings inspectable locally, without a tracking
  service or additional normal-request work.

## Keeping this useful

Update this summary when the current focus materially changes. Update the
roadmap and implementation indexes when a work item's status changes, but do
not require a pointer update for every implementation change or force a
successor before completing unrelated work.
