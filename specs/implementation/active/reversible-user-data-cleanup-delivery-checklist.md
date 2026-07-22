# Reversible User-Data Cleanup Delivery Checklist

> **Status:** Active — selected by `pointer.md` as the single next goal after
> global-install recovery closed with no new public recovery surface.

**Goal:** Ensure every Astrograph cleanup or cache-recovery operation is safe
by default: it must be scoped, previewable, recoverable, and auditable. An
agent or command must never recursively delete an inferred user path.

**Architecture:** Keep mutable Astrograph state inside its managed root. A
cleanup operation first resolves canonical targets, rejects symlinks and paths
outside that root, and produces a dry-run receipt. The default mutation moves
targets to a timestamped archive within the same managed root; it records the
original path, archive path, size, reason, and recovery command. Permanent
deletion is a separate, explicit, confirmed operation and is not exposed over
MCP.

**Likely files:** `src/cache-control.ts`, `src/config.ts`, `src/cli.ts`,
`src/mcp.ts`, `src/types/*`, `tests/engine-contract.test.ts`,
`tests/engine-behavior.test.ts`, `docs/reference/cli.md`, and
`specs/api-design/cli-api.md` if the public receipt changes.

## Task 1: Establish the safety baseline

- [ ] Inventory every delete, remove, prune, overwrite, migration-reset, and
  cache-cleanup path. Record caller, root validation, dry-run behavior,
  confirmation requirement, and recovery behavior.
- [ ] Reproduce the current cache remove/prune behavior in a disposable home
  with normal directories, symlinks, active SQLite files, malformed markers,
  and paths outside the managed root.
- [ ] Record comparable guidance: Codex/Claude permission boundaries and
  editor filesystem APIs that prefer trash or explicit confirmation.

## Task 2: Define the archive-first public contract

- [ ] Write an ADR before changing behavior: archive root, retention,
  collision handling, same-filesystem move requirement, receipt schema,
  restore command, failed-move behavior, and explicit permanent-delete gate.
- [ ] Make dry-run the default for every cleanup command and require an exact
  scope plus `--yes` for an archive move.
- [ ] Reject broad roots, symlinks, active databases, non-canonical paths, and
  targets outside Astrograph-owned state before any mutation.
- [ ] Keep destructive cache controls out of MCP; MCP may report status and
  recovery guidance only.

## Task 3: Implement and prove recoverability

- [ ] Add archive/restore fixtures that assert bytes and metadata survive the
  round trip and unrelated files remain byte-for-byte unchanged.
- [ ] Add failure-injection coverage for partial moves, collisions, permissions,
  malformed receipts, and concurrent index activity.
- [ ] Document preview, archive, inspect, restore, retention, and the separate
  irreversible-delete procedure in plain language.

## Task 4: Verify and commit

- [ ] Run focused cache/control tests, `pnpm type-lint`, `pnpm test`,
  `pnpm test:package-bin`, `pnpm check:version-bump`, and `git diff --check`.
- [ ] Require exact-head Fast and Windows/package-smoke CI before merge.
- [ ] Use a runtime-appropriate version decision and record CI evidence before
  moving this checklist to `closed/`.
