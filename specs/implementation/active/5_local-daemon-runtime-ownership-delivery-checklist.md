# Local Daemon Runtime Ownership Delivery Checklist

> **Status:** Active — explicitly selected by the user on 2026-07-26.
>
> **Decision:** [ADR-009](../../architecture/adrs.md#adr-009-use-one-user-local-daemon-for-repository-runtime-ownership)

**Goal:** Replace competing process-lifetime MCP runtimes with one on-demand,
user-local daemon that owns repository cache and watch lifecycles.

**Architecture:** `astrograph mcp` remains a stdio MCP v1 server and acts as a
thin authenticated proxy. A single daemon per local user/runtime profile owns
engine instances. Each tenant remains keyed by canonical repository root and
resolved cache identity, so no mutable SQLite database, cache, source result,
or query crosses repository boundaries. The daemon listens only on a
user-private IPC endpoint, starts on demand, and exits after a five-minute idle
grace period.

**Tech Stack:** TypeScript, Node.js 22, Node `net` IPC, SQLite WAL, MCP stdio,
Vitest, and platform package smoke tests.

---

## Task 1: Runtime Record and Local IPC Contract

**Files:**

- Create: `src/daemon-protocol.ts`, `src/daemon-runtime.ts`
- Modify: `src/runtime-presence.ts`, `src/config.ts`, `src/types/diagnostics.ts`
- Test: `tests/daemon-runtime.test.ts`, `tests/daemon-protocol.test.ts`
- Document: `specs/api-design/cli-api.md`, `docs/guides/troubleshooting.md`

- [ ] **Step 1: Establish the baseline.**

  Run:

  ```bash
  pnpm type-lint
  pnpm exec vitest run tests/runtime-presence.test.ts tests/interface.test.ts
  ```

  Expected: both commands exit `0`.

- [ ] **Step 2: Define the smallest internal protocol.**

  Define versioned newline-delimited request/response records for a command ID,
  validated options, response value, and structured failure. Reject oversized,
  malformed, or incompatible records before engine dispatch. Keep this protocol
  internal: do not add an HTTP listener, public port, or new MCP tool.

- [ ] **Step 3: Add singleton state and authenticated endpoint startup.**

  Atomically create a `0o700` runtime directory and `0o600` daemon state
  record containing PID, endpoint, package/protocol version, started time, and
  random capability token. On Unix, use a socket path beneath that directory;
  on Windows, use a user-scoped named pipe. Refuse unsafe path ownership and
  clean only records whose owner PID is demonstrably dead.

- [ ] **Step 4: Prove lifecycle and trust boundaries.**

  Test concurrent startup produces one owner, a stale PID record is recovered,
  a live incompatible daemon reports an actionable error, and invalid/missing
  tokens or protocol versions never reach a command handler. Prove no record
  contains repository paths, source, queries, or result payloads.

## Task 2: Daemon-Owned Repository Tenants

**Files:**

- Create: `src/daemon-server.ts`, `src/daemon-tenants.ts`
- Modify: `src/storage.ts`, `src/index.ts`, `src/command-registry.ts`
- Test: `tests/daemon-tenants.test.ts`, `tests/daemon-server.test.ts`

- [ ] **Step 1: Establish the baseline.**

  Run:

  ```bash
  pnpm exec vitest run tests/engine-behavior.test.ts tests/watch-boundary.test.ts
  pnpm type-lint
  ```

  Expected: all commands exit `0`.

- [ ] **Step 2: Move only runtime ownership behind a tenant key.**

  Build a daemon-local tenant map keyed by canonical repository root plus the
  resolved storage identity. Route existing `COMMAND_REGISTRY` operations to
  their tenant without changing their public inputs or results. Reuse existing
  storage initialization, watch backend, Git-ref monitor, queueing, and
  close/disposal seams; do not duplicate index/reconciliation logic.

- [ ] **Step 3: Make watchers daemon-owned and reference-counted.**

  Share one watch subscription per tenant, attach it only to explicit
  `watchFolder` demand, and release it when its final client lease ends. Keep
  initial indexing and existing Git-ref reconciliation behavior intact. Do not
  add a second periodic sweep in this phase.

- [ ] **Step 4: Prove isolation and serialization.**

  Test two canonical repositories use distinct tenants and storage, concurrent
  commands for one tenant serialize with the existing queue, duplicate watch
  requests create one underlying subscription, and a tenant close releases its
  database/workers/watch without affecting the other tenant.

## Task 3: Stdio Proxy, Startup, and Idle Shutdown

**Files:**

- Create: `src/daemon-client.ts`, `src/daemon.ts`
- Modify: `src/mcp.ts`, `src/cli.ts`, `src/diagnostics.ts`, `src/runtime-presence.ts`
- Test: `tests/daemon-client.test.ts`, `tests/mcp-daemon-integration.test.ts`, `tests/cli-boundary.test.ts`
- Document: `README.md`, `docs/reference/cli.md`, `docs/guides/troubleshooting.md`, `specs/api-design/mcp-tools.md`

- [ ] **Step 1: Spawn-or-connect once from MCP startup.**

  Have the stdio entrypoint connect to a ready compatible daemon or spawn one
  and wait for its authenticated readiness record. Retain public MCP validation,
  envelope formatting, observability redaction, and stdio shutdown behavior in
  `src/mcp.ts`. A connection error must include a local recovery command and
  must never silently instantiate a competing engine.

- [ ] **Step 2: Track proxy leases and idle exit.**

  Register a lease after an authenticated client connects; release it on stdio
  closure. When the final lease and active command finish, begin a fixed
  five-minute idle timer. A new authenticated lease cancels the timer. On exit,
  close all tenant watchers, storage caches, workers, tokenizer, socket/pipe,
  and state record through one idempotent path.

- [ ] **Step 3: Extend source-free health and recovery.**

  Replace the process-count-only runtime diagnostic with additive daemon state:
  running/starting/stale/unavailable, version, tenant and client counts, and
  safe recovery guidance. Keep repository paths, IPC endpoint, token, source,
  and queries out of normal diagnostics. Add explicit `astrograph daemon
  status` and `astrograph daemon stop --yes` only if the MCP/CLI audit proves
  they are required for recovery.

- [ ] **Step 4: Prove public compatibility.**

  Run an MCP subprocess through each v1 tool family and compare its strict
  envelopes to direct engine results. Prove clean stdio shutdown releases a
  lease, idle shutdown cleans the record/endpoint, startup races leave one
  daemon, and stale records recover without a timing sleep.

## Task 4: Platform, Package, and Release Evidence

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml` only if a dependency is proven necessary
- Test: `tests/daemon-*.test.ts`, `tests/interface.test.ts`, package fixtures
- Document: `docs/reference/release.md` only if release evidence changes

- [ ] **Step 1: Keep dependencies and compatibility bounded.**

  Use Node platform APIs first. Add no dependency unless a package removes
  demonstrated cross-platform IPC complexity and passes license/package-size
  review. Preserve Node 22 support and source/built entrypoint behavior.

- [ ] **Step 2: Run final verification.**

  Run:

  ```bash
  pnpm exec vitest run tests/daemon-runtime.test.ts tests/daemon-protocol.test.ts tests/daemon-tenants.test.ts tests/daemon-client.test.ts tests/mcp-daemon-integration.test.ts tests/interface.test.ts tests/cli-boundary.test.ts
  pnpm type-lint
  pnpm check:version-bump
  git diff --check
  pnpm build
  pnpm test:package-bin
  ```

  Expected: all commands exit `0`. Record Unix and Windows IPC/package-smoke
  evidence before making the proxy default.

- [ ] **Step 3: Commit checkpoint.**

  Run:

  ```bash
  git add src tests docs specs package.json
  pnpm check:version-bump
  git commit -m "feat: add local daemon runtime ownership"
  ```

  Expected: version policy passes before commit. Use the release-decision skill
  before deciding the npm release type.
