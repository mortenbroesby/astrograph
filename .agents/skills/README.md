# Astrograph Repo Skills

These skills guide agentic spec work in this repo. They are intentionally
repo-local because Astrograph's spec taxonomy, version policy, and verification
commands are project-specific.

For general agent task prompts, use the repo-local commands in `.agents/commands/`
and shared guidance in `.agents/references/`.

## Skills

- [spec-authoring](./spec-authoring/SKILL.md) - Create or reorganize specs under `specs/`.
- [adr-authoring](./adr-authoring/SKILL.md) - Record architectural decisions.
- [implementation-plan-authoring](./implementation-plan-authoring/SKILL.md) - Write executable implementation plans.
- [spec-maintenance](./spec-maintenance/SKILL.md) - Keep spec indexes, links, and verification pointers current.
- [release-decision](./release-decision/SKILL.md) - Decide when to publish and operate the release agent.

## Rules

- [GitHub Actions Cost Guardrail](../rules/github-actions-cost.md)

## Required Reference

The spec system follows the structure in `specs/README.md`, inspired by the
`zyncbase/specs` taxonomy:

- `architecture/`
- `api-design/`
- `implementation/`
- `templates/`
