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
pnpm --filter astrograph bench:freshness-lifecycle
pnpm --filter astrograph bench:mcp-envelopes
pnpm bench:agc1-compact-output -- --summary
```

Those cover the main performance surfaces:

- cold indexing
- warm noop refresh
- warm changed-file refresh
- `query_code` latency
- MCP envelope and compact-output serialization gates
- complete agent-visible MCP v1 envelope bytes, `cl100k_base` tokens, and
  compact-output round trips on a deterministic fixture
- the four-fixture AGC1 compact-output baseline: real serving serialization,
  exact `cl100k_base` counts, and public-decoder losslessness checks
- one-shot and repeat-read trace totals for the same four fixtures, including
  canonical response hashes, exact token counts, response recovery, and elapsed
  time without emitting source text or raw query text
- the deterministic freshness lifecycle fixture: cold/no-op/edit/rename/delete,
  checkout change/restore, unavailable Git, and explicit polling fallback

`bench:freshness-lifecycle` creates and removes its own two-file, repo-local
Git fixtures. Its JSON output records elapsed time plus `reusedFiles`,
`parsedFiles`, `removedFiles`, and `staleStatus` for each action. It is a
correctness-oriented baseline, not a real-repository throughput benchmark:
compare its counts and fallback state across changes, then use
`bench:perf:index` for larger corpus timing.

## Local Astrograph Report

Request a report explicitly when you want to inspect retained local MCP
completion aggregates:

```bash
astrograph report
astrograph report --repo /abs/repo
astrograph report --repo /abs/repo --reset --yes
```

The JSON report groups local MCP calls into latency bands and reports exact
formatted-response tokens/savings when the existing serving path already knows
them, plus full/reference counts. Reference responses are counted but excluded
from saved-token totals because they have no canonical comparison. It excludes
source, file paths, raw queries, and session IDs. Without `--repo`, repository-local storage reports the current
repository and global storage aggregates existing Astrograph repository stores;
`--repo` always narrows the report to one repository. It does not upload data
or create a dashboard. Retention follows `observability.retentionDays` (three
days by default); reset is explicit and only clears the named repository's
local event log.

## Explicit Bookmarks

Save only a symbol reference the caller explicitly chooses:

```bash
astrograph bookmark-add --repo /abs/repo --symbol <symbol-id> --intent refactor --note "optional"
astrograph bookmark-list --repo /abs/repo
astrograph bookmark-resolve --repo /abs/repo --id <bookmark-id>
astrograph bookmark-remove --repo /abs/repo --id <bookmark-id>
```

Bookmarks are inspectable repository-local JSON records containing an intent,
symbol identity, optional note, and creation time. Resolution returns only
`available` or `missing`; renamed or deleted symbols are safely missing. There
is no automatic bookmark creation, transcript capture, embedding, or
cross-repository lookup.

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
The broader [AGC1 compact-output baseline](../reviews/agc1-compact-output-baseline-2026-07-26.md)
uses four representative fixtures and protects the current serving contract
without introducing a new wire format.

The same command emits `schemaVersion: 3` trace data. Each fixture has a
one-shot exploration trace and a repeated symbol/context-read trace. It runs
against an isolated daemon, so an older globally installed Astrograph does not
contaminate the result. The summary contains only fixture/trace IDs and
aggregate measurements; omit `--summary` only when inspecting per-capture
hashes and timings locally.

With an explicit `content-references-v1` session, a known exact response is
returned as an opaque reference and otherwise falls back to full JSON. On the
recorded four-fixture corpus (2026-07-26), each repeat-read trace contained two
references, all 16 AGC1-eligible round trips recovered exactly, and references
saved 6,812 of 24,614 canonical JSON `cl100k_base` tokens (27.7%). These traces
are decision evidence for session-aware work, not a new compact wire format.

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

## Tree-sitter Grammar Cost

Parser grammars are native dependencies, so their cost must be measured rather
than assumed. On the macOS/Node 24 development baseline recorded on 2026-07-24,
cold module imports ranged from about **5 ms** (Go/C) to **40 ms** (PowerShell).
Installed package footprints varied much more: JSON was about **0.5 MB**, while
OCaml was about **200 MB**; Julia, C#, Scala, Haskell, C++, Ruby, and PHP were
also materially larger than the small grammar packages.

These figures are not cross-platform guarantees. Before a release that changes
grammar dependencies, measure the target package set on the supported Node and
platform matrix, then record:

- installed package size and packed tarball size
- cold grammar import/load time
- representative indexing latency for each added extension
- whether the native build uses a prebuild or local compiler

Do not retain a grammar package that is not exposed through the evidence-gated
language registry. See [Language Support](../reference/language-support.md) for
the current public set and deliberate exclusions.

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
- obvious secret-shaped tokens are scrubbed even when source-text redaction is
  disabled locally

For MCP output, normal source truth remains the default. Teams may opt into
the deliberately narrow, lossy policy below when their output boundary needs
it:

```json
{
  "outputPrivacy": { "redactSecretLikeValues": true }
}
```

It replaces only known secret-like token patterns with `[REDACTED:secret]` and
adds `meta.warnings: ["output_redacted_secret_like_values"]` whenever it
transforms a response. It is not a general secret detector.

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
