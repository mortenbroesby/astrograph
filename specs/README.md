# Astrograph Project Specifications

This directory is the source of truth for Astrograph architecture, public
contracts, implementation plans, and architectural decisions.

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

### [Implementation](./implementation/README.md)

Executable implementation queues, planned work, closed evidence, and internal
subsystem references.

- [Active Work](./implementation/active/README.md) - The selected delivery queue and deferred re-selection context.
- [Delivery Roadmap](./implementation/roadmap.md) - One-page view of active,
  ready, parked, descoped, idea, and completed implementation work.
- [Planned Work](./implementation/planned/README.md) - Approved work that is not yet selected for delivery.
- [Closed Records](./implementation/closed/README.md) - Completed and superseded implementation evidence.
- [Standing References](./implementation/README.md#standing-references) - Spec-system, CI cost, and release workflow guidance.

### [Templates](./templates/README.md)

Reusable starting points for agent-created docs.

- [ADR Template](./templates/adr.md)
- [Architecture Spec Template](./templates/architecture-spec.md)
- [API Spec Template](./templates/api-spec.md)
- [Implementation Plan Template](./templates/implementation-plan.md)

---

## Spec-System Backlog

The completed bootstrap and historical milestones are preserved in Git history.
The remaining documentation work is tracked in the planned
[Spec System Backlog](./implementation/planned/7_spec-system-backlog.md), rather
than duplicated in this index.

---

## Out of Scope

- Marketing copy and installation tutorials belong in the root README.
- Release procedure belongs in [docs/reference/release.md](../docs/reference/release.md).
- Performance profiling procedure belongs in [docs/guides/performance.md](../docs/guides/performance.md).
- Specs do not replace tests. Each public contract spec must point to verification.
