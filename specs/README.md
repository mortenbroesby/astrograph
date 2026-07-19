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

- [Remaining Delivery Epic](./implementation/remaining-delivery-epic.md) - The sole open epic-level tracker; Story 4 is active while release publication evidence and later Windows support remain planned.
- [Precision Retrieval and Agent Experience Epic](./implementation/precision-retrieval-agent-experience-epic.md) - Planned, evidence-led roadmap inspired by precise structural retrieval and strong agent onboarding patterns.
- [Staff Engineer Review Delivery Checklist](./implementation/staff-engineering-review-delivery-checklist.md) - Active child-task checklist for the evidence-based Staff Engineer review.
- [Windows Compatibility Audit Delivery Checklist](./implementation/windows-compatibility-audit-delivery-checklist.md) - Active child-task checklist for the Windows platform audit.
- [Windows Filesystem and Storage Portability Delivery Checklist](./implementation/windows-filesystem-storage-portability-delivery-checklist.md) - Active child-task checklist for portable repository identity and storage lifecycle coverage.
- [Windows Git Discovery and Fallback Delivery Checklist](./implementation/windows-git-discovery-fallback-delivery-checklist.md) - Active child-task checklist for bounded, optional Git enrichment on Windows.
- [Windows CLI, MCP, and Package Invocation Delivery Checklist](./implementation/windows-cli-mcp-package-invocation-delivery-checklist.md) - Active child-task checklist for Windows package-manager shims and package smoke coverage.
- [Astrograph Feedback Consolidation Epic](./implementation/astro-feedback-epic.md) - Closed record of completed feedback work.
- [Astrograph Feedback Delivery Checklist](./implementation/astro-feedback-delivery-checklist.md) - Closed evidence record for the feedback epic.
- [Branch-Aware Incremental Index Epic](./implementation/branch-aware-incremental-index-epic.md) - Closed implementation record for branch and worktree analysis reuse.
- [Branch-Aware Incremental Index Delivery Checklist](./implementation/branch-aware-incremental-index-delivery-checklist.md) - Closed verification evidence for the branch-aware epic.
- [Windows Platform Support Epic](./implementation/windows-platform-support-epic.md) - Closed source roadmap; its unstarted work is in the Remaining Delivery Epic.
- [Node 22 Compatibility Epic](./implementation/node-22-compatibility-epic.md) - Closed record of the Node 22 minimum-runtime work.
- [Node 22 Compatibility Delivery Checklist](./implementation/node-22-compatibility-delivery-checklist.md) - Closed Node 22 compatibility evidence.
- [Source Architecture Refactor Plan](./implementation/src-architecture-refactor-plan.md) - Canonical refactor plan for storage, parser, CLI/MCP, observability, and type ownership.
- [Spec System](./implementation/spec-system.md) - How this spec tree and agent skills are maintained.
- [GitHub Actions Cost Policy](./implementation/github-actions-cost-policy.md) - CI cost controls and review checklist.
- [MCP v1 Hard-Switch Plan](./implementation/mcp-v1-hard-switch-plan.md) - Remove MCP `query_code`, ship strict `ok`/`data`/`meta`/`error` envelopes with `toolVersion: "1"`, keep MCP cache behavior out of v1, and define the explicit `search_symbols`/`get_symbol_source`/`get_context_bundle`/`get_ranked_context` retrieval surface.

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
- [x] Complete and merge MCP v1 hard-switch plan.

### Phase 4: Implementation Plans (Planned)

**Goal:** Keep refactors task-sized, test-first, and reviewable.

- [x] Add consolidated feedback epic for retrieval-quality roadmap planning.
- [x] Move storage refactor plan into `specs/implementation/`.
- [x] Split future plans by subsystem.
- [ ] Require baseline verification and commit checkpoints in each plan.

---

## Out of Scope

- Marketing copy and installation tutorials belong in the root README.
- Release procedure belongs in [docs/reference/release.md](../docs/reference/release.md).
- Performance profiling procedure belongs in [docs/guides/performance.md](../docs/guides/performance.md).
- Specs do not replace tests. Each public contract spec must point to verification.
