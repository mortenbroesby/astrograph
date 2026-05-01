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
