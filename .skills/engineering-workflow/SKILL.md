---
name: engineering-workflow
description: Use for build, test, review, simplify, or ship workflows after OpenSpec has defined durable work.
---

# Engineering Workflow

This skill is the umbrella lifecycle for this repo's shared `.agents` setup. It
adapts the core flow from `addyosmani/agent-skills` while keeping runtime
adapters thin and repo-native.

## Lifecycle

- Define and plan durable work with the generated OpenSpec explore/propose/update
  skills. Keep tiny, obvious edits in the conversation.
- Build: implement one slice at a time. Keep the tree working after each slice.
- Test: prove behavior with the narrowest useful verification. For bug fixes,
  reproduce the bug before fixing it when practical.
- Review: check correctness, readability, architecture, security, performance,
  and missing tests before merge.
- Simplify: reduce complexity only after behavior is understood and protected.
- Ship: confirm checks, docs, rollback shape, and any monitoring or deployment
  expectations before pushing live.

## Repo Adaptation

- Follow `AGENTS.md` and `.agents/rules/` first.
- Use `pnpm` commands only.
- Use Astrograph's indexed tools as the default repository retrieval path.
- Keep durable behavioral truth and change artifacts under `openspec/`.
- Keep commands in `.agents/commands/` so Claude slash commands and Codex
  prompts share the same source.

## Command Mapping

- `$openspec-explore`: investigate before committing to a change
- `$openspec-propose`: create the proposal, specs, design, and tasks
- `$openspec-apply-change`: implement the current change
- `$openspec-archive-change`: merge specs and preserve completed history
- `/build` or `build.md`: `incremental-implementation`
- `/test` or `test.md`: `test-driven-development`
- `/review` or `review.md`: `code-review-and-quality`
- `/code-simplify` or `code-simplify.md`: `code-simplification`
- `/ship` or `ship.md`: `shipping-and-launch`

Cross-cutting support skills:

- `context-engineering` for task setup and context hygiene
- `source-driven-development` for external docs and version-sensitive APIs

## Guardrails

- Do not force a full spec for tiny, obvious edits. Scale the workflow to risk.
- Do not skip verification because the diff is small.
- Do not import runtime-specific setup into `.claude/`, `.codex/`, `.github/`,
  or `.opencode/` when a shared `.agents` file can serve all runtimes.
- Do not duplicate long process docs in multiple agent adapters.

## Evidence

Before finishing a workflow-driven change, report:

- what changed
- which checks ran
- what remains unverified, if anything
