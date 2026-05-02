# Agent Rules

Shared instruction rules for agents working in this repository.

- `repo-workflow.md`: always-on repo workflow, navigation, memory, and
  verification policy.
- `skill-routing.md`: always-on guidance for when to load which on-demand
  skills.
- `frontend.md`: path-scoped frontend implementation and design policy.
- `agent-infrastructure.md`: path-scoped policy for hooks, rules, skills, and
  agent configuration.

Shared lifecycle prompts live in `.agents/commands/` and are exposed to Claude
as commands and to Codex as prompts through symlinks. The compact
`engineering-workflow` skill is the umbrella lifecycle. Repo-native lifecycle
skills under `.skills/` adapt the compatible parts of
`addyosmani/agent-skills` without importing Claude-specific plugin state or
runtime-specific scaffolding.

Compact reference checklists live in `.agents/references/` and are meant for
progressive disclosure by skills rather than always-on loading.

Codex execution permissions are not markdown rules. They live in
`.codex/rules/*.rules` and follow OpenAI Codex execpolicy syntax. The
`codex/rules` path is a compatibility symlink for docs and tools that look for
that spelling.
