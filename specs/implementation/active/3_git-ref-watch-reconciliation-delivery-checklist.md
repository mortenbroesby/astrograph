# Git Ref Watch Reconciliation Delivery Checklist

> **Status:** Active — explicitly selected by the user on 2026-07-26.
>
> **Inspiration:** Code-Index-MCP combines file watching with Git ref polling.
> Astrograph adopts only a session-bound Git-ref reconciliation path; it does
> not add a daemon, shared index, network sync, or artifact publication.

**Goal:** Keep an active Astrograph watch session correct when Git checkout
state changes without dependable filesystem events.

**Architecture:** Reuse `probeGitCheckout` to seed a small, process-lifetime
ref monitor from `watchFolder`. The monitor polls only while that watch handle
is open. When its checkout identity changes, it queues the existing
`indexFolder` reconciliation behind pending file refreshes. Folder indexing
already verifies content hashes, removes disappeared files, updates checkout
mappings, and reuses matching analysis artifacts; no Git-diff planner or
second cache is needed in this slice.

**Tech Stack:** TypeScript, Node.js timers and child-process Git probe, Vitest,
and existing Astrograph storage/watch APIs.

---

## Task 1: Session-bound Git-ref monitor

**Files:**

- Create: `src/git-ref-monitor.ts`
- Modify: `src/storage.ts`
- Test: `tests/git-ref-monitor.test.ts`, `tests/git-ref-watch.test.ts`
- Document: `specs/api-design/library-api.md`, `docs/reference/cli.md`

- [x] **Step 1: Establish the baseline.**

  Run:

  ```bash
  pnpm exec vitest run tests/git-checkout.test.ts tests/watch-backend.test.ts tests/engine-behavior.test.ts
  pnpm type-lint
  ```

  Observed: focused checkout/watch and engine-behavior coverage exited `0` on
  2026-07-26. `tests/watch-boundary.test.ts` retains a sandbox-only failure:
  its macOS global-cache test writes outside this worktree, then contaminates
  subsequent fixture assertions. This delivery does not weaken or change it.

- [x] **Step 2: Add the minimal Git-ref monitor.**

  Create a testable monitor that compares the existing checkout probe result
  at a fixed 30-second interval. Treat a changed HEAD, branch reference, or
  checkout mode as a reconciliation signal. Git-unavailable and filesystem
  modes must remain non-fatal and must not create repeated refreshes. Expose a
  stop method that clears its timer and awaits no background work.

- [x] **Step 3: Reconcile changed checkout state through the existing queue.**

  Start the monitor only after `watchFolder` has completed its initial index.
  Queue `indexFolder` behind existing refresh work, persist the normal watch
  diagnostics/event, and stop the monitor during `WatchHandle.close()`. Do not
  introduce a daemon, a detached process, Git-diff refresh planning, a new MCP
  tool, or a cache/storage migration.

- [x] **Step 4: Prove changed-ref behavior.**

  Add deterministic monitor tests for no change, HEAD advance, branch/mode
  change, unavailable Git, and close. Add one watch integration proof that a
  monitor-reported checkout change refreshes the index through the queued path
  without a timing sleep. Preserve existing native-event, polling-fallback,
  rename, and deletion coverage.

- [x] **Step 5: Verify release scope and checkpoint.**

  Run:

  ```bash
  pnpm exec vitest run tests/git-ref-monitor.test.ts tests/git-checkout.test.ts tests/watch-backend.test.ts tests/engine-behavior.test.ts
  pnpm type-lint
  pnpm check:version-bump
  git diff --check
  pnpm build
  pnpm test:package-bin
  ```

  Observed on 2026-07-26: the focused monitor/checkout/backend/watch-queue
  tests, type lint, version gate, diff check, build, and package-bin smoke all
  exited `0`. The release planner selected patch `0.8.2-alpha.173`; its apply
  mode safely refused because registry verification could not reach npm, so the
  local package version was set from that computed decision. No publication or
  tag was created.
