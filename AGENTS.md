# Agent Instructions

## OpenSpec Workflow

OpenSpec is the only live specification and work-tracking system in this
repository. Current behavioral truth lives in `openspec/specs/`; proposed and
in-progress work lives in `openspec/changes/`; completed changes live in
`openspec/changes/archive/`.

Use the generated OpenSpec skills for durable changes:

1. Explore with `$openspec-explore` when the scope needs investigation.
2. Create one change with `$openspec-propose`, or revise an existing change
   with `$openspec-update-change`.
3. Review its proposal, delta specs, design, and tasks before implementation.
4. Implement with `$openspec-apply-change` and keep `tasks.md` current.
5. Sync or archive with `$openspec-sync-specs` and
   `$openspec-archive-change` after verification.

Run `openspec list` to see all open work. Migrated names beginning with
`active-` were in progress; names beginning with `backlog-` were planned,
parked, or deferred. Do not implement a backlog change until the user selects
it. `specs-legacy/` is read-only source material from the retired workflow; do
not add or update work there.

For general agent tasks, use the repo-local commands in `.agents/commands/` and shared guidance in `.agents/references/`.
For any repository change, follow the always-on Ponytail policy in
`.agents/rules/ponytail.md`; its full skill body lives in `.skills/ponytail/`.

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

Use Astrograph normally from the target harness (such as Codex or Copilot) for code exploration. Start with its project status; if the index is missing, stale, or unavailable, hydrate it with `index_folder` and retry the requested Astrograph tool before raw file reads or shell search. Fall back only after hydration and retry fail, or when debugging Astrograph itself, and state why.
