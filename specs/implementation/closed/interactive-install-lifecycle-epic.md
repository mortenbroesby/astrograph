# Interactive Install Lifecycle Epic (Superseded)

> **Status:** Superseded on 2026-07-29 by the now-completed
> [Pre-v1 Clean Install Contract Epic](./pre-v1-clean-install-contract-epic.md).
> This record retains the delivered lifecycle design and evidence. Its unchecked
> compatibility/migration follow-ups must not be completed independently: the
> successor deliberately removes those paths and owns any still-relevant tests.

**Goal:** Make Astrograph installation one understandable, interactive, opt-in
flow that safely manages device-wide or repository setup from discovery through
update, repair, diagnostics, issue reporting, and removal.

**Architecture:** Keep the existing setup writers as the only owners of Codex,
Copilot CLI, and repository configuration. Put a small lifecycle router in the
package CLI: interactive use opens a guided setup or status dashboard;
non-interactive use requires explicit scope and client choices. Managed config
uses exact, package-version-pinned `npx` invocations so it does not depend on a
global executable or PATH; the optional global CLI is only a convenience.

**Tech Stack:** TypeScript, Node 20.19+ or 22.12+, Commander, Clack prompts,
native Node filesystem/process APIs, pnpm, and Vitest. No new runtime
dependency, background service, telemetry, or startup network request.

**Relationship to earlier work:**

- [Comforting Install Experience](./comforting-global-install-experience.md)
  and [Guided Install and Refresh Hooks](./guided-install-and-refresh-hooks.md)
  are implementation context, not the final lifecycle contract.
- This epic supersedes their remaining onboarding/recovery follow-ups. It does
  not reopen completed global-cache, hook, or package-release work.

## Product Contract

### Entry points and modes

- `npx --yes astrograph` and `npx --yes astrograph install` open the same TTY
  lifecycle experience. The README uses the former so npm's separate package
  confirmation cannot obscure Astrograph's own UI.
- A globally installed bare `astrograph` does the same in a TTY; without a TTY
  it prints concise help and exits without writing state.
- The interactive first run selects scope, explicitly selects detected clients,
  previews changes, and requires a final confirmation. No config, package,
  index, or cache write happens first.
- Non-interactive mode requires explicit `--scope` and `--ide` alongside
  `--yes`; it never guesses a scope or client. `--dry-run` returns the same
  planned operations without writes.

### Setup choices

- Device-wide setup is recommended, writes only user-level managed client
  configuration, and uses one private index per repository. It never modifies
  the current repository unless the user separately opts into indexing it.
- Repository setup writes only the selected project-owned managed config and
  keeps the index local. It offers immediate indexing by default.
- Device-wide setup offers immediate indexing of the current repository, but
  defaults to no.
- The optional global CLI install is a visible npm-only convenience step. It
  installs the exact version running the installer, does not block client setup
  if declined or unavailable, and never becomes an MCP dependency.
- The global MCP registration always uses an exact pinned `npx` package
  invocation. The user updates it through Astrograph rather than relying on
  PATH or a second `latest` lookup.

### Status, lifecycle, and recovery

- A healthy interactive invocation opens a status dashboard with version,
  detected/connected clients, selected repository/index state, and explicit
  Update, Repair, Reconfigure, Index, and Uninstall actions.
- Existing configuration is inspected before action; updates are never
  automatic. Update changes the pinned MCP version and optional global CLI
  together only after one review screen.
- Before modifying a client configuration, create a timestamped local backup.
  Edit only Astrograph marker-owned blocks; preserve every unrelated setting.
  Legacy unmarked Astrograph entries require a one-time displayed migration
  confirmation.
- Parse and lightweight-MCP-startup verification are required before success.
  Failed config verification automatically restores the backup and reports the
  recovery path. A successfully installed global npm package is never silently
  uninstalled.
- `astrograph uninstall` is guided and granular: registration, optional global
  CLI, selected repository index/cache, or all Astrograph state. Data removal
  is never preselected.

### Diagnostics and privacy

- Missing prerequisites, unsupported runtimes, client absence, permissions,
  registry availability, invalid choices, and configuration conflicts are
  user/environment failures. Explain the cause and next command; provide a
  copyable sanitized diagnostic summary but no issue prompt.
