# Complexity Cleanup Epic

> **Status:** Implemented in this pull request as a non-pointer delivery goal.
> This epic is intentionally outside the
> active implementation queue in `../active/README.md`; it may ship as one
> focused pull request without selecting or changing that queue.

**Goal:** Remove audit-proven complexity from Astrograph without expanding the
public tool surface or weakening watch, retrieval, or local event behavior.

**Architecture:** Keep the local JSONL event sink, deterministic retrieval
token accounting, and native watch fallbacks. Delete fabricated per-tool
telemetry and configuration that cannot affect runtime behavior, then replace
the single RxJS stream with a small Node-native debounce/serialization queue.
Shared repository-relative-path validation becomes one internal utility.

**Tech Stack:** TypeScript, Node 22, Vitest, pnpm, native timers/promises.

## Boundaries

- No MCP tool, CLI command, schema, or retrieval-result changes.
- Preserve event redaction and retention; remove only inert observability
  controls and fabricated event metadata.
- Preserve watch batching, ordered refreshes, fallback behavior, and close
  draining.
- Do not modify `pointer.md` or `specs/implementation/active/README.md`.

## Story 1: Remove Fabricated MCP Tool Telemetry

**Files:**
- Modify: `src/mcp.ts`, `tests/interface.test.ts`
- Delete: `src/tool-observability.ts`

- [x] Establish a failing interface expectation proving event records no longer
  include fabricated `tokenEstimate` data.
- [x] Replace completion telemetry with direct tool facts already known to the
  MCP dispatcher: duration, tool name, and success/error details.
- [x] Preserve `tokenBudgetUsed` only where the result explicitly reports it;
  do not derive it from an estimate.
- [x] Verify `tests/interface.test.ts` and MCP contract tests.

**Acceptance:** Event history is factual, and the per-process sampling counter,
heuristic baselines, and 460-line telemetry module are gone.

## Story 2: Prune Inert Observability Configuration

**Files:**
- Modify: `src/config.ts`, `src/types/config.ts`, `src/doctor.ts`,
  `astrograph.config.ts`, `docs/reference/config.md`, `docs/reference/cli.md`,
  `docs/guides/performance.md`, `tests/engine-contract.test.ts`,
  `tests/engine-behavior.test.ts`

- [x] Establish a failing config contract asserting that resolved observability
  contains only the effective retention and redaction controls.
- [x] Remove `enabled`, host, port, `recentLimit`, and `snapshotIntervalMs`
  from configuration, diagnostics, examples, and docs.
- [x] Keep all event writes privacy-safe and retained according to
  `retentionDays`; callers continue to bound reads with `limit`.
- [x] Verify focused config, doctor, and event-sink tests.

**Acceptance:** Every supported observability field changes runtime behavior;
no advertised host/port listener or unused scheduling control remains.

## Story 3: Use a Native Watch Refresh Queue

**Files:**
- Modify: `src/storage.ts`, `package.json`, `pnpm-lock.yaml`,
  `tests/watch-boundary.test.ts`

- [x] Characterize native watcher and polling fallback batching, ordered
  reindexing, error retry, and close-drain behavior with focused tests.
- [x] Replace the sole RxJS `Subject`/operator pipeline with a small native
  debounce timer and serialized Promise queue.
- [x] Remove `rxjs` from dependencies and lockfile.
- [x] Verify the focused watch suite and full type check; package build is
  recorded in the delivery checklist below.

**Acceptance:** Watch behavior remains deterministic with no RxJS production
dependency.

## Story 4: Centralize Repository-Relative Path Utilities

**Files:**
- Modify: `src/path-matcher.ts`, `src/storage.ts`, `src/retrieval.ts`,
  `tests/path-matcher.test.ts`

- [x] Establish failing path utility tests for empty, parent-escaping, absolute,
  and separator-normalized paths.
- [x] Move the duplicated validation and glob helper to `path-matcher.ts`.
- [x] Replace both storage and retrieval copies without changing error text or
  returned absolute/relative paths.
- [x] Verify focused path, retrieval, and interface tests.

**Acceptance:** Storage and retrieval share exactly one path-escape rule and
one glob wrapper.

## Delivery Checklist

- [x] Baseline: `pnpm type-lint` and focused interface/config/watch/path tests.
- [x] Run each story’s red-green or characterization verification before moving
  to the next story.
- [ ] Run `pnpm test`, `pnpm build`, `pnpm test:package-bin`,
  `pnpm check:version-bump`, and `git diff --check`.
- [ ] Decide the release classification with `pnpm release:plan`.
- [ ] Review the final diff, commit only epic files, push the epic branch, and
  open one PR with story-by-story evidence.

## Rollback

Revert the single cleanup PR. No storage migration, persisted-schema migration,
or user configuration rewrite is introduced.
