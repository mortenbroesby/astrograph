## Why

Every npm install warns because Astrograph's native SQLite dependency still
uses the unmaintained `prebuild-install@7.1.3`. The maintained N-API release of
`better-sqlite3` removes that installer and requires Node 22; Node 20 is already
end-of-life and the user approved ending support for it.

## What Changes

- **BREAKING**: require Node.js 22.12 or newer for Astrograph consumers and the
  managed global installer.
- Upgrade `better-sqlite3` to its maintained N-API release so npm no longer
  installs or warns about `prebuild-install`.
- Build Astrograph for Node 22 and keep packed-package verification on supported
  Node 22 and Node 24 runtimes.
- Update current compatibility documentation and mark the historical Node
  20-24 review as superseded without rewriting its evidence.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `device-runtime`: The device-owned runtime and installer require a maintained
  Node.js 22.12-or-newer environment and a warning-free native SQLite install.

## Impact

- Affects `package.json`, `pnpm-lock.yaml`, the build target, installer runtime
  validation, compatibility workflow, focused contracts, and current docs.
- Node 20 users must upgrade Node before installing the next Astrograph release.
- No database schema, MCP contract, cache layout, or daemon protocol changes.
- No dependency override, warning suppression, alternate SQLite layer, or
  compatibility shim will be added.
