# OpenSpec

This is Astrograph's only live specification and change-tracking system.

OpenSpec uses its upstream-recommended global CLI installation rather than a
repository dependency. Verify it with `openspec --version`; install or update it
with `npm install -g @fission-ai/openspec@latest` when needed.

- `specs/` contains behavior proven by archived changes.
- `changes/active-*` contains work that was already in progress when OpenSpec
  was adopted.
- `changes/backlog-*` contains planned, parked, or deferred work. It requires
  explicit selection before implementation.
- `changes/archive/` contains completed change history.
- [`../specs-legacy/`](../specs-legacy/README.md) contains read-only source
  material from the retired workflow.

Use `openspec list`, `openspec status --all`, and `openspec validate --all
--strict --no-interactive` to inspect the repository state.
