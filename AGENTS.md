# Agent Instructions

## Spec Workflow

## Bare Goal Handoff

When the user sends a bare `/goal` message in this repository, read
[`pointer.md`](./pointer.md) before choosing work. It is the tracked source of
truth for the one current goal, its boundary, and its executable checklist.
Do not infer a different goal from older epics or closed records.

Astrograph specs live under `specs/`, using the same broad taxonomy as the
referenced `zyncbase/specs` setup:

- `specs/architecture/` for principles, ADRs, and long-term decisions
- `specs/api-design/` for MCP, CLI, and TypeScript API contracts
- `specs/implementation/` for internal implementation specs and plans
- `specs/templates/` for reusable authoring templates

For general agent tasks, use the repo-local commands in `.agents/commands/` and shared guidance in `.agents/references/`.

Before creating or changing specs, use the repo-local skills in `.skills/`:

- `spec-authoring`
- `adr-authoring`
- `implementation-plan-authoring`
- `spec-maintenance`
- `release-decision`

Keep durable policy in `.agents/rules/`.

Keep user-facing setup docs in `README.md`, the docs compendium in `docs/README.md`,
release workflow in `docs/reference/release.md`, and performance workflow in
`docs/guides/performance.md`.

## Release Workflow

Use `.skills/release-decision/SKILL.md` before deciding whether a change
needs an npm release. The CI manual dispatch exposes `release_mode=plan` for a
dry run and `release_mode=apply` for the guarded main-only flow that commits the
version update and pushes the release tag.

## GitHub Actions Cost Guardrail

Before editing `.github/workflows/**`, read
`.agents/rules/github-actions-cost.md`. Workflow changes must preserve scoped
triggers, dependency caching, PR concurrency cancellation, and the split between
fast required checks and expensive optional checks unless the task explicitly
sets `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true`.

## Code Exploration Policy

Use Astrograph normally from the target harness (such as Codex or Copilot) for code exploration. Prefer its indexed search, file summaries, and repository views before raw file reads or shell search; fall back only when Astrograph cannot answer the question or when debugging Astrograph itself.
