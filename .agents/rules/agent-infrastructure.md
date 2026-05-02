---
paths:
  - ".agents/**"
  - ".claude/**"
  - ".codex/**"
  - ".opencode/**"
  - "AGENTS.md"
---

# Agent Infrastructure

- Keep `AGENTS.md` thin. Durable policy belongs in `.agents/rules/`, executable
  policy in `.agents/hooks/`, and command escalation policy in `.codex/rules/`.
- Keep durable memory in `vault/` plus `obsidian-memory`.
- Treat `AGENTS.md` as a bootstrap, not a catalog:
  keep it to a few short sections, prefer pointers over inventories, and avoid
  repeating details that already live under `.agents/`.
- Do not add long workflow explanations, change logs, skill inventories, or
  adapter implementation details to `AGENTS.md`.
- When `AGENTS.md` grows, compress it by replacing lists of subdirectories with
  one pointer to the owning docs surface.
- Keep `codex/rules` as a compatibility symlink to `.codex/rules`.
- Keep shared commands, hooks, skills, and instruction rules under `.agents/`.
- Keep compact shared checklists under `.agents/references/` when a skill needs
  small supporting reference material.
- Keep runtime support notes in
  `.agents/references/agent-runtimes/` rather than expanding `AGENTS.md`,
  `CLAUDE.md`, or Copilot instructions into long runtime catalogs.
- Treat `.agents/references/agent-runtimes/shared-contract.md` as the contract
  for what should stay shared across runtimes: rules shared by default, hooks
  shared at the implementation layer with adapter-specific registration, and
  skills shared as on-demand `.skills/` content.
- Runtime-specific directories should stay thin:
  `.claude/*`, `.codex/*`, and `.opencode/*`.
- Put reusable lifecycle prompts in `.agents/commands/`. Repo-owned skills live
  in `.skills/`; do not mirror or symlink them into runtime-specific skill
  directories.
- Hook and Claude settings edits are protected by default. When an
  infrastructure refactor genuinely needs them, add the exact repo-relative
  path to `.agents/settings.cjs` under `infrastructureEditAllowlist`, make the
  edit, then remove the allowlist entry once the refactor is complete.
- Hook scripts should be focused, deterministic, fast, and single-purpose.
- Validate hook stdin as untrusted input; resolve paths against the project root;
  redact secrets before logging.
- Do not add network or long-running work to hooks unless the hook is explicitly
  designed as optional post-action automation.
- Keep hook architecture notes in
  `vault/02 Repositories/playground/01 Architecture/Agent Hooks.md`.
- Run `pnpm agents:check` after changing agent adapters, hooks, rules, or
  `.skills/`.
