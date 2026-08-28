# Pre-v1 Clean Install Contract Epic

**Goal:** Until an explicit post-1.0 policy replaces it, Astrograph upgrades
must use a confirmed clean reset instead of migrations or backward-compatible
setup paths: replace current Astrograph configuration, discard Astrograph-owned
index/cache/database state, and rebuild from the current package.

**Architecture:** Keep one current configuration and one current storage
format. The installer, CLI/MCP entry point, and daemon validate the local
registration and Astrograph-owned state against the running package. A detected
version mismatch or invalid Astrograph configuration explains *why* reset is
needed and, in a TTY, asks once before resetting. Reset replaces only marked
Astrograph blocks or named Astrograph JSON entries, preserving unrelated client
settings. The sole whole-file exception is a malformed client config: save a
timestamped backup, explain the invalidity with a documentation link, then
replace it with fresh Astrograph-only configuration after confirmation.

**Tech Stack:** TypeScript, Node 20.19+ or 22.12+, Commander, Clack prompts,
native Node filesystem/process APIs, pnpm, and Vitest. No migration layer,
compatibility aliases, background update check, telemetry, or startup network
request.

**Relationship to existing work:** This is the selected cleanup successor to
the [Interactive Install Lifecycle Epic](../closed/interactive-install-lifecycle-epic.md).
It retains its managed-write backups, rollback checks, and granular ownership;
it removes the remaining legacy-registration migration option rather than
extending it. The completed [pre-v1 cache cleanup](../closed/pre-v1-cache-codebase-cleanup-delivery-checklist.md)
is evidence for safely discarding obsolete Astrograph-owned data, not a
compatibility mechanism to revive.

## Product contract

### Pre-1.0 compatibility boundary

- Astrograph supports the current installation format only. It does not read,
  transform, preserve, or emulate obsolete Astrograph configuration, cache,
  database, daemon, or registration formats.
- A version mismatch means the selected configuration, Astrograph state, or
  running entry point does not describe the current installation generation.
  Detection is local; normal CLI, MCP, and daemon startup never contacts npm to
  discover a newer release.
- Every detected mismatch requires explicit confirmation in an interactive
  terminal. Confirmation backs up changed configuration, replaces the current
  Astrograph registration, removes Astrograph-owned state, and rebuilds it.
- Non-interactive mode fails without changes on a mismatch. It explains why and
  prints the explicit `--reset` recovery command; only `--yes --reset` may
  perform that reset.

### Ownership and recovery

- Valid client files are edited only at Astrograph's marked TOML block or
  named JSON server entry. Every unrelated entry remains byte-for-byte intact
  where the existing writer can preserve it.
- Invalid managed content emits a warning, a short reason, and a link to the
  repository troubleshooting documentation. When the containing file remains
  parseable, reset regenerates only Astrograph's entry.
- A wholly malformed Codex/Copilot client file cannot be safely edited
  granularly. After confirmation, create a timestamped backup and replace that
  file with a fresh Astrograph-only client config. Report the backup path and
  the exact replacement action.
- Reset discards only Astrograph-owned index, cache, database, daemon runtime,
  and installation state. It never deletes repositories, client executables,
  npm global packages, unrelated configuration, or user source.
- Failed writes or validation restore configuration backups. A failed reset
  reports the preserved backup and safe next step; it never claims success.

### Visible installer progress

- Interactive normal output uses stable phase headers, for example `Step 2 of
  4 — Updating Astrograph configuration`, followed by a concise result. A
  spinner may decorate active work, but it is never the only signal of progress.
- The phases cover validation, confirmation, configuration replacement,
  state reset/rebuild, and completion. Long bounded work names the active
  operation and its timeout/recovery outcome.
- `--verbose` adds the exact safe command/process detail and child output.
  Normal output remains concise and never exposes config contents or secrets.

## Task 1: Inventory and delete obsolete setup compatibility

**Files:**
- Modify: `src/scripts/install.ts`
- Modify: `src/config.ts`, `src/storage.ts`, and daemon/MCP startup seams as
  selected by the inventory
- Modify: `tests/engine-contract.test.ts`, `tests/engine-behavior.test.ts`,
  and focused daemon/MCP tests

- [x] Establish the current installer, storage-version, MCP, and daemon
  startup baseline. On 2026-08-28, the focused installer/storage suite and
  `pnpm type-lint` passed. `replaceManagedBlock` and
  `replaceManagedServerInJson` own registration-version and obsolete-entry
  detection; `resetAstrographStorage` owns safe archival/reset; daemon and MCP
  dispatch the current package entry point and do not read client registration
  files. The remaining change is therefore one shared registration-state
  decision at the installer boundary, not a duplicate daemon/MCP startup gate.
- [x] Remove `--migrate-legacy`, legacy-registration migration prompts, and
  their tests/docs. Replace them with current-format validation and the reset
  contract; do not add an adapter for an old Astrograph format.
- [x] Retain only safeguards that protect unrelated settings, symlink/path
  boundaries, active databases, backups, and rollback. These are safety checks,
  not backward compatibility.
- [x] Add focused proofs that obsolete formats are never parsed or migrated and
  that no removed compatibility command remains in help or docs.

**Baseline verification:**

