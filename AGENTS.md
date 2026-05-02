# Agent Instructions

## Spec Workflow

Astrograph specs live under `specs/`, using the same broad taxonomy as the
referenced `zyncbase/specs` setup:

- `specs/architecture/` for principles, ADRs, and long-term decisions
- `specs/api-design/` for MCP, CLI, and TypeScript API contracts
- `specs/implementation/` for internal implementation specs and plans
- `specs/templates/` for reusable authoring templates

For general agent tasks, use the repo-local commands in `.agents/commands/` and shared guidance in `.agents/references/`.

Before creating or changing specs, use the repo-local skills in `.agents/skills/`:

- `spec-authoring`
- `adr-authoring`
- `implementation-plan-authoring`
- `spec-maintenance`
- `release-decision`

Keep durable policy in `.agents/rules/`.

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

<!-- BEGIN ASTROGRAPH CODE EXPLORATION POLICY -->
## Code Exploration Policy

Prefer Astrograph MCP tools for code exploration before falling back to raw file reads or shell search.

- Start with `get_project_status` for the current repository; if the index is missing or stale, run `index_folder`.
- Before reading a file, use `get_file_outline`, `get_file_summary`, or `query_code` with source intent.
- Before searching broadly, use `query_code`, `find_files`, or `search_text`.
- Before exploring structure, use `get_file_tree` or `get_repo_outline`.
- Use raw file reads or shell search only when Astrograph cannot answer the question or when debugging Astrograph itself.
<!-- END ASTROGRAPH CODE EXPLORATION POLICY -->
