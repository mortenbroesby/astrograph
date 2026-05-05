# Implementation Specifications

This directory contains active internal implementation plans and subsystem specs.
Completed execution plans live in [`done/`](./done/README.md).

## Active Plans

- [Spec System](./spec-system.md) - Maintain this specs tree and the repo-local agent skills.
- [GitHub Actions Cost Policy](./github-actions-cost-policy.md) - Keep CI inside free Actions usage.

## Completed Plans

- [Completed Implementation Plans](./done/README.md)

## Planned Subsystem Specs

The active queue is maintained in the roadmap:

- [Agent Parity Roadmap](../roadmap/agent-parity-roadmap.md)

Expected next implementation plans:

- Retrieval quality upgrade
- Stable symbol identity
- Reference and dependency graph tools
- Compact output and detail levels

## Implementation Rules

- Implementation specs are not marketing docs.
- Each plan must include exact commands and expected outcomes.
- Source-changing work must handle package version policy.
- Use isolated worktrees unless the user explicitly asks for direct `main` work.
- Move completed plans to `done/` instead of leaving them in the active list.
