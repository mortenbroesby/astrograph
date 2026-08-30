---
name: spec-authoring
description: Use when creating, moving, or reorganizing Astrograph specs, architecture docs, API contract docs, implementation docs, or documentation indexes under specs/
---

# Spec Authoring

## Overview

Astrograph specs live under `specs/` and follow a four-part taxonomy:

- `architecture/` for principles, ADRs, and long-lived design decisions
- `api-design/` for public MCP, CLI, and TypeScript contracts
- `implementation/` for internal subsystem plans and technical specs
- `templates/` for reusable starting points

## Process

1. Identify the document type before writing.
2. Start from the matching template in `specs/templates/`.
3. Put the file in the correct section.
4. Link the file from the nearest section `README.md`.
5. Link the file from `specs/README.md` when it is a top-level entry point.
6. Add verification pointers for every public API or implementation claim.

## Placement Rules

| Content | Location |
| --- | --- |
| Design principles | `specs/architecture/` |
| Architecture decisions | `specs/architecture/adrs.md` |
| MCP, CLI, library contracts | `specs/api-design/` |
| Refactor plans and internals | `specs/implementation/` |
| Reusable doc skeletons | `specs/templates/` |

## Common Mistakes

- Do not put implementation plans in `docs/`; use `specs/implementation/`.
- Do not create unlinked specs.
- Do not mix public API contracts with internal implementation plans.
- Do not copy external project content; adapt the structure to Astrograph.
