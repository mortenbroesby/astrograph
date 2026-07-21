# Global Install and Cache Deferred Story Handoffs

> **Epic:** [Global Install and Cache Epic](../closed/global-install-and-cache-epic.md)
>
> **Status:** Historical handoffs for completed Stories 2–5 and Story 7;
> **only Story 6 remains deferred.** This document does not authorize source
> changes, cache mutation, user-level configuration writes, package
> publication, or any non-goal work.

Story 6 may move to an active checklist only after all listed prerequisites are
true. Create the active checklist by copying its baseline, steps, verification,
and commit checkpoint; do not execute directly from this deferred record.

## Shared Rules for Every Deferred Story

- Use an isolated worktree.
- Preserve the existing repository-local default and public MCP `repoRoot`
  requirement unless the selected story explicitly changes it.
- Keep source paths, event contents, and cache bytes on the current OS user's
  machine. Tests use temporary directories and fixture configuration only.
- Before committing source, tests, scripts, package metadata, or configuration
  contracts, run `pnpm check:version-bump`.
- Stop and write an ADR instead of extending the selected story if it would
  require a shared mutable index, an MCP destructive-cache tool, network sync,
  or a background daemon.

---

## Story 2: Global Install and Codex Registration

**Selection gate:** Story 1 is merged with a stable public storage-location
resolver and its compatibility tests pass.

**Files:** `src/astrograph.ts`, `src/scripts/install.ts`, `src/cli.ts`,
`src/command-registry.ts`, `tests/engine-contract.test.ts`,
`tests/cli-boundary.test.ts`, `tests/interface.test.ts`, `README.md`, and the
CLI/MCP contract specs when a public option changes.

1. Run the baseline:

   ```bash
   pnpm type-lint
   pnpm exec vitest run tests/engine-contract.test.ts tests/cli-boundary.test.ts tests/interface.test.ts
   pnpm test:package-bin
   ```

   Expected: all commands exit `0`; existing `astrograph init --repo` remains
   repository-scoped.
2. Add the top-level `astrograph install --global --ide codex` dispatch without
   changing the behavior of `astrograph init`. Reject `--global` combined with
   a repository-targeting setup option.
3. Resolve the per-user Codex configuration path through the same injected
   platform abstraction used by Story 1. Write only an Astrograph marker-owned
   block that executes the installed `astrograph mcp`; preserve all unrelated
   servers and text byte-for-byte.
4. Make repeated global installation replace only that marker-owned block.
   Validate the executable path and supported Node runtime before writing; on
   failure return a remediation command and do not leave a partial file.
5. Prove a global MCP process still receives `repoRoot` per call. It must not
   infer a repository from the global configuration directory or process CWD.
6. Verify with the baseline suite plus fixture cases for empty config,
   unrelated server preservation, idempotent replacement, unsupported Node,
   unwritable config location, missing executable, and packed-package setup.
   Update CLI and MCP contracts for every new public flag or response field.
7. Run `pnpm check:version-bump` and `git diff --check`; commit only the listed
   files and the active Story 2 checklist with
   `feat: add global Codex installation`.

## Story 3: Per-Repository Global Cache Lifecycle

**Selection gate:** Story 1 is merged. Story 2 is not required because global
storage may be selected through the tested storage contract before global
registration is exposed to users.

**Files:** `src/storage.ts`, `src/event-sink.ts`, `src/repo-meta.ts`,
`src/diagnostics.ts`, `src/doctor.ts`, `src/config.ts`,
`tests/engine-behavior.test.ts`, `tests/event-sink.test.ts`, and
`tests/watch-boundary.test.ts`.

1. Run the baseline:

   ```bash
   pnpm type-lint
   pnpm exec vitest run tests/engine-behavior.test.ts tests/event-sink.test.ts tests/watch-boundary.test.ts
   ```

