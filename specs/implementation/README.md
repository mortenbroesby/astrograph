# Implementation Specifications

This directory contains internal implementation plans and subsystem specs.

## Current Plans

- [Storage Refactor Plan](./storage-refactor-plan.md) - Split `src/storage.ts` into focused modules.
- [Spec System](./spec-system.md) - Maintain this specs tree and the repo-local agent skills.
- [GitHub Actions Cost Policy](./github-actions-cost-policy.md) - Keep CI inside free Actions usage.

## Planned Subsystem Specs

- Storage metadata and readiness
- Schema and migration lifecycle
- Indexing and file refresh
- Retrieval and context assembly
- Diagnostics, doctor, and event retention

## Implementation Rules

- Implementation specs are not marketing docs.
- Each plan must include exact commands and expected outcomes.
- Source-changing work must handle package version policy.
- Use isolated worktrees unless the user explicitly asks for direct `main` work.
