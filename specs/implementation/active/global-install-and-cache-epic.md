# Global Install and Cache Epic

> **Status:** In progress — Story 1 is active through the
> [Global Storage Contract Delivery Checklist](./global-storage-contract-delivery-checklist.md).
>
> **Related contracts:** [CLI API](../../api-design/cli-api.md),
> [MCP Tools](../../api-design/mcp-tools.md), and
> [Branch-Aware Incremental Index Mapping Plan](../closed/branch-aware-incremental-index-plan.md).

**Goal:** Make Astrograph available once per user and usable from every local
repository, with private global cache storage that preserves repository
isolation and repository-local configuration overrides.

**Architecture:** The first release uses a global cache *root* with one SQLite
database per canonical repository root. It does not merge repository indexes
into one database. A later optional artifact store can deduplicate immutable
analysis by the existing complete fingerprint. A single shared index database
is explicitly deferred because the primary index tables and retrieval queries
currently assume one repository per database.

**Tech Stack:** TypeScript, Node.js 22 LTS, SQLite WAL, XDG-style user data and
cache paths, pnpm, Vitest, Codex MCP configuration, and existing path/hash
helpers.

---

## Scope and Boundaries

This epic covers a user-level command/MCP setup flow, global cache location,
safe migration from repository-local state, cache lifecycle commands, and
documentation. Repository `astrograph.config.ts` remains authoritative for
repository behavior and overrides global defaults where the contract permits.

It does not add network synchronization, share data between OS users, run a
background daemon, scan repositories without an explicit request, or combine
all repositories into a single SQLite index. Cache content must remain private
to the current OS user; source content, paths, and events are not sent over the
network.

Every source-changing story uses an isolated worktree. Before each commit it
runs `pnpm check:version-bump`; the final story runs `pnpm release:plan`. A
story may start only after its child delivery checklist names exact files,
baseline commands, focused tests, final checks, and a commit checkpoint.

## Target User Experience

```text
astrograph install --global --ide codex
astrograph cli index-folder --repo /work/project-a
astrograph cache status --repo /work/project-a
```

The global MCP registration launches the globally installed `astrograph mcp`.
MCP tools continue to require `repoRoot`; the client supplies the active
workspace rather than relying on a fixed server working directory.

By default, persistent data is placed under a platform-appropriate,
user-private root. The concrete path resolver must use Node platform APIs and
be testable through an injected environment/path provider; documentation may
show XDG-style paths on Unix but must not make them the only supported layout.

## Story Map

| Order | Story | Depends on | Outcome |
| --- | --- | --- | --- |
| 1 | Global Storage Contract | None | One tested, platform-safe resolver selects repo-local or global per-repository storage. |
| 2 | Global Install and Codex Registration | Story 1 | A user can install the executable and register one global Codex MCP server without modifying a repository. |
| 3 | Per-Repository Global Cache Lifecycle | Story 1 | Indexing, retrieval, events, and diagnostics use an isolated global cache directory for each canonical repository. |
| 4 | Safe Local-Cache Migration and Fallback | Story 3 | Existing `.astrograph` state migrates or safely rebuilds without destructive ambiguity. |
| 5 | Cache Inspection, Pruning, and Removal | Story 3 | Users can inspect and remove precisely scoped cache data. |
| 6 | Optional Shared Immutable Artifact Store | Stories 3–4 | Equivalent content can reuse private immutable analysis across repository caches without sharing mutable indexes. |
| 7 | Contract, Documentation, and Release Proof | Stories 2–6 | Public behavior, privacy boundaries, and package flows are documented and verified. |

## Story 1: Global Storage Contract

**Active delivery checklist:**
[Global Storage Contract Delivery Checklist](./global-storage-contract-delivery-checklist.md)

**Goal:** Define and implement the internal storage-location contract without
changing the default behavior until the global installer opts into it.

**Files:** `src/config.ts`, `src/types/config.ts`, `src/types.ts`,
`src/storage.ts`, `tests/engine-contract.test.ts`, and
`tests/engine-behavior.test.ts`.

- [ ] Establish a typed `storageLocation` policy with `repo-local` and
  `global` modes; reject unknown values.
- [ ] Resolve a global cache root from a testable platform abstraction, then
  derive a directory using a stable hash of the canonical repository root.
- [ ] Keep the full SQLite index, repo metadata, integrity marker, storage
  version, and event file together in that repository-specific directory.
