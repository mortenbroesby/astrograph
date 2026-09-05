# Agent Instructions

## OpenSpec Workflow

`BACKLOG.md` is the only live source of priority and execution order. OpenSpec
is the detailed specification and work-tracking system for selected durable
work. Current behavioral truth lives in `openspec/specs/`; proposed and
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

Read `BACKLOG.md` before selecting work, then run `openspec list` for the
detailed state of selected changes. Migrated names beginning with `active-` or
`backlog-` are historical planning context and do not set current priority by
their presence. `specs-legacy/` is read-only source material from the retired
workflow; do not add or update work there.

For general agent tasks, use the repo-local commands in `.agents/commands/` and shared guidance in `.agents/references/`.
For any repository change, follow the always-on Ponytail policy in
`.agents/rules/ponytail.md`; its full skill body lives in `.skills/ponytail/`.

Keep durable policy in `.agents/rules/`.

Before starting or completing work, apply the repository Definitions of Ready
and Done in `.agents/rules/task-lifecycle.md`. Do not call partial, uncommitted,
unpushed, unverified, or unread-back work done.

Keep user-facing setup docs in `README.md`, the docs compendium in `docs/README.md`,
release workflow in `docs/reference/release.md`, and performance workflow in
`docs/guides/performance.md`.

## Worktree Workflow

Perform repository-changing work in an isolated linked Git worktree. Before
editing, reuse the worktree already assigned to the task or load
`.skills/using-git-worktrees/SKILL.md` and create one from the intended base.
Use the repository's ignored `.worktrees/` directory by default.

The primary checkout is for read-only inspection and worktree administration,
not implementation. Exceptions require an explicit reason, such as the user
requesting the current checkout, repairing worktree metadata, or working in a
non-Git location. State the exception before editing. Never move unrelated
dirty changes into a new worktree.

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
