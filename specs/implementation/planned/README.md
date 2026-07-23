# Planned Implementation Work

This directory contains approved but unstarted work. A planned epic is not an
active delivery commitment: select it explicitly, create its delivery
checklist, and then move it to `../active/` before implementation begins.

## Ordered Backlog

The numeric prefix is the priority order. A child prefix such as `4_1` is a
dependency-ordered part of its parent epic, not a competing top-level priority.

1. [Precision Retrieval and Agent Experience Epic](./1_precision-retrieval-agent-experience-epic.md)
   — highest product impact: trustworthy, token-efficient retrieval in small,
   evidence-gated slices. Select a story only after its checklist is ready.
2. [Reduce Astrograph Boilerplate with Proven npm Modules](./2_npm-module-adoption-epic.md)
   — Stories 1–3 are complete. Package-confidence Stories 4–6 need the active
   CI-cost review before one may be selected; later stories remain bounded,
   planned maintenance improvements that preserve product-specific behavior.
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

The completed [README and Docs Diagram Design](../closed/readme-docs-diagram-design.md)
record now lives with closed evidence rather than in the delivery queue.
