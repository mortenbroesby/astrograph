# Completed Implementation Plans

This directory archives implementation plans whose local execution work is complete.

Completed plans remain useful as historical context and verification evidence, but
new work should not be queued here. Active implementation plans stay one level up
in `specs/implementation/`.

## Completed Plans

- [MCP v1 Hard-Switch Plan](./mcp-v1-hard-switch-plan.md) - Completed explicit MCP retrieval tools, strict v1 envelopes, tree-sitter-only parser cutover, and cache exclusion from MCP v1.
- [Source Architecture Refactor Plan](./src-architecture-refactor-plan.md) - Completed source-boundary refactor across storage, parser, command/transport, observability, and internal type ownership.
- [Release Agent Workflow](./release-agent.md) - Completed release-decision policy and guarded release-agent workflow documentation.

## Maintenance Rules

- Do not edit completed plans to create new work. Create a new active plan or roadmap item instead.
- If a completed plan needs follow-up, link the follow-up from `specs/roadmap/`.
- Keep completion claims grounded in tests, merged code, or release artifacts.
