# Spec System

Astrograph specs are organized like the reference `zyncbase/specs` structure:

- `architecture/` for principles, ADRs, and long-lived decisions
- `api-design/` for public contracts
- `implementation/` for internal subsystem plans
- `templates/` for repeatable agent-authored documents

## Agent Workflow

Agents should use the repo-local skills under `.agents/skills/` before creating
or changing specs.

| Task | Skill |
| --- | --- |
| Create or reorganize specs | `spec-authoring` |
| Record an architecture decision | `adr-authoring` |
| Write an implementation plan | `implementation-plan-authoring` |
| Keep indexes and links current | `spec-maintenance` |

## Maintenance Rules

- Every new spec must be linked from the nearest section README.
- Every new public API spec must list verification tests.
- Every implementation plan must include baseline checks, implementation checks, and commit checkpoints.
- ADRs are append-only except for status corrections or typo fixes.
- Superseded decisions are marked with status and replacement links, not deleted.
