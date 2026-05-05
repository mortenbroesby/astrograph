---
alwaysApply: true
---

# Repo Workflow

## Core Policy

- Use `pnpm` only.
- Keep changes scoped to the workspace that owns the behavior.
- Do not edit generated output: `dist/`, `.next/`, `.turbo/`, `coverage/`.
- Unless the task is explicitly about planning, do not modify
  `docs/superpowers/`.
- Update the relevant README, rule, hook doc, vault note, or AGENTS file when a
  change alters behavior, architecture, workflow, or setup expectations.
- Larger staged code/config changes must include a vault note under
  `vault/02 Repositories/`; `pnpm knowledge:check` enforces this before commit.

## Code Navigation

- Use Astrograph as the default code retrieval path.
- Start with explicit MCP retrieval tools: `search_symbols`, then `get_file_outline`,
  `get_file_tree`, and `get_repo_outline`.
- Prefer Astrograph retrieval surfaces above broad file reads or
  shell-based code scans.
- Use `get_file_outline` to inspect a file cheaply before opening it.
- Read files directly only when you need the exact file content for an edit or
  when a non-code support file is not represented in the index.
- Avoid broad shell-based code scans when indexed retrieval can answer the
  question more precisely.

## Memory

- The repo-local Obsidian vault lives in `vault/`.
- Treat the vault plus `obsidian-memory` as the only durable repo memory.
- Before answering architecture, historical, or decision questions, query
  `obsidian-memory` when available.
- When `pnpm knowledge:check` or a related warning requires a memory note, use
  the state machine in `.agents/rules/memory-note-routing.md` to choose
  between a task, decision, architecture, or session note.
- After editing vault notes, run `pnpm rag:index` when fresh memory is needed
  before commit.

## Verification

- Prefer the narrowest relevant script for the workspace changed.
- Treat `build` and `type-check` as the default baseline for app and feature
  workspaces.
- Add `lint` when a workspace has local ESLint wiring.
- Add `test` when a workspace owns behavior worth verifying in isolation.
- Config-only packages may omit runtime scripts when they only publish shared
  presets.
- For one-workspace code changes, run that workspace's lint, type-check, or
  tests as appropriate.
- For shared contracts, shared tooling, or cross-workspace behavior, broaden to
  affected package checks or `pnpm turbo type-check`.
- For docs-only changes, run `pnpm lint:md` when verification is useful.
- For user-facing behavior, run relevant tests and do a quick manual check when
  practical.

## Final Stage

- Once the task reaches the final stage, do not end on soft optional phrasing
  such as "if you want, I can...".
- Default to ending implementation work by committing and pushing the result.
- If the user and agent explicitly agreed on a feature branch, push that
  branch.
- Otherwise commit on the current branch and push `main`.
- Prefer taking the next concrete action immediately when it is already within
  scope and permissions.
- When confirmation is still needed, present one recommended concrete action as
  a textual default where `y` or `Enter` means proceed.
- Frame the next step around one recommended concrete action and one clear
  escape hatch where `n` means stop or keep the safer local state.
