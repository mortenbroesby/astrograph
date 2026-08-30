## Why

Astrograph's managed clients currently launch separate exact-version `npx` package copies while all copies share one user-local daemon record. After an upgrade, whichever copy owns that record can make every other copy fail with an incompatible-version error, preventing normal indexing and retrieval.

## What Changes

- Make global client registration launch the one Astrograph installation that performed setup instead of creating additional `npx` package copies.
- Treat the daemon protocol version, rather than an identical npm package version, as the compatibility boundary so compatible clients share one daemon across upgrades.
- Make global install, update, repair, and reconfigure converge managed client registrations on the same runtime invocation and report conflicting unmanaged registrations without deleting them.
- Preserve the existing hydration-first indexing behavior from `origin/main`; verify that a compatible older daemon cannot block hydration after a package upgrade.
- Keep repository-local setup and fatal-error fallback unchanged.

## Capabilities

### New Capabilities

- `global-runtime-management`: Defines one managed global Astrograph runtime invocation, compatible singleton-daemon reuse across package upgrades, and non-destructive conflict diagnostics.

### Modified Capabilities

None.

## Impact

This affects global Codex and Copilot CLI registration, installer lifecycle commands and diagnostics, daemon-client compatibility checks, focused daemon/installer tests, and global setup documentation. It adds no dependency and does not remove user-owned package installations or unmanaged client configuration.
