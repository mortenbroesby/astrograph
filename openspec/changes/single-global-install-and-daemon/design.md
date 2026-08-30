## Context

Global Codex and Copilot CLI registrations currently use an exact-version `npx --package astrograph@<version>` invocation. Those copies share `~/.astrograph/runtime/daemon.json`, while `ensureLocalDaemon` rejects a live daemon whose package version differs even when its protocol is compatible. Latest `origin/main` already delivers hydration-first indexing, so this change must repair runtime convergence without duplicating that work.

## Goals / Non-Goals

**Goals:**

- Make Astrograph-owned global registrations resolve to one installed package/runtime.
- Preserve one private daemon and make protocol version the compatibility boundary.
- Make non-dry-run global lifecycle commands synchronize an older live daemon before success.
- Keep configuration writes reversible and preserve unmanaged state.

**Non-Goals:**

- Removing packages installed by other Node versions or package managers.
- Changing repository-local registration, storage identity, MCP envelopes, or the five-minute idle policy.
- Adding a service manager, background updater, public port, or dependency.

## Decisions

### Use an absolute installed-package invocation for global registrations

Add a global-only managed invocation that launches the current package's built MCP entrypoint with the current Node executable. Keep the existing exact-version `npx` invocation for repository-local setup. Global install and lifecycle paths update the selected client plus any other existing Astrograph-owned global client entry using the existing marker/JSON ownership and rollback helpers.

This is preferred over `command = "astrograph"`, which is PATH- and Node-manager-dependent, and over a stable custom launcher, which would create another installed artifact to own and update.

### Treat package version as diagnostics and protocol version as compatibility

`src/daemon-client.ts` reuses a ready daemon when `protocolVersion` matches, even if `version` differs. `src/daemon-runtime.ts` continues recording the owning package version for diagnostics. Unsupported protocol versions remain fatal and never trigger replacement.

This is preferred over version-scoped sockets because version-scoped sockets allow multiple daemons and duplicate repository ownership.

### Synchronize daemon ownership only in explicit global lifecycle commands

Add an authenticated internal shutdown control handled in `src/daemon-server.ts` before public command dispatch. A non-dry-run global install/update/repair/reconfigure reads the private runtime record, requests shutdown with its capability token, waits for record removal, writes/verifies managed configuration, and starts/verifies the current package daemon. If a pre-change protocol-compatible daemon rejects the control request, a matching authenticated response permits a targeted signal to the recorded PID, followed by the same bounded wait. Failure rolls configuration back and reports source-free guidance.

Normal MCP startup never replaces a live daemon. This avoids surprise interruption during ordinary tool use while making explicit lifecycle operations the clean synchronization boundary.

### Reuse the landed hydration contract

No new indexing state machine is added. Verification exercises `index_folder` after lifecycle synchronization and keeps the existing status, hydrate, wait, retry, then fatal-fallback policy.

## Risks / Trade-offs

- **Absolute Node paths can become invalid after a Node manager removes a runtime** → global repair from the remaining Astrograph installation rewrites all owned global registrations, and diagnostics reports the broken invocation.
- **Retiring a daemon interrupts in-flight requests** → synchronize only during explicit lifecycle commands, reject shutdown until active dispatches finish, and bound the wait before making configuration changes.
- **A pre-change daemon lacks shutdown control** → require an authenticated response before the one-time targeted signal fallback; never signal an unauthenticated or protocol-incompatible process.
- **Unmanaged duplicate installations can still exist** → report them when detectable, but never delete package-manager-owned state automatically.

## Migration Plan

1. Release the runtime and installer changes together.
2. The next global install/update/repair/reconfigure rewrites every Astrograph-owned global client registration and synchronizes the daemon.
3. Roll back by reinstalling the previous package and rerunning global repair; existing managed-config backups remain available.

## Verification

- `pnpm exec vitest run tests/daemon-runtime.test.ts tests/daemon-process.test.ts tests/engine-contract.test.ts`
- `pnpm type-lint`
- `pnpm check:version-bump`
- `pnpm build`
- `pnpm test:package-bin`
- `git diff --check`
