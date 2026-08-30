## Context

This change was migrated from Astrograph's retired spec roadmap. Its complete
legacy plan and checkbox state are preserved in `tasks.md`; the linked source
record remains read-only background evidence.

## Approach

Before implementation, reconcile the preserved plan with current code and
write any observable behavior change as an OpenSpec delta. Keep implementation
and verification scoped to this change, and update `tasks.md` as work proceeds.

## Constraints

- Do not update `specs-legacy/`.
- Do not treat a `backlog-*` change as selected without explicit user direction.
- Preserve unrelated working-tree changes and current compatibility policies.

## Verification

Use the focused commands retained in `tasks.md`, plus current repository checks
required by `AGENTS.md` and `openspec validate --strict`.