- [ ] Preserve repository-local `astrograph.config.ts` behavior and define the
  precedence of explicit CLI selection, repository config, and global default.
- [ ] Do not derive an identity from branch name, CWD, or a raw uncanonicalized
  path.

**Verification:** `pnpm exec vitest run tests/engine-contract.test.ts
tests/engine-behavior.test.ts` and `pnpm type-lint` exit `0`. Tests cover
canonical aliases, spaces, distinct repositories with equal basenames,
platform-path injection, and the unchanged repo-local compatibility mode.

## Story 2: Global Install and Codex Registration

**Goal:** Provide an explicit, idempotent global setup flow for the executable
and Codex MCP configuration.

**Files:** `src/astrograph.ts`, `src/scripts/install.ts`, `src/cli.ts`,
`src/command-registry.ts`, `tests/engine-contract.test.ts`,
`tests/cli-boundary.test.ts`, `tests/interface.test.ts`, and `README.md`.

- [ ] Add an explicit `astrograph install --global --ide codex` flow; do not
  silently write user-level configuration from repository setup.
- [ ] Write a marker-managed global Codex configuration block that invokes the
  installed executable, preserves unrelated configuration, and remains safe to
  run twice.
- [ ] Retain `astrograph init --repo …` as the repository-scoped setup path;
  it must not overwrite a global registration or an existing repository
  configuration.
- [ ] Make global installation diagnostics actionable when the executable is
  absent from `PATH`, Node is unsupported, or the global config cannot be
  written.
- [ ] Prove that every MCP call continues to receive and validate `repoRoot`.

**Verification:** Focused installer, CLI boundary, interface, and packed-bin
tests pass. A temporary user-config fixture proves idempotent managed-block
replacement and preservation of unrelated servers. Run `pnpm type-lint` and
`pnpm test:package-bin` before the checkpoint.

## Story 3: Per-Repository Global Cache Lifecycle

**Goal:** Route all ordinary engine state through the selected per-repository
global cache directory while keeping repository indexes isolated.

**Files:** `src/storage.ts`, `src/event-sink.ts`, `src/repo-meta.ts`,
`src/diagnostics.ts`, `src/doctor.ts`, `src/config.ts`,
`tests/engine-behavior.test.ts`, `tests/event-sink.test.ts`, and
`tests/watch-boundary.test.ts`.

- [ ] Index, refresh, watch, diagnostics, doctor, integrity, storage-version,
  and event-retention paths resolve through the same storage contract.
- [ ] SQLite remains one database per canonical repository root with WAL
  behavior unchanged.
- [ ] A global cache for repository A cannot serve repository B’s file,
  symbol, dependency, freshness, or event data.
- [ ] Lock contention and storage reset diagnostics name the resolved cache
  directory without exposing source content.
- [ ] The process caches that currently key by repository root stay correct
  when global and repo-local storage modes are mixed in one process.

**Verification:** Focused engine, event, watch, and diagnostics tests create
two repositories and prove isolation across index, event, stale, reset, and
watch paths. `pnpm type-lint` exits `0`.

## Story 4: Safe Local-Cache Migration and Fallback

**Goal:** Move existing repository-local cache state only when its identity and
version are safe, otherwise retain it or rebuild explicitly without data loss.

**Files:** `src/storage.ts`, `src/config.ts`, `src/doctor.ts`,
`tests/engine-behavior.test.ts`, and `tests/engine-contract.test.ts`.

- [ ] Specify an atomic, same-filesystem migration when supported, with a
  copy-and-verify fallback for cross-device moves.
- [ ] Never replace a non-empty global destination unless it is verified to
  belong to the same canonical repository and has a compatible version.
- [ ] Preserve the source cache until the destination has passed integrity and
  open-database checks; report a recoverable migration status on failure.
- [ ] Permit an explicit rebuild path, but never delete `.astrograph` as an
  implicit result of global setup.
- [ ] Cover partial migration, stale local cache, corrupt destination,
  incompatible version, and rollback/retry behavior.

**Verification:** Focused migration tests use temporary directories and prove
no source cache loss on every failed path, then run `pnpm type-lint`.

## Story 5: Cache Inspection, Pruning, and Removal

**Goal:** Give users safe, scoped visibility and control of global cache use.

**Files:** `src/cli.ts`, `src/command-registry.ts`, `src/storage.ts`,
`src/doctor.ts`, `src/mcp-contract.ts`, `src/mcp.ts`,
`tests/cli-boundary.test.ts`, `tests/engine-contract.test.ts`, and
`docs/reference/cli.md`.

