# Performance Guide

This page is for the moments when Astrograph is already useful and you need to
understand whether it is fast enough, what affects that, and how to measure it
without guessing.

## When To Care

Reach for this guide when:

- indexing feels slow on a real repository
- query latency regresses after a change
- you are comparing worker and non-worker modes
- you want benchmark evidence before changing dependencies or internals

If Astrograph feels fine in day-to-day use, you probably do not need this page
yet.

## What To Measure First

Use the benchmark commands before changing code or dependencies:

```bash
pnpm --filter astrograph bench:perf -- --repo /abs/repo --runs 10
pnpm --filter astrograph bench:perf:index -- --repo /abs/repo
pnpm --filter astrograph bench:perf:query -- --repo /abs/repo --runs 25
pnpm --filter astrograph bench:perf:serialize -- --repo /abs/repo --runs 250
pnpm --filter astrograph bench:freshness-lifecycle
pnpm --filter astrograph bench:mcp-envelopes
```

Those cover the main performance surfaces:

- cold indexing
- warm noop refresh
- warm changed-file refresh
- `query_code` latency
- serialization gates
- complete agent-visible MCP v1 envelope bytes, `cl100k_base` tokens, and
  compact-output round trips on a deterministic fixture
- the deterministic freshness lifecycle fixture: cold/no-op/edit/rename/delete,
  checkout change/restore, unavailable Git, and explicit polling fallback

`bench:freshness-lifecycle` creates and removes its own two-file, repo-local
Git fixtures. Its JSON output records elapsed time plus `reusedFiles`,
`parsedFiles`, `removedFiles`, and `staleStatus` for each action. It is a
correctness-oriented baseline, not a real-repository throughput benchmark:
compare its counts and fallback state across changes, then use
`bench:perf:index` for larger corpus timing.

## MCP Output Budget

`bench:mcp-envelopes` creates and removes its own deterministic two-file
TypeScript fixture. It exercises real MCP dispatch for successful, empty,
strict-error, structural, and bounded-context responses, then prints the full
JSON envelope with bytes, `cl100k_base` tokens, and elapsed time.

It also compares the public, lossless `agc1` compact JSON format for
`search_symbols`, `get_file_tree`, and `get_file_outline`. On the recorded
fixture, compact output saved 55.6%, 57.4%, 66.7%, and 59.0% respectively for
successful search, empty search, tree, and outline responses. Ordinary JSON is
still the default. See [MCP Tools](../../specs/api-design/mcp-tools.md) for the opt-in
`format: "compact" | "auto"` contract and reference decoder.

## What Actually Moves Performance

Astrograph uses a small set of targeted dependencies to accelerate specific
paths without changing the core local-storage model.

- `fdir`
  Cold discovery, subtree discovery, freshness scans, and subtree rescans.
- `picomatch`
  Include/exclude filtering by compiling glob matchers once and reusing them.
- `@node-rs/xxhash`
  Cheap non-security fingerprints for files, symbols, imports, and directory
  snapshots.
- `p-map`
  Bounded concurrent file analysis during indexing.
- `piscina`
  Optional worker-pool parse and hash analysis when worker mode is enabled.
- `@parcel/watcher`
  Native watch-mode event delivery before fallback paths.
- `@vscode/ripgrep`
  Live-disk text fallback when search is requested against a missing or stale
  index.
- `fast-json-stringify`
  Serialization benchmarking candidate, not the default public JSON path.

Profiling-only tools:

- `clinic`
- `0x`

## Profiling

Only profile after a benchmark shows something worth investigating.

### Clinic

```bash
pnpm --filter astrograph profile:index:clinic
pnpm --filter astrograph profile:query:clinic
```

Use Clinic first when you want higher-level diagnosis:

- `profile:index:clinic` for cold index and warm refresh behavior
- `profile:query:clinic` for `query_code` CPU and event-loop diagnosis

Artifacts land under:

- `.profiles/clinic/index/`
- `.profiles/clinic/query/`

### 0x

```bash
pnpm --filter astrograph profile:index:0x
pnpm --filter astrograph profile:query:0x
```

Use `0x` when you want flamegraphs and hot-path inspection directly.

Artifacts land under:

- `.profiles/0x/index/`
- `.profiles/0x/query/`

## Worker Mode

Worker-pool parsing is optional and off by default.

Disable it explicitly in `astrograph.config.ts`:

```ts
import { defineConfig } from "astrograph";

export default defineConfig({
  performance: {
    workerPool: {
      enabled: false,
    },
  },
});
```

To cap concurrency directly:

```ts
import { defineConfig } from "astrograph";

export default defineConfig({
  performance: {
    fileProcessingConcurrency: 1,
    workerPool: {
      enabled: false,
    },
  },
});
```

That is the simplest way to compare worker and non-worker behavior on the same
repository.

## Watch Backend Fallback

Watch mode prefers the configured native backend in this order:

1. `parcel` when explicitly requested and available
2. `node-fs-watch` when requested and available
3. `auto` resolution across native backends
4. polling fallback when native watching is unavailable or fails

Diagnostics and watch events record the active backend so regressions stay
visible.

## Observability and Privacy

Retained engine event payloads are privacy-safe by default.

- `observability.redactSourceText` defaults to `true`
- `observability.retentionDays` defaults to `3`
- source-like fields such as `source`, `content`, `preview`, and `text` are
  redacted before being written to `events.jsonl`
- MCP token savings use `tokenx` as the default guestimate path and rerun every
  tenth matching tool event through `cl100k_base` for an exact comparison sample
- obvious secret-shaped tokens are scrubbed even when source-text redaction is
  disabled locally

## Storage and Hashing Constraints

Astrograph uses `xxHash` only for non-security fingerprints:

- file content fingerprints
- symbol signature fingerprints
- import graph fingerprints
- directory snapshot fingerprints

Integrity stays on `SHA-256`.

SQLite writes remain single-writer and transactional even when discovery,
hashing, and parsing become more concurrent. That constraint is intentional:

- deterministic write ordering
- less SQLite contention
- simpler recovery behavior
- faster CPU-bound analysis without changing the durability model
