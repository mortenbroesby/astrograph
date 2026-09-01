## Context

Global cache and runtime defaults already resolve below the user's Astrograph
home. The global installer, however, writes a package-pinned `npx` invocation
for both clients, while this Mac's Codex registration uses the installed
`astrograph` command. Those launch paths can resolve different package copies
and therefore reject each other's daemon by version.

## Goals / Non-Goals

**Goals:**

- Make one globally installed executable the registration target for Codex and
  Copilot CLI.
- Preserve the existing global cache layout and daemon compatibility check.
- Prove both setup paths converge through focused installer and daemon tests.

**Non-Goals:**

- Share an MCP stdio process between clients.
- Add a network service, a new dependency, or a background updater.
- Kill live client bridges during installation.

## Decisions

- Register `astrograph mcp` for global clients. It matches the existing Codex
  device setup and lets the user's package manager own upgrades. `npx` is
  rejected because it can create a second package copy even at the same
  nominal version.
- Bootstrap the current package with the active Node runtime when global setup
  needs a device command, then verify it before changing registrations. This
  avoids mistaking the temporary `npx` binary for a persistent installation;
  transactional config writes remain the failure boundary.
- Keep the existing global config and runtime resolution. They already provide
  one cache root and daemon state file per user; adding another path would
  recreate the split this change removes.

## Risks / Trade-offs

- [Device installation or PATH refresh fails] → fail before writes with the
  exact package-manager recovery command and PATH guidance.
- [A live older daemon exists during an upgrade] → retain the existing
  compatibility failure and stale-record recovery; do not kill a live process.
- [Separate stdio bridges look like duplicated runtimes] → document that only
  bridge processes are per client; cache and daemon are shared.

## Migration Plan

1. Bootstrap and verify the device command, then update global setup generation
   and prerequisite checks.
2. Re-run global setup to replace only Astrograph-managed registrations.
3. Existing global cache entries remain in place; compatible daemon state is
   reused, and stale state follows the existing bounded recovery path.
4. Roll back by restoring the managed registration backup created by setup.