2. Trace every storage-path access through the Story 1 resolver: SQLite open,
   repo metadata, integrity marker, storage version, event sink, diagnostics,
   doctor, reset, index, refresh, and watch. Replace direct `.astrograph`
   joins only where they address persistent engine state.
3. Change process-cache keys from repository root alone to the resolved storage
   identity. A process may index the same repository once in `repo-local` and
   once in `global` mode without reusing the wrong connection or readiness
   state.
4. Add two-repository fixtures with equal basenames and a canonical-alias
   fixture. Prove index rows, symbols, dependency edges, event history,
   freshness, locks, reset, diagnostics, and watch refresh cannot cross the
   repository boundary.
5. Assert diagnostics may show the resolved cache directory but never embed
   indexed source text. Preserve WAL behavior and existing repository-local
   results.
6. Run the baseline, `pnpm check:version-bump`, and `git diff --check`; commit
   the scoped implementation and Story 3 checklist with
   `feat: route global repository cache lifecycle`.

## Story 4: Safe Local-Cache Migration and Fallback

**Selection gate:** Story 3 is merged with two-repository isolation coverage.

**Files:** `src/storage.ts`, `src/config.ts`, `src/doctor.ts`,
`tests/engine-behavior.test.ts`, and `tests/engine-contract.test.ts`.

1. Run the focused storage baseline:

   ```bash
   pnpm type-lint
   pnpm exec vitest run tests/engine-contract.test.ts tests/engine-behavior.test.ts
   ```

2. Define a migration state record with source path, destination identity,
   storage version, phase, and recoverable error. Do not infer completion from
   destination existence alone.
3. For a same-filesystem move, copy into a uniquely named staging directory,
   validate storage version, integrity, and SQLite open, then atomically rename
   into an empty verified destination. For cross-device migration, copy,
   validate, and rename the staged destination; remove the source only after
   success.
4. Refuse a non-empty destination unless its canonical repository identity and
   compatible version match. On corruption, conflict, or interruption, retain
   the source and report retry or explicit rebuild guidance.
5. Add fixtures for partial staging, cross-device copy, stale source, corrupt
   destination, incompatible version, retry after failure, and explicit
   rebuild. Each failure assertion proves the original `.astrograph` still
   exists with its original files.
6. Run the baseline, `pnpm check:version-bump`, and `git diff --check`; commit
   with `feat: migrate repository cache safely`.

## Story 5: Cache Inspection, Pruning, and Removal

**Selection gate:** Story 3 is merged. A destructive-command safety review is
recorded in the active Story 5 checklist before any mutation code is written.

**Files:** `src/cli.ts`, `src/command-registry.ts`, `src/storage.ts`,
`src/doctor.ts`, `tests/cli-boundary.test.ts`, `tests/engine-contract.test.ts`,
and `docs/reference/cli.md`.

1. Run:

   ```bash
   pnpm type-lint
   pnpm exec vitest run tests/cli-boundary.test.ts tests/engine-contract.test.ts
   ```

2. Add JSON-first `astrograph cache status --repo <path>` with the canonical
   repository identity, selected location, storage version, byte counts, lock
   state, and migration state. Keep its JSON schema versioned and documented.
3. Define `cache prune` and `cache remove` scopes before implementing them:
   exactly one canonical repository, or the complete current-user Astrograph
   cache root. Both default to dry run; mutation requires the explicit scope
   and `--yes`.
4. Canonicalize every target, verify it is below the resolved Astrograph cache
   root, reject symlink/path traversal escapes, and refuse active locks. Never
   invoke recursive deletion from MCP.
5. Define deterministic prune ordering (eligible, unlocked entries ordered by
   last-access time then canonical identity) and stop when the requested size
   target is met. Report every candidate and action in JSON without source
   contents.
6. Add tests for dry run, missing confirmation, bad scope, hostile path,
   symlink escape, active lock, deterministic prune order, and isolated target
   deletion. Then run `pnpm check:version-bump` and `git diff --check`; commit
   with `feat: add scoped cache controls`.

