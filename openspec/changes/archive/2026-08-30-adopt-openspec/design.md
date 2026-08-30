## Context

The retired system uses `specs/implementation/{active,planned,closed}`, several
indexes, `pointer.md`, and overlapping repo-owned planning skills. OpenSpec
already provides proposals, delta specs, designs, task progress, and archives.

## Decisions

- Keep `openspec/specs/` brownfield-first instead of bulk-converting narrative
  API and architecture documents into unverified behavioral requirements.
- Preserve the old tree at `specs-legacy/` as read-only source material.
- Represent in-progress and backlog items as open changes named `active-*` and
  `backlog-*`; preserve their complete plans and checkbox states in `tasks.md`.
- Consolidate closed records into one dated archive change that links every
  preserved record.
- Generate only Codex and Claude Code integrations because those are the tools
  represented by this repository's checked-in instructions.

## Verification

- `openspec list`
- `openspec status --all`
- `openspec validate --all --strict --no-interactive`
- `openspec validate --archived --strict --no-interactive`
- `git diff --check`
