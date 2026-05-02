# Ralph Runner Instructions

You are running one opt-in Ralph iteration for `playground`.

## Run Context

- Ralph run directory: `{{RUN_DIR}}`
- PRD title: `{{PRD_TITLE}}`
- PRD branch: `{{BRANCH_NAME}}`
- Current git branch: `{{CURRENT_BRANCH}}`
- Active story: `{{STORY_ID}} - {{STORY_TITLE}}`
- Active story status: `{{STORY_STATUS}}`

## Files To Read First

1. `AGENTS.md`
2. Relevant `.agents/rules/` files
3. `{{RUN_DIR}}/prd.json`
4. `{{RUN_DIR}}/progress.txt`
5. Any closer `AGENTS.md` files in directories you edit

## Story Notes

{{STORY_NOTES}}

## Story Queue Snapshot

{{STORY_SUMMARY}}

## Recent Progress Tail

```text
{{RECENT_PROGRESS}}
```

## Required Working Style

- Implement only the single active story for this iteration.
- Use repo-native conventions: `pnpm`, workspace-scoped checks first, and
  `jcodemunch` first for code navigation, with Astrograph
  (`@mortenbroesby/astrograph`; compatibility bin `ai-context-engine`) kept
  available as the secondary path until the repo is ready to switch fully.
- Keep the worktree coherent and avoid unrelated cleanup.
- Update `{{RUN_DIR}}/progress.txt` by appending a short iteration log with:
  story completed or blocked
  files changed
  checks run
  reusable learnings or gotchas
- Leave a short next-step note when partial work remains so the next iteration
  can resume without rediscovery.
- Update `{{RUN_DIR}}/prd.json` only if the story is fully complete and the
  listed checks passed.
- Add reusable directory-specific learnings to nearby `AGENTS.md` files only if
  they are truly durable and worth loading in future sessions.

## Checks To Run

{{CHECKS}}

## Commit Policy

{{COMMIT_POLICY}}

## Guardrails

- Do not switch branches automatically.
- Do not bypass approvals or sandboxing.
- Do not mark the story passed if verification is incomplete.
- If blocked, leave a clear blocker note in `progress.txt` instead of guessing.