- Unexpected exceptions, violated installer invariants, corrupted installer
  state, and reproducible package/runtime defects are Astrograph failures.
  Offer a browser-only, copyable prefilled GitHub issue link.
- The issue link requires explicit diagnostics consent and contains only the
  selected choices, Astrograph/Node/npm/platform versions, failing step, and a
  sanitized stack summary. Never include credentials, config contents, source,
  or unreviewed local paths.
- Update checks occur only from an explicit dashboard action. There are no
  background network calls, startup delay, telemetry, or automatic prerequisite
  installation.

## Task 1: Define the public lifecycle contract

**Files:**
- Modify: `src/astrograph.ts`
- Modify: `src/scripts/install.ts`
- Modify: `specs/api-design/cli-api.md`
- Test: `tests/engine-contract.test.ts`

- [x] Add `install`, bare-command, `status`, `update`, `repair`, `reconfigure`,
  and `uninstall` command routing with one shared option parser.
- [x] Define `--scope global|repository`, explicit non-interactive validation,
  JSON result schemas, dry-run behavior, and compatibility handling for the
  existing `install --global` command.
- [x] Keep bare non-TTY execution read-only and concise.
- [ ] Add contract tests for entry-point parity, TTY refusal, explicit
  non-interactive inputs, cancellation, and JSON output.

**Baseline verification:**

```bash
pnpm exec vitest run tests/engine-contract.test.ts
pnpm type-lint
```

**Final verification:** focused command tests pass and `pnpm check:version-bump`
accepts the source change.

## Task 2: Implement reviewed setup and exact pinned registrations

**Files:**
- Modify: `src/scripts/install.ts`
- Modify: `src/scripts/global-install-message.mjs`
- Modify: `tests/engine-contract.test.ts`
- Modify: `tests/global-install-message.test.ts`
- Modify: `src/scripts/smoke-package-bin.ts`

- [ ] Route both setup scopes through a preview/confirm model with detected
  clients presented as choices, never implicit writes.
- [x] Make global registration independent of the optional CLI and emit exact
  package-version-pinned `npx` MCP commands for supported global clients.
- [x] Offer npm global CLI installation only after confirmation, using the
  installer version; warn—but do not fail—when another package manager is in
  use or npm's global prefix requires intervention.
- [x] Offer immediate indexing with repository=yes and global=no defaults.
- [x] Verify no repository writes occur for device-wide setup without an index
  opt-in, and prove package smoke from a clean temporary home.

## Task 3: Add status, update, repair, and reversible managed writes

**Files:**
- Modify: `src/scripts/install.ts`
- Modify: `tests/engine-contract.test.ts`
- Modify: `src/scripts/smoke-package-bin.ts`

- [x] Build the read-only dashboard from existing readiness/diagnostic data.
- [x] Add explicit update, repair, and reconfigure actions; no automatic update
  check or network request occurs on ordinary launch.
- [x] Back up each affected user config before a managed-block edit, preserve
  unrelated text, and require an explicit migration for a legacy unmarked
  Astrograph entry.
- [x] Verify config parse plus a bounded local MCP startup before reporting
  success; restore backups on verification failure.
- [x] Test idempotency, unrelated-config preservation, legacy migration,
  backup creation, rollback, and an optional CLI failure that leaves a valid
  registration intact.

## Task 4: Add safe removal and failure reporting

**Files:**
- Modify: `src/scripts/install.ts`
- Modify: `tests/engine-contract.test.ts`
- Modify: `docs/guides/troubleshooting.md`

- [x] Implement granular uninstall preview and confirmation. Cache/index data
  has no preselected destructive option and uses existing safe cache controls.
- [x] Classify expected user/environment failures separately from Astrograph
  failures; every category has a copyable sanitized diagnostic summary.
- [x] Offer an explicitly consented browser issue URL only for Astrograph
  failures. Test redaction for tokens, config values, source, and local paths.
- [x] Keep all recovery actions local and deterministic; never create a GitHub
  issue or run a browser automatically.

