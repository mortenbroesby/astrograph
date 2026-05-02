# Copilot CLI

## Entry Points

- `.github/copilot-instructions.md`
- `.github/hooks/*.json`
- `AGENTS.md`

## Repo Contract

- keep Copilot instructions thin and repo-specific
- shared workflow policy should come from `AGENTS.md` and `.agents/rules/`
- repo-owned skills still live in `.skills/`
- avoid duplicating large shared workflow text in Copilot-specific files
- if hooks are added, they should call shared `.agents/hooks/*.mjs` rather than
  fork the logic

## Current Repo Setup

- instructions are currently monorepo-focused
- current emphasis:
  - `pnpm`
  - Turborepo tasks
  - small package-scoped changes
  - strict TypeScript defaults
- the runtime supports repository hooks under `.github/hooks/*.json`
- the runtime supports repository instructions through
  `.github/copilot-instructions.md`

## Hook Contract Notes

- until a repo adapter is added, assume only startup or session-open style
  hooks plus user-prompt submission hooks are safe candidates for the shared
  cross-agent subset
- do not assume Copilot CLI should share tool-lifecycle, notification, or stop
  hooks with Claude or Codex until the adapter timing and payload contract is
  written down

## Open Questions

- there is no first-class native skills surface comparable to Claude or Codex,
  so this repo should treat `.skills/` as a shared repo resource exposed
  through commands, not as a Copilot-native plugin directory
- it is still worth learning whether Copilot benefits from a dedicated shared
  skill-routing pointer beyond `.github/copilot-instructions.md`
- if we add Copilot hooks, keep the first adapter scoped to the shared subset
  before layering runtime-specific extensions

## References

- `.github/copilot-instructions.md`
- `AGENTS.md`
- `.agents/rules/skill-routing.md`

## Sources

- Copilot CLI custom instructions:
  https://docs.github.com/en/copilot/how-tos/copilot-cli/add-custom-instructions
- Copilot CLI hooks:
  https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
- Copilot hooks overview:
  https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks
