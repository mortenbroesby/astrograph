## Context

This change was migrated from Astrograph's retired spec roadmap. Its complete
legacy plan and checkbox state are preserved in `tasks.md`; the linked source
record remains read-only background evidence.

## Approach

Before implementation, reconcile the preserved plan with current code and
write any observable behavior change as an OpenSpec delta. Keep implementation
and verification scoped to this change, and update `tasks.md` as work proceeds.

When the private state record proves a reachable daemon speaks the internal
protocol but its package version differs, the newer client requests its
authenticated graceful shutdown, waits for that daemon to release its state,
and only then starts the replacement. The daemon stops accepting new work and
closes only after existing connections complete. An unresponsive or
unauthenticated daemon remains fail-safe: no PID is signalled from a record.
The explicit Astrograph install lifecycle invokes that reconciliation before it
writes any client configuration; npm package lifecycle hooks remain passive.

## Constraints

- Do not update `specs-legacy/`.
- Do not treat a `backlog-*` change as selected without explicit user direction.
- Preserve unrelated working-tree changes and current compatibility policies.
- Do not expose shutdown as a public MCP tool, network listener, or user-facing command.

## Verification

Use the focused commands retained in `tasks.md`, plus current repository checks
required by `AGENTS.md` and `openspec validate --strict`.
