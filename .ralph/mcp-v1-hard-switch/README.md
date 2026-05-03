# Ralph Run: MCP v1 hard-switch

Files in this directory:

- `prd.json`: task state and story checklist
- `progress.txt`: append-only learnings and iteration log
- `last-run.json`: metadata for the most recently generated iteration
- generated prompt/output files from `pnpm ralph:loop`

Suggested next steps:

1. Edit `prd.json` with concrete stories.
2. Run `pnpm ralph:loop -- --dir .ralph/mcp-v1-hard-switch --list` to inspect story state.
3. Run `pnpm ralph:loop -- --dir .ralph/mcp-v1-hard-switch --dry-run` to inspect the next prompt.
4. Run `pnpm ralph:loop -- --dir .ralph/mcp-v1-hard-switch --agent codex` when the PRD is ready.
