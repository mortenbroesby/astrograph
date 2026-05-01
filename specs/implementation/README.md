# Implementation Specifications

This directory contains internal implementation plans and subsystem specs.

## Current Plans

- [Storage Refactor Plan](./storage-refactor-plan.md) - Split `src/storage.ts` into focused modules.
- [Source Architecture Refactor Plan](./src-architecture-refactor-plan.md) - Turn the source architecture review into task-sized refactor lanes.
- [Spec System](./spec-system.md) - Maintain this specs tree and the repo-local agent skills.
- [GitHub Actions Cost Policy](./github-actions-cost-policy.md) - Keep CI inside free Actions usage.
- [Release Agent Workflow](./release-agent.md) - Decide publish-worthy changes and push release tags.

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
