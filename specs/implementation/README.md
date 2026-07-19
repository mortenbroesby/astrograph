# Implementation Specifications

This directory contains internal implementation plans and subsystem specs.

## Current Plans

- [Release Publication Evidence Delivery Checklist](./release-publication-evidence-delivery-checklist.md) - Active final-story checklist for idempotent version planning, gated cloud release, and npm publication evidence.
- [Remaining Delivery Epic](./remaining-delivery-epic.md) - The sole open epic-level tracker; final Story 8 is active for release publication evidence.
- [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md) - Planned roadmap for structural retrieval, lexical ranking, bounded task context, compact transport, onboarding, freshness, optional semantics, and honest benchmarks.
- [Staff Engineer Review Delivery Checklist](./staff-engineering-review-delivery-checklist.md) - Active child-task checklist for the evidence-based Staff Engineer review; recommendations do not authorize implementation.
- [Windows Compatibility Audit Delivery Checklist](./windows-compatibility-audit-delivery-checklist.md) - Active child-task checklist for the Windows platform audit; remediation remains in later stories.
- [Windows Filesystem and Storage Portability Delivery Checklist](./windows-filesystem-storage-portability-delivery-checklist.md) - Active child-task checklist for portable repository identity and storage lifecycle coverage.
- [Windows Git Discovery and Fallback Delivery Checklist](./windows-git-discovery-fallback-delivery-checklist.md) - Active child-task checklist for bounded, optional Git enrichment on Windows.
- [Windows CLI, MCP, and Package Invocation Delivery Checklist](./windows-cli-mcp-package-invocation-delivery-checklist.md) - Active child-task checklist for Windows package-manager shims and package smoke coverage.
- [Windows CI, Documentation, and Release Gate Delivery Checklist](./windows-ci-documentation-release-gate-delivery-checklist.md) - Active child-task checklist for native Windows CI, terminal guidance, and release-gate evidence.
- [Astrograph Feedback Consolidation Epic](./astro-feedback-epic.md) - Closed record of completed ranking, result discipline, explainability, repo-aware presets, and MCP/CLI parity work.
- [Astrograph Feedback Delivery Checklist](./astro-feedback-delivery-checklist.md) - Closed evidence record for the feedback epic.
- [Branch-Aware Incremental Index Mapping Plan](./branch-aware-incremental-index-plan.md) - Design-only plan for safe content-addressed analysis reuse across Git branches and worktrees.
- [Branch-Aware Incremental Index Epic](./branch-aware-incremental-index-epic.md) - Closed implementation record for safe branch and worktree analysis reuse.
- [Branch-Aware Incremental Index Delivery Checklist](./branch-aware-incremental-index-delivery-checklist.md) - Closed verification evidence for the branch-aware epic.
- [Windows Platform Support Epic](./windows-platform-support-epic.md) - Closed source roadmap; its unstarted work is in the Remaining Delivery Epic.
- [Node 22 Compatibility Epic](./node-22-compatibility-epic.md) - Closed record of the Node 22 minimum-runtime work.
- [Node 22 Compatibility Delivery Checklist](./node-22-compatibility-delivery-checklist.md) - Closed Node 22 compatibility evidence.
- [Source Architecture Refactor Plan](./src-architecture-refactor-plan.md) - Canonical refactor plan for storage, parser, CLI/MCP, observability, and type ownership.
- [Spec System](./spec-system.md) - Maintain this specs tree and the repo-local agent skills.
- [GitHub Actions Cost Policy](./github-actions-cost-policy.md) - Keep CI inside free Actions usage.
- [Release Agent Workflow](./release-agent.md) - Decide publish-worthy changes and push release tags.
- [MCP v1 Hard-Switch Plan](./mcp-v1-hard-switch-plan.md) - Hard removal of MCP `query_code`, strict `ok`/`data`/`meta`/`error` envelopes, `toolVersion: "1"` metadata, no MCP cache behavior, and the explicit `search_symbols`/`get_symbol_source`/`get_context_bundle`/`get_ranked_context` retrieval tools.

## Planned Subsystem Specs

- Storage metadata and readiness
- Schema and migration lifecycle
- Indexing and file refresh
- Retrieval and context assembly
- Parser backend ownership
- CLI and MCP command registry
- MCP tool observability
- Internal type ownership
- Diagnostics, doctor, and event retention

## Implementation Rules

- Implementation specs are not marketing docs.
- Each plan must include exact commands and expected outcomes.
- Source-changing work must handle package version policy.
- Use isolated worktrees unless the user explicitly asks for direct `main` work.
