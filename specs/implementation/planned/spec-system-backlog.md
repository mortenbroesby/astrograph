# Spec System Backlog

> **Status:** Planned — these documentation obligations are not selected for
> active delivery. Move a scoped item to `../active/` only when it has an
> implementation plan and an owner.

**Goal:** Complete the remaining durable specification coverage without
duplicating implementation plans, user-facing setup docs, or release guides.

## Remaining Work

### Core subsystem coverage

- [ ] Backfill core subsystem specs from the existing README and tests.
- [ ] Document storage and index ownership boundaries.
- [ ] Document freshness and readiness lifecycle.
- [ ] Document privacy and event-retention model.

### Architecture decisions

- [ ] Record an ADR for SQLite-only local storage.
- [ ] Record an ADR for MCP-first retrieval.

### Public-contract evidence

- [ ] Link contract tests to each MCP, CLI, and TypeScript library API spec.

### Authoring consistency

- [ ] Confirm every implementation plan includes baseline verification and a
  commit checkpoint; update or close exceptions with evidence.

## Completion Criteria

- Each completed item links to its authoritative architecture, API, or
  implementation document.
- No checklist item duplicates user-facing installation, release, or
  performance documentation.
- The top-level and nearest section indexes reflect the final status.