```bash
pnpm exec vitest run tests/engine-contract.test.ts tests/engine-behavior.test.ts
pnpm type-lint
```

## Task 2: Implement one confirmation-gated reset path

**Files:**
- Modify: `src/scripts/install.ts`
- Modify: `src/config.ts`, `src/storage.ts`, and selected daemon/MCP entry
  points
- Modify: `src/astrograph.ts`, `src/cli.ts`, and `src/mcp.ts` only if their
  current startup boundary owns the detection
- Test: `tests/engine-contract.test.ts`, `tests/engine-behavior.test.ts`,
  `tests/cli-boundary.test.ts`, and focused daemon/MCP tests

- [x] Define the comparison at its owning local boundary: the installer checks
  managed registration generation and returns `ResetRequiredError`, package-pinned
  daemon/MCP entry points run the current package without reading client files,
  and storage owns its existing version/reset gate. This has no network lookup
  and avoids a duplicate daemon/MCP registration check that would break direct
  server use.
- [x] In a TTY, display the mismatch, why reset is necessary, the exact
  Astrograph-owned config/state that will be replaced, and a single default-no
  confirmation before any write.
- [x] In non-interactive mode, reject mismatches unless both `--yes` and
  `--reset` are supplied. The failure and README use the same copyable recovery
  command.
- [x] Reuse managed-block/JSON-entry writers for valid files. For a parseable
  invalid Astrograph entry, regenerate only that entry after confirmation.
- [x] For a wholly malformed client file, back it up then write a fresh
  Astrograph-only client config after confirmation; prove unrelated valid files
  are never whole-file replaced.
- [x] Remove only canonical Astrograph-owned state through existing safe path,
  lock, and symlink checks; rebuild it after configuration validation succeeds.
- [x] Prove cancellation/refusal through the default-no guided path and the
  explicit non-interactive guard; `--yes --reset` replacement, backup/rollback,
  malformed-file recovery, unrelated-setting preservation, and single state
  rebuild are covered by `tests/engine-contract.test.ts`. Daemon/MCP startup is
  proved through the local startup verifier and remains registration-independent.

## Task 3: Make every normal installer phase visible

**Files:**
- Modify: `src/scripts/install.ts`
- Test: `tests/engine-contract.test.ts` and package/bin smoke coverage

- [x] Introduce one small phase renderer used by guided install and direct
  repair, and reset. It owns `Step N of M`, phase title, completion, and bounded
  failure wording; do not add a second progress framework.
- [x] Show validation, confirmation, configuration, state rebuild when reset,
  and finish phases in normal TTY output. The optional global CLI installation
  remains separate with its command, Node version, bounded duration, and
  non-fatal outcome.
- [x] Keep `--verbose` as the only route to child-process detail. Normal output
  names each potentially long operation without printing client configuration.
- [x] Add focused assertions for stable phase rendering, the single reset-phase
  callback, cancellation/refusal, timeout wording, verbose detail, and managed
  configuration preservation.

## Task 4: State the hard-switch policy in user documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/getting-started/first-steps.md`
- Modify: `docs/reference/cli.md`
- Modify: `docs/guides/troubleshooting.md`
- Modify: `specs/implementation/active/README.md`
- Modify: `specs/implementation/roadmap.md`
- Modify: `pointer.md`

- [x] State plainly that pre-1.0 updates have no backwards-compatibility or
  migration promise: Astrograph validates and, with confirmation, recreates its
  configuration/state from scratch.
- [x] Give one interactive and one non-interactive reset example, each
  explaining why the reset is required and exactly what Astrograph does and
  does not remove.
- [x] Document malformed-client-config recovery: warning, troubleshooting link,
  timestamped backup, fresh Astrograph-only replacement, and restoration path.
- [x] Document visible phase output and `--verbose`; distinguish expected local
  prerequisite failures from Astrograph defects and retain the browser-only
  issue-draft policy for the latter.

## Final verification and release checkpoint

- [x] Run focused installer, storage, CLI, daemon/MCP, and packed-package
  tests. The 2026-08-28 installer contract run includes the temporary reset
  boundary, state reset, local MCP startup verifier, and packed global-install
  smoke scenario.
- [x] Run `pnpm type-lint`, `pnpm test`, `pnpm build`, `pnpm test:package-bin`,
  `pnpm check:version-bump --base origin/main`, and `git diff --check`.
- [x] Use `.skills/release-decision/SKILL.md` before committing source or
  package changes. The recorded decision is a patch release,
  `0.11.4-alpha.214`, from `v0.11.3-alpha.213`.
- [ ] Open one PR from this branch, record exact-head CI evidence, merge only
  after required checks pass, and use the guarded main-only npm release flow.
- [ ] Verify the released package in a clean temporary environment: normal
  guided phases are visible; version mismatch requires confirmation; explicit
  non-interactive reset works; obsolete state is rebuilt; and unrelated valid
  client settings remain intact.

## Non-goals

- General API/MCP compatibility removals outside installation, configuration,
  cache/state, daemon, and startup boundaries.
- Automatic deletion, silent reset, background update checks, telemetry, or
  installing/upgrading Node, npm, Codex, or Copilot.
- A migration framework, compatibility aliases, cross-version cache reader,
  or a generic client-config rewriter.
