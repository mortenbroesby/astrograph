# System Architecture

This directory contains Astrograph's core design principles, architectural
decision records, and long-term subsystem boundaries.

## [Core Principles](./core-principles.md)

The rules that guide technical tradeoffs. These should change rarely and only
through an ADR.

## [Architecture Decision Records](./adrs.md)

Chronological log of accepted architectural choices. Use ADRs for decisions that
change persistence, public contracts, runtime dependencies, security posture, or
agent workflow.

## Architectural Deep Dives

Planned deep dives:

- Storage and metadata lifecycle
- Indexing and refresh pipeline
- Retrieval, ranking, and context assembly
- MCP and CLI runtime boundaries
- Privacy, events, and local diagnostics

- [Compact Output and Storage v2](./compact-output-v2-storage-v2.md) - Breaking
  compact-format and cache-recovery design.

## See Also

- [API Design](../api-design/README.md)
- [Implementation](../implementation/README.md)
- [Templates](../templates/README.md)
