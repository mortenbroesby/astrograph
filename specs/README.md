# Astrograph Project Specifications

This directory is the source of truth for Astrograph architecture, public
contracts, implementation plans, roadmap, and architectural decisions.

## Documentation Index

### [Architecture](./architecture/README.md)

Core principles and long-term technical decisions.

- [Core Principles](./architecture/core-principles.md) - Non-negotiable design goals for Astrograph.
- [Architecture Decisions](./architecture/adrs.md) - Accepted, proposed, and superseded ADRs.
- [Deep Dives](./architecture/README.md#architectural-deep-dives) - Storage, indexing, retrieval, and runtime boundaries.

### [API Design](./api-design/README.md)

External contracts for agents, CLIs, libraries, and MCP clients.

- [MCP Tools](./api-design/mcp-tools.md) - Stdio MCP tool contract.
- [CLI API](./api-design/cli-api.md) - JSON command surface and bin behavior.
- [Library API](./api-design/library-api.md) - TypeScript entry points and stability rules.

### [Roadmap](./roadmap/README.md)

Current product and implementation sequencing derived from raw investigation docs.

- [Agent Parity Roadmap](./roadmap/agent-parity-roadmap.md) - Next jCodeMunch-parity chunks and later lanes.

### [Implementation](./implementation/README.md)

Implementation specs, refactor plans, and internal subsystem ownership.

- [Spec System](./implementation/spec-system.md) - How this spec tree and agent skills are maintained.
- [GitHub Actions Cost Policy](./implementation/github-actions-cost-policy.md) - CI cost controls and review checklist.
- [Completed Implementation Plans](./implementation/done/README.md) - Archived plans whose execution work is complete.

### [Templates](./templates/README.md)

Reusable starting points for agent-created docs.

- [ADR Template](./templates/adr.md)
- [Architecture Spec Template](./templates/architecture-spec.md)
- [API Spec Template](./templates/api-spec.md)
- [Implementation Plan Template](./templates/implementation-plan.md)

---

## Specification Roadmap

### Completed Foundations

- [x] Create top-level `specs/` index.
- [x] Add architecture, API design, implementation, and template sections.
- [x] Add repo-local agent skills for specs, ADRs, and plans.
- [x] Complete and merge MCP v1 hard-switch plan.
- [x] Complete source architecture refactor plan.
- [x] Establish release-agent workflow and version policy docs.
- [x] Split completed implementation plans into `specs/implementation/done/`.
- [x] Add `specs/roadmap/` as the active future-work queue.

### Active Roadmap

The current next chunks are tracked in
[Agent Parity Roadmap](./roadmap/agent-parity-roadmap.md):

- [ ] Retrieval quality upgrade.
- [ ] Stable symbol identity.
- [ ] Reference and dependency graph tools.
- [ ] Compact output and detail levels.

### Backlog Themes

- [ ] Runtime profiles and compact schemas.
- [ ] Python language adapter pilot.
- [ ] Agent guidance, hooks, sessions, and edit lifecycle.
- [ ] Cache reintroduction after stable IDs and index generation.
- [ ] Edit-safety and impact tools.
- [ ] Optional semantic search.

---

## Out of Scope

- Marketing copy and installation tutorials belong in the root README.
- Release procedure belongs in [docs/release.md](../docs/release.md).
- Performance profiling procedure belongs in [docs/performance.md](../docs/performance.md).
- Specs do not replace tests. Each public contract spec must point to verification.
- Raw investigation material under `specs/raw/` is source material, not the active queue.
