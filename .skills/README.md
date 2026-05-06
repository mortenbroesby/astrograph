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

Current status:

- `.skills/` is the canonical source of truth for checked-in repo-owned skills
- Astrograph-specific skills live here alongside the shared skill surface
- legacy `.agents/skills/` content is retired from the tracked repo layout
- vendored external references should be explicit and rare

## Astrograph-Specific Skills

These repo-local skills are maintained here alongside the shared skill surface:

- `spec-authoring`
- `adr-authoring`
- `implementation-plan-authoring`
- `spec-maintenance`
- `release-decision`
- `grill-me`

## Vendored References

- `excalidraw/`
  Preserved upstream reference material for Excalidraw-oriented agent work.
