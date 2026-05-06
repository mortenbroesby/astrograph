# Ralph Runner

This repo keeps its planning-oriented Ralph surface in `.agents/`, and also
ships an opt-in autonomous runner under `scripts/ralph/`.

This page is about that runner.

## What It Is

The runner manages:

- a run directory with `prd.json`
- append-only progress notes in `progress.txt`
- a `last-run.json` pointer to the latest loop iteration
- prompt generation for the next pending story
- optional execution through a supported agent CLI

It does not replace the existing Ralph planning flow.

## Why It Exists

The upstream `snarktank/ralph` repo is a loop engine, not just a planning
prompt. Astrograph keeps that capability separate and opt-in so it can fit the
repo's current safety defaults.

That means:

- no automatic branch switching
- no automatic commits unless explicitly enabled
- no plugin scaffolding requirement
- no default `AGENTS.md` growth

## Initialize a Run

```bash
pnpm ralph:init -- --title "My feature" --name my-feature --branch main
```

This creates `.ralph/my-feature/` with:

- `prd.json`
- `progress.txt`
- `README.md`
- `last-run.json` after the first loop run

Stories can use either the older `passes` boolean or an explicit `status`.
Supported statuses are `pending`, `in_progress`, `blocked`, and `done`.

Selection prefers:

1. `in_progress` stories first
2. then pending stories by priority
3. then blocked stories only when nothing else remains

## Inspect or Dry-Run

List the current story queue:

```bash
pnpm ralph:loop -- --dir .ralph/my-feature --list
```

Dry-run the next generated prompt:

```bash
pnpm ralph:loop -- --dir .ralph/my-feature --dry-run
```

Target a specific story:

```bash
pnpm ralph:loop -- --dir .ralph/my-feature --story STORY-2 --dry-run
```

## Execute With an Agent

Codex:

```bash
pnpm ralph:loop -- --dir .ralph/my-feature --agent codex
```

Claude:

```bash
pnpm ralph:loop -- --dir .ralph/my-feature --agent claude
```

Custom command:

```bash
pnpm ralph:loop -- --dir .ralph/my-feature --agent-command "my-agent-cli --stdin"
```

Optional flags:

- `--model <name>`
- `--sandbox workspace-write`
- `--auto-commit`
- `--enforce-branch`
- `--story <id>`
- `--list`

## PRD Shape

Example `prd.json`:

```json
{
  "title": "My feature",
  "branchName": "main",
  "checks": ["pnpm agents:check", "pnpm lint:md"],
  "stories": [
    {
      "id": "STORY-1",
      "title": "Implement the first vertical slice",
      "priority": "high",
      "status": "pending",
      "notes": "Keep the scope narrow and verifiable."
    }
  ]
}
```

Supported priorities are `critical`, `high`, `medium`, and `low`. Numeric
priorities also work, with lower numbers selected first.

## Why This Version Is Separate

This runner is intentionally repo-native:

- planning still lives in `.agents/`
- execution is a separate script rather than a replacement for the planning skill
- safe defaults are stricter than upstream
- the repo's docs, rules, hooks, and memory model remain the source of truth
