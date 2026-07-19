# Implementation Specifications

This directory contains internal implementation plans and subsystem specs.

## Current Plans

- [Astrograph Feedback Consolidation Epic](./astro-feedback-epic.md) - Consolidated milestone roadmap for ranking, result discipline, explainability, repo-aware presets, and MCP/CLI parity based on `.memory/astro-feedback.md`.
- [Astrograph Feedback Delivery Checklist](./astro-feedback-delivery-checklist.md) - Work-in-progress story breakdown, handoff note, and implementation checklist for the feedback epic.
- [Branch-Aware Incremental Index Mapping Plan](./branch-aware-incremental-index-plan.md) - Design-only plan for safe content-addressed analysis reuse across Git branches and worktrees.
- [Branch-Aware Incremental Index Epic](./branch-aware-incremental-index-epic.md) - Story-sized execution roadmap for safe branch and worktree analysis reuse.
- [Branch-Aware Incremental Index Delivery Checklist](./branch-aware-incremental-index-delivery-checklist.md) - Work-in-progress task breakdown and verification evidence for the branch-aware epic.
- [Windows Platform Support Epic](./windows-platform-support-epic.md) - Roadmap for native Windows Node.js terminal and Git Bash support.
- [Node 22 Compatibility Epic](./node-22-compatibility-epic.md) - Lower the runtime entry barrier by making Node 22 LTS the tested minimum.
- [Node 22 Compatibility Delivery Checklist](./node-22-compatibility-delivery-checklist.md) - Work-in-progress baseline, child tasks, and evidence for Node 22 support.
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
