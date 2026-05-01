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

Implementation specs, refactor plans, and internal subsystem ownership.

- [Storage Refactor Plan](./implementation/storage-refactor-plan.md) - Current plan to split `src/storage.ts`.
- [Spec System](./implementation/spec-system.md) - How this spec tree and agent skills are maintained.

### [Templates](./templates/README.md)

Reusable starting points for agent-created docs.

- [ADR Template](./templates/adr.md)
- [Architecture Spec Template](./templates/architecture-spec.md)
- [API Spec Template](./templates/api-spec.md)
- [Implementation Plan Template](./templates/implementation-plan.md)

---

## Specification Roadmap

### Phase 1: Spec System Bootstrap (In Progress)

**Goal:** Make spec authoring predictable for agents.

- [x] Create top-level `specs/` index.
- [x] Add architecture, API design, implementation, and template sections.
- [x] Add repo-local agent skills for specs, ADRs, and plans.
- [ ] Backfill core subsystem specs from existing README and tests.

### Phase 2: Architecture Baseline (Planned)

**Goal:** Capture stable design rules before larger refactors.

- [ ] Document storage/index ownership boundaries.
- [ ] Record ADRs for SQLite-only local storage and MCP-first retrieval.
- [ ] Document freshness/readiness lifecycle.
- [ ] Document privacy and event-retention model.

### Phase 3: API Contract Baseline (Planned)

**Goal:** Make public surfaces explicit and testable.

- [ ] Document MCP tools and result stability.
- [ ] Document CLI command shapes and JSON output expectations.
- [ ] Document TypeScript API stability levels.
- [ ] Link contract tests to each public API spec.

### Phase 4: Implementation Plans (Planned)

**Goal:** Keep refactors task-sized, test-first, and reviewable.

- [x] Move storage refactor plan into `specs/implementation/`.
- [ ] Split future plans by subsystem.
- [ ] Require baseline verification and commit checkpoints in each plan.

---

## Out of Scope

- Marketing copy and installation tutorials belong in the root README.
- Release procedure belongs in [docs/release.md](../docs/release.md).
- Performance profiling procedure belongs in [docs/performance.md](../docs/performance.md).
- Specs do not replace tests. Each public contract spec must point to verification.
