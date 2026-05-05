# Architecture Decision Records

This file records significant Astrograph architecture decisions. New ADRs should
be appended in chronological order and use [the ADR template](../templates/adr.md).

---

## ADR-001: Use SQLite WAL For Local Index Storage

**Date:** 2026-05-01
**Status:** Accepted

**Context:** Astrograph needs a local, inspectable, zero-service index for files,
symbols, imports, freshness metadata, and search tables.

**Decision:** Use SQLite as the local index backend, with WAL mode as the
configured storage mode.

**Rationale:**

- SQLite keeps the operational model local and simple.
- WAL supports concurrent reads during normal agent retrieval.
- The index remains easy to inspect, delete, and rebuild.

**Consequences:**

- Good fit for single-repo local agent workflows.
- Horizontal/distributed indexing is out of scope for the current package.
- Schema changes require careful migration tests.

---

## ADR-002: Keep MCP, CLI, And Library Surfaces Aligned

**Date:** 2026-05-01
**Status:** Accepted

**Context:** Astrograph exposes the same retrieval capabilities through stdio
MCP, JSON CLI commands, and TypeScript exports.

**Decision:** Public behavior should be implemented through shared core
functions and contract-tested across all three surfaces.

**Rationale:**

- Agents may use whichever surface is available in their runtime.
- Shared behavior prevents MCP-only or CLI-only drift.
- Contract tests make package releases safer.

**Consequences:**

- New public capabilities require API-design docs and interface tests.
- Result-shape changes must be treated as compatibility-sensitive.

---

## ADR-003: Hard-Switch MCP V1 Contract and Cache Deletion Policy

**Date:** 2026-05-02
**Status:** Accepted

**Context:** Astrograph needs explicit, workflow-oriented MCP tools for retrieval
while moving to a cleaner versioned contract. Maintaining the existing
`query_code` umbrella during this transition adds ambiguity and slows migration.

**Decision:**

- Remove `query_code` from the MCP surface in this hard-switch.
- Add strict v1 tools: `search_symbols`, `get_symbol_source`,
  `get_context_bundle`, and `get_ranked_context`.
- Use a single strict v1 response envelope for success and failure.
- Carry versioning in both registration metadata (`toolVersion: "1"`) and response
  metadata (`meta.toolVersion`).
- Keep plain tool names (no `_v1` suffix).
- Remove query/result/session caching from MCP v1 until 1.0; no cache tables,
  cache-hit metadata, or cache invalidation behaviors are introduced in this slice.

**Rationale:**

- A hard switch reduces long-term complexity from dual paradigms.
- Unified schemas simplify validation and future test gates.
- Dual version signaling improves traceability without polluting call sites.
- Cache deletion avoids locking migration to unstable invalidation and identity
  assumptions and matches the v1 hard-switch migration profile.

**Consequences:**

- Breaking MCP change requires client migration in this release path.
- Library `queryCode` remains available internally and for direct consumers.
- Stable symbol identity changes must align with these tool transitions.
- Cache strategy will be reintroduced in a post-1.0 ADR with migration guidance.

---

## ADR-004: Use Tree-Sitter-Only Parsing For MCP V1 Hard-Switch

**Date:** 2026-05-03
**Status:** Accepted

## Context

The MCP v1 hard-switch needs a stable parser contract while the tool surface,
strict response envelopes, and cache deletion policy are changing. The current
parser architecture allows OXC execution with tree-sitter fallback, which keeps
speed as an optimization but makes parser metadata, symbol drift review, and
language expansion harder to reason about during the v1 cutover.

## Decision

For the MCP v1 hard-switch, active parser execution is tree-sitter-only.

- OXC is removed from active parser execution in this slice.
- `oxc-parser` is removed from parser dependencies when the cutover lands.
- `oxc-resolver` may remain only if source search confirms import resolution
  still uses it outside parser execution.
- Language coverage and parser contract stability take priority over parser
  speed until v1 stabilizes.
- OXC can be reconsidered only through a later ADR after the MCP v1 contract is
  stable.

## Rationale

- Tree-sitter gives one parser execution model for the hard-switch.
- The v1 MCP contract needs deterministic parser metadata more than parser
  backend optionality.
- Removing hybrid parser execution reduces migration risk while tests are
  rewritten around explicit retrieval tools and strict envelopes.
- Future OXC reintroduction should be evaluated against a stable MCP contract,
  not mixed into the contract migration itself.

## Consequences

- Parser speed may regress for some JavaScript and TypeScript indexing paths.
- Symbol output may drift and must be reviewed explicitly in parser regression
  tests.
- Parser metadata should report tree-sitter-only behavior for v1.
- OXC parser execution is not an available implementation path for this plan.

## Verification

- `specs/implementation/done/mcp-v1-hard-switch-plan.md` Phase A tracks the cutover.
- Parser regression tests must assert tree-sitter-only metadata and
  deterministic symbols for representative JS/TS/JSX/TSX fixtures.
- Targeted verification remains:
  `pnpm type-lint` and
  `pnpm exec vitest run tests/engine-contract.test.ts tests/engine-behavior.test.ts`.