- [ ] Add JSON-first `astrograph cache status --repo <path>` with resolved
  location, storage version, byte counts, and migration state.
- [ ] Add a dry-run default for prune/remove operations and require an
  explicit repository or all-cache scope plus confirmation/`--yes` to mutate.
- [ ] Reject paths outside the Astrograph cache root and resolve canonical
  repository identity before removal.
- [ ] Define retention and LRU-style pruning rules that never delete an active
  repository index during an operation.
- [ ] Keep destructive cache commands CLI-only unless a separate MCP safety
  decision explicitly authorizes them.

**Verification:** Focused CLI and storage tests prove JSON stability, dry-run
behavior, confirmation requirements, scoped deletion, active-lock refusal,
and rejection of hostile paths. Run `pnpm type-lint`.

## Story 6: Optional Shared Immutable Artifact Store

**Goal:** Reuse immutable content-addressed analysis across global caches
without introducing shared mutable repository index tables.

**Files:** `src/incremental-cache.ts`, `src/storage-schema.ts`,
`src/storage.ts`, `src/checkout-mapping.ts`, `tests/incremental-cache.test.ts`,
`tests/checkout-mapping.test.ts`, and `tests/engine-behavior.test.ts`.

- [ ] Store only complete existing fingerprint-keyed artifacts in a
  user-private global artifact location.
- [ ] Preserve one repository-local/global-per-repository SQLite index for all
  mutable files, symbols, dependency edges, readiness, and event state.
- [ ] Validate parser, summary, extraction, dependency, and schema identity
  before every reuse; a miss performs ordinary analysis.
- [ ] Make artifact writes atomic and tolerate concurrent writers; corrupt or
  unavailable artifacts fall back to analysis without failing indexing.
- [ ] Add bounded size/age pruning with reference-safe behavior and telemetry
  that reports counts, not source text.

**Verification:** Cache tests prove deterministic hits, invalidation on every
fingerprint component, cross-worktree reuse, cross-repository mutable-index
isolation, concurrent-write safety, corruption fallback, and pruning. Run
`pnpm type-lint`.

## Story 7: Contract, Documentation, and Release Proof

**Goal:** Make global behavior discoverable, privacy-safe, and proven through
the packed package before release.

**Files:** `README.md`, `docs/getting-started/first-steps.md`,
`docs/reference/cli.md`, `docs/reference/config.md`,
`docs/guides/troubleshooting.md`, `specs/api-design/cli-api.md`,
`specs/api-design/mcp-tools.md`, package smoke tests, and this epic.

- [ ] Document global versus repo-local setup, platform-specific cache-root
  discovery, migration/rebuild recovery, privacy boundary, and cleanup.
- [ ] State that the global MCP registration is one server with per-call
  `repoRoot`, not a global repository index.
- [ ] Add package-level proof that a clean user environment installs the
  package, registers Codex, indexes two repositories, and observes isolated
  cache state.
- [ ] Verify public CLI JSON and MCP contracts only change where explicitly
  documented and tested.
- [ ] Decide release eligibility using `.skills/release-decision/SKILL.md` and
  record the result in the delivery checklist before publication.

**Verification:** Run the focused suite from Stories 1–6, `pnpm type-lint`,
`pnpm test`, `pnpm test:package-bin`, `pnpm check:version-bump`,
`pnpm release:plan`, and `git diff --check`; every command exits `0`.

## Deferred: Single Shared Global Index Database

A future proposal may consolidate indexes into one SQLite database only after
it scopes `files`, `symbols`, FTS rows, imports, dependency edges, freshness,
metadata, diagnostics, and all retrieval queries by checkout/repository ID.
That work requires an API and schema design decision plus a dedicated migration
and concurrency plan. It is not an optimization permitted by this epic.

## Completion Checklist

- [ ] Global installation is opt-in, idempotent, and does not alter a project.
- [ ] Cache paths are user-private, platform-safe, and isolated per canonical
  repository.
- [ ] Existing local cache migration never silently deletes data.
- [ ] Cache control commands are scoped, previewable, and safe under locks.
- [ ] Any shared artifacts remain immutable and do not create a shared mutable
  repository index.
- [ ] Docs, API contracts, packed-package proof, version policy, and release
  decision evidence are complete.
