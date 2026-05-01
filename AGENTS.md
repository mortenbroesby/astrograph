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
- `release-decision`

Keep user-facing setup docs in `README.md`, release workflow in `docs/release.md`,
and performance workflow in `docs/performance.md`.

## Release Workflow

Use `.agents/skills/release-decision/SKILL.md` before deciding whether a change
needs an npm release. The CI manual dispatch exposes `release_mode=plan` for a
dry run and `release_mode=apply` for the guarded main-only flow that commits the
version update and pushes the release tag.

## GitHub Actions Cost Guardrail

Before editing `.github/workflows/**`, read
`.agents/rules/github-actions-cost.md`. Workflow changes must preserve scoped
triggers, dependency caching, PR concurrency cancellation, and the split between
fast required checks and expensive optional checks unless the task explicitly
sets `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true`.
