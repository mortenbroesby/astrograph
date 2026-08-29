# Runtime Acceleration Epic

> **Status:** Active — selected as the most urgent product-performance work on
> 2026-07-27. Delivered in one branch and one pull request.

**Goal:** Make repeated local MCP work materially faster by completing the
daemon reuse path, then prove the improvement on small and representative
repositories without changing Astrograph's local-first or multi-language
contract.

**Architecture:** The existing user-local daemon remains the sole owner of
per-repository SQLite connections, Tree-sitter state, watchers, and the
optional Piscina file-analysis pool. Daemon-handled indexing runs in that
process instead of starting a disposable CLI child, while ordinary CLI
indexing keeps its existing child-process isolation. Commands for the same
canonical repository are serialized at the daemon boundary so direct indexing
cannot race with a read or watch refresh. The existing
[local-daemon checklist](./5_local-daemon-runtime-ownership-delivery-checklist.md)
remains the detailed lifecycle and trust-boundary record.

**Tech Stack:** TypeScript, Node.js 22, SQLite FTS5/WAL, Tree-sitter, Piscina,
Vitest, Tinybench, and existing Astrograph performance fixtures.

## Selection boundaries

- Do not add a duplicate watcher, globber, LRU cache, search engine, wire
  codec, or remote service. Astrograph already has native-backed equivalents.
- Do not adopt Oxc, SWC, Rust, or a Node-API module in this pull request.
  They are experiments only after a representative profile shows JS/TS parsing
  or extraction is the limiting cost.
- Do not weaken tenant isolation, private IPC authentication, or clean daemon
  shutdown in exchange for speed.
- A benchmark harness defect is fixed only when it prevents the selected
  repeatable measurements; it must not become a broad fixture redesign.

---

## Task 1: Establish the measurement and delivery baseline

**Files:**
- Create: this epic
- Modify: `pointer.md`, `specs/implementation/active/README.md`,
  `specs/implementation/roadmap.md`
- Verify: `tests/daemon-process.test.ts`, `tests/daemon-tenants.test.ts`

- [x] **Step 1: Record the serving baseline.**

  Run:

  ```bash
  pnpm exec vitest run tests/daemon-process.test.ts tests/daemon-tenants.test.ts
  pnpm bench:perf:index
  ```

  Observed: the daemon compatibility suite passed, including detached-process
  IPC. `bench:perf:index` initially failed because the copied Astrograph
  fixture loaded the source repository's self-importing TypeScript config; the
  fixture now excludes root Astrograph config files and forces repo-local
  storage, and the command completes. The host runner does not reliably retain
  its final JSON report, so Task 4 retains the timing-record gate.

- [x] **Step 2: Keep an executable, linked one-PR plan.**

  This file, the active-work index, roadmap, and pointer identify this as the
  urgent runtime focus and link to the existing daemon lifecycle checklist.

## Task 2: Reuse daemon-owned index resources

**Files:**
- Modify: `src/daemon.ts`, `src/storage.ts`
- Test: `tests/storage-runtime-mode.test.ts`, `tests/daemon-process.test.ts`

- [x] **Step 1: Add an internal daemon-runtime marker.**

  The detached daemon process sets an internal environment marker before it
  loads the engine. The marker is never a public configuration option and is
  inherited by no ordinary CLI process.

- [x] **Step 2: Index directly only in the daemon.**

  Make `indexFolder` and `indexFile` use their existing direct implementations
  when the internal daemon marker is present. Preserve child-process indexing
  and cache clearing for ordinary CLI callers. This retains the daemon's
  SQLite connection cache and Piscina pool across repeated index requests.

- [x] **Step 3: Prove the boundary.**

  Test direct daemon mode and ordinary CLI-worker mode independently, then run
  daemon IPC indexing and retrieval through a real detached process.

## Task 3: Serialize mutable daemon work per repository

**Files:**
- Modify: `src/daemon-tenants.ts`, `src/daemon.ts`
- Test: `tests/daemon-tenants.test.ts`, `tests/daemon-process.test.ts`

- [x] **Step 1: Reuse canonical repository identity.**

  Queue commands by the existing canonical repository-root resolver. Commands
  without a repository root continue directly; no repository path is added to
  normal diagnostics or the daemon state record.

- [x] **Step 2: Serialize commands without cross-repository blocking.**

  Queue all daemon commands for one repository behind the prior command, and
  always release the queue after success or failure. Different repositories
  remain independently runnable.

- [x] **Step 3: Prove ordering and recovery.**

  Test canonical aliases share one queue, distinct repositories do not, and a
  rejected command does not block the next request.

## Task 4: Benchmark evidence and merge gate

**Files:**
- Modify: `bench/**` only if Task 1 proved a narrow blocker
- Test: existing daemon and performance fixtures
- Document: this epic

- [x] **Step 1: Measure warm repeated work.**

  Record cold and warm index/query timings on the small fixture plus one
  representative fixture. A performance claim requires the same Node version,
  fixture revision, storage isolation, and at least five warm repetitions.

  Observed under Node 22.23.1 with five warm repetitions: the small fixture
  recorded cold daemon index `1129.6ms`, warm index p50/p95
  `171.4ms`/`180.2ms`, and warm outline p50/p95 `36.7ms`/`52.8ms`; the
  React-style frontend plus Java and C# monorepo fixture recorded cold index
  `1563.7ms`, warm index p50/p95 `282.0ms`/`289.5ms`, and warm outline p50/p95
  `37.4ms`/`38.4ms`. `tests/perf-scripts.test.ts` proves the command emits all
  measurements and `bench:perf:daemon` is the repeatable entrypoint.

- [x] **Step 2: Decide follow-on parser work from evidence.**

  Result: retain Tree-sitter. The proved gain is retaining the existing local
  runtime and avoiding disposable CLI indexing, not replacing a parser. Create
  a separate Oxc or native-analyzer experiment only when a profile shows
  JS/TS parsing or extraction dominates after this work.

- [x] **Step 3: Final verification and commit checkpoint.**

  Run:

  ```bash
  pnpm exec vitest run tests/storage-runtime-mode.test.ts tests/daemon-runtime.test.ts tests/daemon-server.test.ts tests/daemon-tenants.test.ts tests/daemon-process.test.ts
  pnpm type-lint
  pnpm check:version-bump
  git diff --check
  pnpm build
  pnpm test:package-bin
  ```

  Observed: the focused runtime and benchmark suite passed 14 tests; type
  checks, version policy, whitespace validation, package build, packed-bin
  smoke, and repository contract checks passed. The runtime-compatible patch
  release is `0.10.3-alpha.199`.
