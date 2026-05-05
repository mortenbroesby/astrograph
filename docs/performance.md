# Astrograph Performance Workflow

This package uses a small set of targeted dependencies to improve specific
performance paths without changing the core storage model.

## Dependency Map

- `fdir`
  Affects cold file discovery, subtree discovery, freshness scans, and watch
  subtree rescans.
- `picomatch`
  Affects include/exclude path filtering by compiling glob matchers once and
  reusing them across discovery calls.
- `@node-rs/xxhash`
  Affects routine change detection and internal fingerprints:
  content fingerprints, symbol signature hashes, import hashes, and directory
  snapshot hashes.
- `p-map`
  Affects bounded concurrent file analysis during folder indexing.
- `piscina`
  Affects optional worker-pool parse/hash analysis when
  `performance.workerPool.enabled` is turned on.
- `@parcel/watcher`
  Affects native watch-mode event delivery before Astrograph falls back to
  `fs.watch` or polling.
- `@vscode/ripgrep`
  Affects live-disk text fallback when discovery text search is requested on a
  missing or stale index.
- `fast-json-stringify`
  Currently kept behind a benchmark gate for machine-result serialization
  evaluation. It is not the default public JSON path today.
- `clinic` and `0x`
  Affect profiling only. They do not change runtime behavior.

## Benchmarks

Run baseline timing commands before and after a dependency-oriented change:

```bash
pnpm --filter astrograph bench:perf -- --repo /abs/repo --runs 10
pnpm --filter astrograph bench:perf:index -- --repo /abs/repo
pnpm --filter astrograph bench:perf:query -- --repo /abs/repo --runs 25
pnpm --filter astrograph bench:perf:serialize -- --repo /abs/repo --runs 250
```

Use these to compare:

- cold indexing
- warm noop refresh
- warm changed-file refresh
- `query_code` latency
- serialization benchmark gates

## Profilers

Use profilers only after a benchmark shows a regression worth investigating.

### Clinic

```bash
pnpm --filter astrograph profile:index:clinic
pnpm --filter astrograph profile:query:clinic
```

Use Clinic first when you want higher-level diagnosis:

- `profile:index:clinic` for cold index and warm refresh behavior through
  `scripts/perf-index.mjs`
- `profile:query:clinic` for `query_code` event-loop and CPU diagnosis through
  `scripts/perf-query.mjs`

Artifacts are written under:

- `.profiles/clinic/index/`
- `.profiles/clinic/query/`

### 0x

```bash
pnpm --filter astrograph profile:index:0x
pnpm --filter astrograph profile:query:0x
```

Use `0x` when you specifically want flamegraph output and direct stack hot-path
inspection.

Artifacts are written under:

- `.profiles/0x/index/`
- `.profiles/0x/query/`

## Worker Mode

Worker-pool parsing is optional and disabled by default.

Disable it explicitly in `astrograph.config.json`:

```json
{
  "performance": {
    "workerPool": {
      "enabled": false
    }
  }
}
```

You can also cap concurrency directly:

```json
{
  "performance": {
    "fileProcessingConcurrency": 1,
    "workerPool": {
      "enabled": false
    }
  }
}
```

That is the simplest way to compare worker and non-worker behavior on the same
repo.

## Watch Backend Fallback

Watch mode prefers the configured native backend:

1. `parcel` when explicitly requested and available
2. `node-fs-watch` when requested and available
3. `auto` resolution across native backends
4. polling fallback when native watching is unavailable or fails at runtime

Polling remains the safety net. Diagnostics and watch events record the active
backend so regressions are visible without guesswork.

## Observability Privacy

Retained engine event payloads are privacy-safe by default.

- `observability.redactSourceText` defaults to `true`
- `observability.retentionDays` defaults to `3`, so local event history is kept
  for at least three days without growing unbounded forever
- source-like event fields such as `source`, `content`, `preview`, and `text`
  are redacted before they are written to `events.jsonl`
- MCP token savings use `tokenx` as the default guestimate path and rerun every
  10th matching tool event through `cl100k_base` for an exact comparison sample
- obvious secret-shaped tokens are scrubbed even when source-text redaction is
  explicitly disabled for local debugging

## Hashing Policy

Astrograph uses `xxHash` only for non-security fingerprints:

- file content fingerprints
- symbol signature fingerprints
- import graph fingerprints
- directory snapshot fingerprints

It does not use `xxHash` for integrity verification. Integrity stays on
`SHA-256`, because that path is about source verification rather than cheap
change detection.

## SQLite Write Model

SQLite writes remain single-writer and transactional even when discovery,
hashing, and parsing become more concurrent.

That constraint is intentional:

- it preserves deterministic write ordering
- it avoids multi-writer contention in SQLite
- it keeps recovery and retained event logging simpler
- it allows worker and concurrency slices to speed up CPU-bound analysis without
  changing the durability model

The optimization strategy is therefore:

1. discover faster
2. hash and parse faster
3. batch analysis safely
4. keep persistence serialized
