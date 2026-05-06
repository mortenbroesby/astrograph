---
name: adr-authoring
description: Use when recording or changing an Astrograph architectural decision, tradeoff, accepted design rule, rejected alternative, or compatibility policy
---

# ADR Authoring

## Overview

ADRs are append-only records of decisions that shape Astrograph architecture or
public contracts.

## When To Write An ADR

Write an ADR for changes that affect:

- storage format, migrations, or `.astrograph/` runtime state
- MCP, CLI, or TypeScript API compatibility
- parser, index, ranking, or retrieval architecture
- privacy, event retention, or security posture
- major dependency choices
- rejected alternatives that future agents are likely to revisit

## Process

1. Use `specs/templates/adr.md`.
2. Append the ADR to `specs/architecture/adrs.md`.
3. Use the next `ADR-NNN` number.
4. Set status to `Proposed`, `Accepted`, `Superseded`, or `Rejected`.
5. Include context, decision, rationale, consequences, and verification.
6. Link implementation plans or API specs affected by the decision.

## Rules

- Do not delete old ADRs.
- Supersede with a new ADR and cross-link both entries.
- Keep rationale concrete and source-backed.
- Include rejected alternatives when they explain future constraints.
