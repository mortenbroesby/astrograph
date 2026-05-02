# Claude

## Entry Points

- `CLAUDE.md`
- `.claude/settings.json`
- `.claude/*`

## Repo Contract

- `CLAUDE.md` stays thin and points back to `AGENTS.md`
- shared rules, commands, and hooks should come from `.agents/`
- repo-owned skills live in `.skills/`, not `.claude/skills`
- runtime-specific settings belong in `.claude/settings.json`

## Current Repo Setup

- `.claude/rules` -> `.agents/rules`
- `.claude/hooks` -> `.agents/hooks`
- `.claude/commands` -> `.agents/commands`
- shared hook scripts are registered through `.claude/settings.json`

## Behavior Notes

- Claude can consume the shared `.claude/*` adapter surface cleanly
- for the shared cross-agent contract, treat only `SessionStart` and
  `UserPromptSubmit` as portable shared events
- keep Claude-only lifecycle hooks such as `PreToolUse`, `PostToolUse`,
  `Notification`, and `SessionEnd` as adapter extensions
- imported upstream skill docs may still mention `~/.claude/skills`
- treat those references as upstream background, not active repo policy
- Claude officially supports project slash commands in `.claude/commands/`
- Claude officially supports hooks from `.claude/settings.json`

## References

- `CLAUDE.md`
- `.claude/settings.json`
- `.agents/rules/agent-infrastructure.md`

## Sources

- Claude Code hooks:
  https://docs.anthropic.com/en/docs/claude-code/hooks
- Claude Code slash commands:
  https://docs.anthropic.com/en/docs/claude-code/slash-commands
- Claude Code memory:
  https://docs.anthropic.com/en/docs/claude-code/memory
