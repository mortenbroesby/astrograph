# Codex

## Entry Points

- `AGENTS.md`
- `.codex/config.toml`
- `.codex/hooks.json`
- `.codex/rules/*.rules`

## Repo Contract

- use `AGENTS.md` as the shared bootstrap
- load shared repo policy from `.agents/rules/`
- run shared hook logic from `.agents/hooks/` through `.codex/hooks.json`
- keep Codex-specific execution policy in `.codex/rules/`
- use repo-owned skills from `.skills/` through `pnpm skills:read`
- do not depend on runtime-local mirrored skill directories

## Current Repo Setup

- `multi_agent = true`
- `codex_hooks = true`
- MCP servers configured here:
  - `astrograph`
  - `obsidian-memory`
- hook adapter currently registered for:
  - `SessionStart`
  - `UserPromptSubmit`
  - `PreToolUse` for `Bash`
  - `PostToolUse` for `Bash`
  - `Stop`

## Behavior Notes

- prefer `astrograph` as the default code navigation path in this repo
- startup context should stay thin; full skill bodies load on demand
- for the shared cross-agent contract, treat only `SessionStart` and
  `UserPromptSubmit` as portable shared events
- treat `PreToolUse`, `PostToolUse`, and `Stop` as Codex adapter extensions
  even when they invoke shared `.agents/hooks/*.mjs` scripts
- some Git and `gh stack` operations may need permission because they write
  under `.git/`
- the official Codex guidance explicitly supports repository `AGENTS.md` files
  with hierarchical scope and precedence

## References

- `AGENTS.md`
- `.codex/config.toml`
- `.codex/hooks.json`
- `.skills/using-superpowers/references/codex-tools.md`

## Sources

- OpenAI on Codex and `AGENTS.md`:
  https://openai.com/index/introducing-codex/
- OpenAI Codex CLI getting started:
  https://help.openai.com/en/articles/11096431-openai-codex-ci-getting-started
- OpenAI Codex repo `AGENTS.md` note:
  https://github.com/openai/codex/blob/main/docs/agents_md.md
