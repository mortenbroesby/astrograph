# Implementation Specifications

This directory contains internal implementation plans and subsystem specs.

## Current Plans

- [Source Architecture Refactor Plan](./src-architecture-refactor-plan.md) - Canonical refactor plan for storage, parser, CLI/MCP, observability, and type ownership.
- [Spec System](./spec-system.md) - Maintain this specs tree and the repo-local agent skills.
- [GitHub Actions Cost Policy](./github-actions-cost-policy.md) - Keep CI inside free Actions usage.
- [Release Agent Workflow](./release-agent.md) - Decide publish-worthy changes and push release tags.
- [MCP v1 Hard-Switch Plan](./mcp-v1-hard-switch-plan.md) - Hard removal of `query_code`, strict v1 schemas, and direct retrieval tools.

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
- MCP v1 hard-switch and API envelope migration (in progress)

## Implementation Rules

- Implementation specs are not marketing docs.
- Each plan must include exact commands and expected outcomes.
- Source-changing work must handle package version policy.
- Use isolated worktrees unless the user explicitly asks for direct `main` work.
