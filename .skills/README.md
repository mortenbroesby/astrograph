# Repo-Owned Skills

This directory is the canonical home for repo-owned first-party skills.

Architecture intent:

- keep full skill content out of startup-loaded adapter surfaces
- keep `AGENTS.md` and `CLAUDE.md` thin
- make skill discovery command-first and on-demand

Target command surface:

- `pnpm skills:list`
- `pnpm skills:search`
- `pnpm skills:read <skill-name>`

Current migration status:

- `STORY-1` defines the architecture and boundaries
- `STORY-2` moved the checked-in repo-owned skill tree here and updated the
  canonical scripts and checks to treat `.skills/` as the source of truth
- legacy runtime skill adapters and the old `.agents/skills/` tree are removed
- external downloaded skills stay out of this checked-in directory
