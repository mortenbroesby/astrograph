# MCP Runtime Hygiene Delivery Checklist

> **Status:** Active — explicitly prioritized by the user on 2026-07-26.
>
> **Inspiration:** jCodeMunch v1.108.172 made abandoned MCP processes visible
> after process sprawl retained substantial in-memory indexes. Astrograph adopts
> observability and clean shutdown, not automatic process reaping or idle cache
> eviction.

**Goal:** Make live Astrograph MCP processes visible to the local user and
release process-lifetime storage, worker, and tokenizer resources during normal
MCP shutdown.

**Architecture:** A small user-private runtime directory holds one atomic JSON
presence record per PID. Records contain only process metadata (PID, start
time, package version, and transport); they contain no repository paths,
queries, source, or index contents. The MCP entrypoint registers after stdio
connects and removes its record through one idempotent shutdown path that also
clears process caches. The existing `diagnostics`/`doctor` output is the
discovery surface; no new MCP tool and no background reaper are introduced.

**Tech Stack:** TypeScript, Node.js 22, MCP stdio, Vitest, and Node filesystem
APIs.

---

## Task 1: Presence Registry and Shutdown Lifecycle

**Files:**

- Create: `src/runtime-presence.ts`
- Modify: `src/mcp.ts`, `src/index.ts`, `src/types.ts`, `src/storage.ts`
- Test: `tests/runtime-presence.test.ts`, `tests/interface.test.ts`
- Document: `specs/api-design/cli-api.md`, `docs/guides/troubleshooting.md`

- [x] **Step 1: Establish the baseline.**

  Ran:

  ```bash
  pnpm type-lint
  pnpm exec vitest run tests/interface.test.ts
  ```

  Expected and observed: both commands exit `0` (2026-07-26).

- [x] **Step 2: Add a private, testable presence registry.**

  Default to a user-private runtime directory and allow a test-only directory
  override. Write one atomic `<pid>.json` record after MCP stdio connects;
  record `pid`, `startedAt`, `version`, and `transport`. Read operations prune
  demonstrably dead PIDs and return aggregate counts only. Do not persist
  repository paths, index paths, source, queries, client payloads, or secrets.

- [x] **Step 3: Add one idempotent MCP shutdown path.**

  On `SIGINT`, `SIGTERM`, and normal stdio closure, close the server, remove the
  presence record, clear storage process caches, and dispose the tokenizer.
  Preserve the existing stdio protocol and return code. Shutdown must be safe
  if invoked twice or after partial initialization.

- [x] **Step 4: Surface bounded runtime health.**

  Extend existing diagnostics/doctor output with a versioned, source-free
  runtime summary: live process count, stale/invalid registry record counts,
  and a warning only above the documented threshold. Keep process detail out of
  normal repository retrieval payloads.

- [x] **Step 5: Prove lifecycle behavior.**

  Add unit tests for atomic registration, removal, stale-record pruning, bad
  registry data, and no-source privacy. Add an MCP subprocess test that waits
  for registration, closes the client, and proves cleanup. Cover idempotent
  shutdown and resource-disposal seams without relying on timing sleeps.

- [x] **Step 6: Verify release scope and commit checkpoint.**

  Run:

  ```bash
  pnpm exec vitest run tests/runtime-presence.test.ts tests/interface.test.ts tests/cli-boundary.test.ts
  pnpm type-lint
  pnpm check:version-bump
  git diff --check
  pnpm build
  pnpm test:package-bin
  ```

  The focused test, type, build, package-bin, version-bump, and diff checks
  pass on current `main`. This compatible runtime reliability fix has a patch
  version increment and is ready for a reviewable pull request; publishing is
  intentionally out of scope.
