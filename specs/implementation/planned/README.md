# Planned Implementation Work

This directory contains approved work that is not currently in focus. A
planned epic is not an implied commitment, but a clear user request may begin
it without a ceremonial queue transition. Move or index it under `../active/`
when it becomes sustained work, and keep its delivery checklist current.

## Ordered Backlog

The numeric prefix is the priority order. A child prefix such as `4_1` is a
dependency-ordered part of its parent epic, not a competing top-level priority.

1. [Node 20–24 Runtime Compatibility](./1_node-20-to-24-runtime-compatibility-epic.md)
   — high-priority separate follow-up to prove and repair the published
   Node 20/22/24 contract without expanding the current runtime PR.
2. [Reduce Astrograph Boilerplate with Proven npm Modules](./2_npm-module-adoption-epic.md)
   — Stories 1–3 are complete. The package-confidence CI-cost review is parked
   until it regains product priority and its temporary CLI evaluation is
   approved; later stories remain bounded,
   planned maintenance improvements that preserve product-specific behavior.
   - [Package-Confidence CI Cost Review](./4_npm-module-package-confidence-cost-review-checklist.md)
     — parked evidence record for Stories 4–6; resume only when the stated
     product-priority and third-party CLI-execution gates are met.
3. [Remaining Delivery Epic](./3_remaining-delivery-epic.md) — parked Windows
   support sequence. Hosted Windows CI is disabled for cost; retain its code
   and re-enable only with budget and local/container proof.
   1. [Compatibility audit](./3_1_windows-compatibility-audit-delivery-checklist.md)
   2. [Filesystem and storage portability](./3_2_windows-filesystem-storage-portability-delivery-checklist.md)
   3. [Git discovery and fallback](./3_3_windows-git-discovery-fallback-delivery-checklist.md)
   4. [CLI, MCP, and package invocation](./3_4_windows-cli-mcp-package-invocation-delivery-checklist.md)
   5. [Watch and refresh reliability](./3_5_windows-watch-refresh-delivery-checklist.md)
   6. [CI, documentation, and release gate](./3_6_windows-ci-documentation-release-gate-delivery-checklist.md)
4. [High-Impact Product Follow-Ups](./4_high-impact-followups-epic.md) —
   historical completed results plus deferred candidates; reopen only when a
   recorded selection gate gains new evidence.
5. [Global + Branch-Aware Artifact Reuse](./5_global-branch-artifact-reuse-delivery-checklist.md)
   — deferred after its measured benefit did not justify the added storage
   complexity.
6. [Global Install and Cache Deferred Story Handoffs](./6_global-install-and-cache-deferred-stories.md)
   — historical handoffs; only the optional immutable artifact-store candidate
   remains deferred and it is not authorized for implementation.
7. [Spec System Backlog](./7_spec-system-backlog.md) — lower-impact durable
   architecture/API coverage and authoring consistency.
8. [Local Token-Savings Analytics Epic](./9_local-token-savings-analytics-epic.md)
   — active, deliberately local-only work to make exact savings inspectable
   without creating tracking infrastructure.
- [Complexity Cleanup Epic](./complexity-cleanup-epic.md) — completed
  non-pointer cleanup evidence retained outside the active delivery queue.

The completed [README and Docs Diagram Design](../closed/readme-docs-diagram-design.md)
record now lives with closed evidence rather than in the delivery queue.
