# Shared Contract

This repo supports three shared agent surfaces:

- rules
- hooks
- skills

## Rules

Source of truth:

- `.agents/rules/`

Contract:

- rules are cross-agent
- durable repo policy belongs here
- runtime adapters should point back here instead of duplicating policy

Current adapters:

- Codex: `AGENTS.md` plus `.codex/rules/*.rules` for execution policy
- Claude: `.claude/rules` -> `.agents/rules`
- Copilot CLI: `.github/copilot-instructions.md` should stay thin and point back
  to shared repo policy

## Hooks

Source of truth:

- `.agents/hooks/`

Contract:

- hook logic should be cross-agent where possible
- runtime hook registration is adapter-specific
- keep hook scripts deterministic, fast, and side-effect aware
- only rely on the intersection of hook events that the target runtimes can
  support cleanly

Supported cross-agent hook subset:

- `session-start`
  - covers startup, resume, or session-open style events
  - safe shared use: lightweight bootstrap, context reminders, local state
    checks
- `user-prompt-submit`
  - covers the moment just before the runtime submits a user prompt
  - safe shared use: prompt linting, secret scanning, lightweight policy checks

Out of contract for shared-by-default hook behavior:

- pre-tool hooks
- post-tool hooks
- notification hooks
- session-end or stop hooks

Why these are out of contract:

- Claude exposes a richer hook lifecycle than the other runtimes
- Codex currently exposes narrower event names and matcher behavior
- Copilot CLI hook parity is not yet established in this repo
- event timing and payload shape differ enough that shared registration would be
  misleading even when shared script bodies are still useful

Implementation rule:

- if a hook must work across Codex, Claude, and Copilot CLI, design it against
  `session-start` or `user-prompt-submit`
- if a hook depends on tool lifecycle, notifications, or stop events, treat it
  as a runtime-specific adapter extension even when it calls a shared
  `.agents/hooks/*.mjs` script

Current adapters:

- Codex: `.codex/hooks.json` invokes shared `.agents/hooks/*.mjs`
- Claude: `.claude/settings.json` invokes shared `.agents/hooks/*.mjs`
- Copilot CLI: supported via `.github/hooks/*.json`, but not yet wired in this
  repo

Implication:

- shared hook implementation is realistic
- shared hook configuration is not
- each runtime needs its own hook adapter file

## Skills

Source of truth:

- `.skills/`

Contract:

- skills are cross-agent content
- skills load on demand
- skills are not startup bootstrap
- do not mirror or symlink repo-owned skills into runtime-specific directories

Current access path:

- `pnpm skills:list`
- `pnpm skills:search <query>`
- `pnpm skills:read <skill-name>`

Implication:

- shared skill bodies are realistic
- runtime-native skill installation is not the source of truth
- runtime-specific tool mapping should live in companion references, not in the
  shared skill body
