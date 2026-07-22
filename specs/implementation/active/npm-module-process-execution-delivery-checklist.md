# Process Execution with `execa` Delivery Checklist

> **Epic:** [Reduce Astrograph Boilerplate with Proven npm Modules](./npm-module-adoption-epic.md), Story 1
>
> **Status:** Active — the current `pointer.md` goal. Do not start later epic stories as part of this checklist.

**Goal:** Replace repeated generic child-process plumbing in the first selected Astrograph scripts with a narrow internal `execa` seam, preserving observable behavior.

**Architecture:** `src/lib/process.ts` owns generic command execution and the small set of options Astrograph needs. Script-specific policy stays in its current script. No public CLI or MCP contract changes.

**Tech stack:** TypeScript, Node.js `>=22.12.0`, pnpm, `execa`, Vitest, and Windows CI.

## Files

- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/lib/process.ts` and focused wrapper tests only if script tests cannot prove the boundary
- Modify: `src/scripts/run-vitest.ts`, `src/scripts/release-agent.ts`, `src/scripts/install.ts`
- Update: this checklist and the active epic with final evidence before Story 1 closes

## Task 1 — Inventory the existing process contract

- [x] Run `rg -n "execFileSync|spawnSync|execFile|spawn\\(" src/scripts tests`.
- [x] Record each selected script's command, arguments, stdio, timeout, exit, and Windows behavior in delivery evidence.
- [ ] Run focused baseline tests for every selected script and `pnpm type-lint`.

Expected: migration behavior is evidence-backed; no behavior is inferred from library defaults.

**Baseline evidence (2026-07-22):** `run-vitest.ts` runs `vitest run` with
argument-array input, inherited stdio, no explicit timeout, and `shell: true`
only on Windows; it propagates the child status. `release-agent.ts` captures
Git output with stdin ignored and treats Git failures as empty optional state;
its `npm view astrograph version --json` lookup captures stderr and has a
15-second timeout, returning an explicit unavailable-registry state on failure.
`install.ts` has a 2.5-second update lookup that silently omits suggestions on
failure, Git-root fallback to the supplied path, and package-file fallback to
`false`; its selected calls capture stdout and suppress stderr. The existing
focused coverage is `tests/release-agent.test.ts` plus installer behavior in
`tests/engine-contract.test.ts`; the Vitest launcher currently has no direct
test.

## Task 2 — Introduce the bounded process wrapper

- [ ] Add `execa` after confirming supported Node and license fit.
- [ ] Add `src/lib/process.ts` with explicit argument-array execution, timeout, stdout/stderr, and non-zero-error behavior.
- [ ] Add focused tests for wrapper behavior not already covered by scripts.

Expected: no unbounded generic shell abstraction.

## Task 3 — Migrate `run-vitest.ts`

- [ ] Preserve current test-shard timeout and output behavior.
- [ ] Run focused tests and `pnpm type-lint`.

## Task 4 — Migrate release and installer scripts

- [ ] Preserve release registry-unavailable, version-decision, tag, and publish semantics.
- [ ] Preserve installer managed-block, dry-run, timeout, and platform behavior.
- [ ] Run focused release/install tests and `pnpm type-lint` after each migration.

## Task 5 — Final verification and delivery

- [ ] Run `pnpm check:version-bump`, selected focused tests, `pnpm type-lint`, `pnpm build`, and `pnpm test:package-bin`.
- [ ] Require exact-head Fast and Windows/package-smoke CI before merge.
- [ ] Record evidence and close Story 1 without automatically selecting Story 2.

## Commit checkpoint

Stage the changed package metadata, process wrapper, migrated scripts, and focused tests; run `pnpm check:version-bump`; then commit with `refactor: centralize process execution`.