## Story 6: Shared Immutable Artifact Store — Optional and Deferred

**Selection gate:** Stories 3 and 4 are merged, global-cache usage evidence
shows storage duplication is material, and an ADR confirms the complete
fingerprint and pruning policy. Until then, this story is not selected.

**Files:** `src/incremental-cache.ts`, `src/storage-schema.ts`,
`src/storage.ts`, `src/checkout-mapping.ts`, `tests/incremental-cache.test.ts`,
`tests/checkout-mapping.test.ts`, and `tests/engine-behavior.test.ts`.

1. Baseline with `pnpm type-lint` and the three focused cache/mapping suites.
2. Define immutable artifact layout, atomic staging/rename protocol, ownership
   permissions, and a complete fingerprint check before any write path.
3. Keep mutable files, symbols, dependencies, readiness, diagnostics, and
   events in each repository database. A cache hit may supply analysis facts;
   it never shares a mutable row or connection.
4. Test every fingerprint component, concurrent writers, corruption,
   unavailable artifact root, cross-worktree reuse, cross-repository isolation,
   and reference-safe pruning. A failure always falls back to ordinary
   analysis.
5. Run the focused suite, `pnpm check:version-bump`, and `git diff --check`;
   commit with `feat: reuse immutable global analysis artifacts` only after the
   ADR selection gate is met.

## Story 7: Contract, Documentation, and Release Proof

**Selection gate:** The selected Stories 1–5 are merged; Story 6 is either
merged or explicitly recorded as deferred in release notes and documentation.

**Files:** `README.md`, `docs/getting-started/first-steps.md`,
`docs/reference/cli.md`, `docs/reference/config.md`,
`docs/guides/troubleshooting.md`, `specs/api-design/cli-api.md`,
`specs/api-design/mcp-tools.md`, package smoke tests, and the active global
epic/checklists.

1. Run the accumulated focused suites from selected stories before changing
   public documentation or package smoke fixtures.
2. Document opt-in global installation, repo-local fallback, cache-root
   discovery, migration/rebuild recovery, data privacy, and safe cache cleanup.
   State that the one global MCP server receives a `repoRoot` per call.
3. Add a clean-user package fixture that installs the packed tarball, registers
   Codex, indexes two repositories, and proves their cache data is isolated.
   It must not use the developer's real user config or cache directory.
4. Update public CLI/MCP contracts for new commands, flags, JSON fields, and
   error behavior. Do not add MCP cache mutation tools.
5. Run:

   ```bash
   pnpm type-lint
   pnpm test
   pnpm test:package-bin
   pnpm check:version-bump
   pnpm release:plan
   git diff --check
   ```

6. Apply the release-decision skill, record its result in the Story 7
   checklist, and use the guarded release workflow only when it selects a
   publishable runtime change.

## Explicitly Deferred Non-Goals

| Non-goal | Deferral condition | Not authorized in this epic |
| --- | --- | --- |
| One shared mutable SQLite index | Requires repository/checkout scoping across every table, query, migration, lock, and retrieval contract plus a dedicated ADR. | Schema consolidation or cross-repository retrieval. |
| Network synchronization or cloud cache | Requires an authentication, encryption, retention, and data-residency design. | Uploading source, paths, events, or artifacts. |
| Cross-OS-user cache sharing | Requires ownership, permission, encryption, and revocation policy. | Shared directory permissions or multi-user access. |
| Background daemon or automatic repository scan | Requires lifecycle, resource, consent, and privacy design. | Persistent process or unsolicited indexing. |
| MCP cache mutation tools | Requires a separate destructive-operation API safety decision. | Prune, remove, migration, or reset through MCP. |
| Shared immutable artifacts before evidence | Requires Story 6 selection gate and ADR. | Artifact-store implementation during Stories 1–5. |