## Task 5: Publish the user-facing path and evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/getting-started/first-steps.md`
- Modify: `docs/reference/cli.md`
- Modify: `docs/guides/troubleshooting.md`
- Modify: `specs/implementation/active/README.md`
- Modify: `specs/implementation/roadmap.md`
- Modify: `pointer.md`

- [x] Make `npx --yes astrograph` the one-command interactive quick start and
  distinguish it from the optional global CLI package.
- [x] Document global versus repository behavior, opt-ins, update/repair,
  uninstall scopes, diagnostics consent, privacy boundaries, and deterministic
  non-interactive commands.
- [ ] Add one end-to-end packaged smoke scenario for first setup, rerun,
  update/repair, cancellation, and issue-link redaction.

## Task 6: Make optional global CLI installation runtime-manager-safe

**Files:**
- Modify: `src/scripts/install.ts`
- Modify: `src/scripts/global-install-message.mjs`
- Modify: `tests/engine-contract.test.ts`
- Modify: `tests/global-install-message.test.ts`
- Modify: `src/scripts/smoke-package-bin.ts`
- Modify: `README.md`
- Modify: `docs/getting-started/first-steps.md`
- Modify: `docs/guides/troubleshooting.md`
- Modify: `docs/reference/cli.md`

**Baseline verification:**

```bash
pnpm exec vitest run tests/engine-contract.test.ts tests/global-install-message.test.ts
pnpm test:package-bin
```

Expected: global-package and installer behavior pass without a user-global
runtime-manager mutation.

- [x] Document the three separate responsibilities: Node/runtime managers
  select a runtime, npm places an optional global executable under that
  runtime's global prefix, and `astrograph install` configures MCP clients.
  State plainly that changing Node versions can require reinstalling an
  optional global executable and following a runtime manager's documented
  refresh step when necessary.
- [x] Keep client registrations on exact version-pinned `npx` invocations.
  A missing or stale optional `astrograph` command must never make an existing
  client registration unusable.
- [x] Make the optional-global-install success and failure output identify the
  installed Astrograph version, distinguish a package-manager/PATH problem
  from MCP configuration, and give a copyable recovery command using the
  current package version. Do not infer, install, update, or configure a
  runtime manager, Node, npm, or shell PATH automatically.
- [x] Add focused renderer/installer tests for the recovery guidance and a
  packed-package smoke scenario that installs the packed tarball into an
  isolated npm prefix, invokes the linked `astrograph` binary, and proves
  `astrograph --version` matches the packed version. The test must not depend
  on a runtime manager being installed in CI.
- [x] Add neutral runtime-manager guidance to the first-steps and
  troubleshooting docs:

  ```bash
  npm install --global astrograph@latest
  astrograph install
  ```

  Explain that any runtime-manager refresh step is tool-specific and not a
  prerequisite for normal `npx --yes astrograph` setup.

**Final verification:**

```bash
pnpm exec vitest run tests/engine-contract.test.ts tests/global-install-message.test.ts
pnpm test:package-bin
pnpm type-lint
pnpm build
pnpm check:version-bump --base origin/main
git diff --check
```

Expected: all commands exit `0`. Before a source or package change is
committed, use `.skills/release-decision/SKILL.md`; documentation-only changes
remain subject to the repository's version-policy check.

## Final verification and release checkpoint

- [ ] Run focused installer, global-package-message, and package-bin tests.
- [ ] Run `pnpm type-lint`, `pnpm test`, `pnpm build`, `pnpm test:package-bin`,
  `pnpm check:version-bump`, and `git diff --check`.
- [ ] Use `.skills/release-decision/SKILL.md` to decide the required version
  increment before source/package changes are committed.
- [ ] Commit only this epic's intentional files, push one branch, open a draft
  PR, and record exact-head CI evidence before moving this document to closed.

## Non-goals

- Installing or upgrading Node, npm, Codex, or Copilot CLI.
- Owning runtime-manager configuration, modifying `.tool-versions`, or adding
  a runtime manager as an Astrograph dependency.
- Background update checks, telemetry, hidden network requests, or source upload.
- Replacing package-manager behavior or adding an interactivity framework.
- Rewriting unrelated global-cache, MCP, daemon, or Git-hook behavior.
