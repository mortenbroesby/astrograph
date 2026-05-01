# Agent Instructions

## Spec Workflow

Astrograph specs live under `specs/`, using the same broad taxonomy as the
referenced `zyncbase/specs` setup:

- `specs/architecture/` for principles, ADRs, and long-term decisions
- `specs/api-design/` for MCP, CLI, and TypeScript API contracts
- `specs/implementation/` for internal implementation specs and plans
- `specs/templates/` for reusable authoring templates

Before creating or changing specs, use the repo-local skills in `.agents/skills/`:

- `spec-authoring`
- `adr-authoring`
- `implementation-plan-authoring`
- `spec-maintenance`

Keep user-facing setup docs in `README.md`, release workflow in `docs/release.md`,
and performance workflow in `docs/performance.md`.
