# Astrograph (`@mortenbroesby/astrograph`)

Local deterministic context engine for AI-assisted code exploration.

`@mortenbroesby/astrograph` is the npm package name and `astrograph` is the primary CLI command.
`ai-context-engine` still exists as a compatibility bin alias during the transition.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Security](#security)
- [How to Contribute](#how-to-contribute)
- [What's Next](#whats-next)
- [Documentation](#documentation)
- [License](#license)
- [Acknowledgements](#acknowledgements)
- [Author](#author)

## About

Astrograph is the repo-owned code retrieval layer for agent workflows in this workspace.

It exists to answer questions like:

- where is this behavior implemented?
- what symbols look relevant to this query?
- show me the exact source for these symbols
- give me a bounded bundle of the most relevant code under a token budget
- is the local index fresh, and is watch mode healthy?

It does that by indexing a repo locally, storing file and symbol metadata in SQLite, and exposing
retrieval surfaces through a stdio MCP server, JSON CLI, and small TypeScript API.

The package is currently a local-first npm alpha:

- it exists first to support workflow inside this repo and similar local agent setups
- it is MIT-licensed, but that is not a support commitment
- it is not positioned as a supported hosted product or managed service
- normal indexing, CLI, MCP, and library use target Node only
- Bun is only required when you explicitly invoke the observability server

## Features

- Repo-local indexing under `.astrograph/`
- Exact symbol and source retrieval as the primary truth layer
- Ranked, token-budgeted context assembly for agent use
- `query_code` umbrella surface for discovery, source retrieval, and assembly
- Graph-aware symbol references for stronger importer follow-up than file-level importers alone
- One-hop dependent importer refresh during incremental exporter updates
- `diagnostics` and `doctor` flows for freshness, health, and repair guidance
- Watch-mode refresh with `@parcel/watcher`, `fs.watch`, and polling fallback paths
- Live-disk text fallback via ripgrep when discovery text search is requested on
  a missing or stale index
- Explicit support-tier reporting for status and file-summary flows, including
  deterministic discovery summary strategies for Markdown, JSON, YAML, SQL,
  shell, and plain-text fallbacks
- Serialization benchmark gate for evaluating stable machine-result envelopes
- Stdio MCP server backed by the official MCP TypeScript SDK
- CLI and library entry points for local debugging, benchmarks, and packaging checks
- Local observability server for recent events and watch health

## Tech Stack

- `TypeScript`
- `Node 24`
- `SQLite` via `better-sqlite3`
- `oxc-parser` as the primary parser
- temporary `tree-sitter` fallback behind the parser facade
- `@modelcontextprotocol/sdk` for the MCP server surface
- `tsup` for build output
- `Vitest` and package-local benchmark scripts for verification
- `Bun` for the observability server runtime

## Architecture

Astrograph is built around a local repo index and a narrow retrieval contract.

High-level flow:

1. Index a repo into `.astrograph/` at the repo root.
2. Persist file, symbol, import, and metadata state in SQLite.
3. Serve exact retrieval and ranked assembly from that indexed state.
4. Expose the same core capabilities through CLI, MCP, and library entry points.

Runtime artifacts for a given repo live under `.astrograph/`:

- `index.sqlite` for the current index backend
- `repo-meta.json` and `integrity.sha256` for repo-local metadata
- `events.jsonl` for retained local observability events
- `raw-cache/` for supporting source cache state

Package build output stays in `dist/`. Repo-root `.astrograph/` data is runtime state, not npm
publish output.

## Project Structure

```text
src/
  index.ts                Library entry point
  cli.ts                  JSON CLI entry point
  mcp.ts                  Stdio MCP server
scripts/
  ai-context-engine.mjs   Bin wrapper for built/runtime selection
  install.mjs             Standalone installer flow
  observability-server.mjs
observability/            Local observability frontend and config
bench/                    Benchmark sources
tests/                    Package tests
dist/                     Built JavaScript and type output
```

## Getting Started

### Requirements

- Node `24.x`
- `pnpm`

### Install In This Monorepo

```bash
pnpm install
pnpm build
```

### Common Commands

```bash
pnpm build
pnpm test
pnpm type-check
pnpm bench:small
pnpm exec astrograph mcp
pnpm exec astrograph observability --repo /abs/repo
pnpm exec astrograph open-observability --repo /abs/repo
pnpm exec astrograph git-refresh manual --execute
```

### Basic CLI Examples

```bash
pnpm exec astrograph cli index-folder --repo /abs/repo
pnpm exec astrograph cli query-code --repo /abs/repo --query Greeter --include-text
pnpm exec astrograph cli query-code --repo /abs/repo --intent source --symbols id1,id2 --context-lines 2 --verify
pnpm exec astrograph cli diagnostics --repo /abs/repo
pnpm exec astrograph cli doctor --repo /abs/repo
```

### Git Refresh Helper

`astrograph git-refresh` provides the git-hook refresh planner that was
originally embedded in the playground repo. It can run in the background by
default or synchronously with `--execute`.

```bash
pnpm exec astrograph git-refresh manual
pnpm exec astrograph git-refresh commit --execute
pnpm exec astrograph git-refresh checkout <old-head> <new-head> --execute
pnpm exec astrograph git-refresh merge --execute
pnpm exec astrograph git-refresh push --execute
```

The helper chooses `index-file` for small supported source-file changes and
falls back to `index-folder` for structural changes, deletes, renames, large
change sets, or manual refreshes.

### Verification Baseline

```bash
pnpm type-check
pnpm test
pnpm test:package-bin
```

## Configuration

### Interfaces

You can use Astrograph through:

- the stdio MCP server in `src/mcp.ts`
- the JSON CLI in `src/cli.ts`
- the library exports in `src/index.ts`
- the Bun-backed observability server in `scripts/observability-server.mjs`

### Runtime Notes

- Built JavaScript in `dist/` is the default runtime path.
- The `astrograph` wrapper prefers `dist/*` when those files exist.
- Source-mode execution is an explicit dev opt-in:

```bash
ASTROGRAPH_USE_SOURCE=1 pnpm exec astrograph ...
```

### Repo Config

Astrograph reads optional repo-local defaults from `astrograph.config.json`:

```json
{
  "summaryStrategy": "doc-comments-first",
  "storageMode": "wal",
  "observability": {
    "retentionDays": 3,
    "redactSourceText": true
  },
  "ranking": {
    "exactName": 1000,
    "filePathContains": 120,
    "exportedBonus": 20
  },
  "performance": {
    "include": ["src/**/*.{ts,tsx,js,jsx}"],
    "exclude": ["**/*.test.ts"],
    "fileProcessingConcurrency": "auto",
    "workerPool": {
      "enabled": false,
      "maxWorkers": "auto"
    }
  },
  "watch": {
    "backend": "auto",
    "debounceMs": 100
  },
  "limits": {
    "maxFilesDiscovered": 100000,
    "maxFileBytes": 250000,
    "maxSymbolsPerFile": 2000,
    "maxSymbolResults": 20,
    "maxTextResults": 100,
    "maxChildProcessOutputBytes": 1000000,
    "maxLiveSearchMatches": 100
  }
}
```

- `watch.backend` can force `parcel`, `node-fs-watch`, or `polling`
- `watch.debounceMs` sets the default debounce window for `watchFolder()`
- `storageMode` currently supports `wal`; the config is explicit so storage behavior
  is durable and inspectable through diagnostics and doctor output
- `ranking` lets you tune the shared symbol scoring weights used by `searchSymbols()`
  and ranked-context seed selection
- `observability.redactSourceText` keeps observability event payloads privacy-safe
  by default while still allowing an explicit local opt-out
- `observability.retentionDays` keeps local observability history for a bounded
  time window; the default is 3 days
- MCP observability token savings are heuristic by default and recalculated with
  the benchmark tokenizer every 10th matching tool event
- `performance.include` and `performance.exclude` apply the compiled picomatch
  path matcher to indexed discovery, freshness scans, and watch-triggered subtree rescans
- `performance.workerPool.enabled` opt-ins CPU-heavy parse/hash analysis through
  Piscina worker threads during folder indexing
- `performance.workerPool.maxWorkers` bounds the worker pool when that path is
  enabled
- `limits.maxLiveSearchMatches` caps ripgrep fallback matches when the index is
  missing or stale
- `limits.maxChildProcessOutputBytes` caps ripgrep fallback stdout before the
  child is terminated
- `limits.maxFilesDiscovered` fails discovery when the supported-file set grows
  beyond the configured ceiling
- `limits.maxFileBytes` excludes oversized files from discovery and indexing
- `limits.maxSymbolsPerFile` excludes symbol-explosive files from indexing once
  parsing reveals more than the configured ceiling
- `limits.maxSymbolResults` caps symbol retrieval, including over-large explicit
  `searchSymbols()` and `query_code` discover requests
- `limits.maxTextResults` caps indexed text retrieval and also bounds live ripgrep
  fallback together with `limits.maxLiveSearchMatches`
- explicit library or CLI options still apply, but repo-config ceilings remain enforced

### Standalone Codex Install

Astrograph supports a standalone Codex bootstrap flow:

```bash
npx @mortenbroesby/astrograph install --ide codex
```

That installer resolves the repo root, writes a managed Astrograph MCP block into
`.codex/config.toml`, and preserves unrelated Codex config content.

### Versioning

Astrograph treats `package.json` as its canonical version source and uses npm-compatible prerelease
semver:

- `major.minor.patch-alpha.increment`

Those values map to:

- `major` for breaking MCP, storage, or library contract changes
- `minor` for backward-compatible feature additions
- `patch` for backward-compatible fixes and internal changes
- `increment` for each Astrograph commit, monotonically increasing and never reset

## Security

- Treat `.astrograph/` as local runtime state, not a place for secrets.
- Do not store credentials in observability output or test fixtures.
- Observability event payloads redact source-like text by default and always scrub
  obvious secret-shaped tokens before they are persisted.
- `doctor` emits non-blocking warnings when indexed source contains obvious
  secret-like content so local leaks are surfaced without being treated as index drift.
- `diagnostics` and `doctor` also flag relative imports whose target files still
  exist but no longer export the named symbols the importer expects.
- `diagnostics` and `doctor` report corrupted or tampered repo-local metadata sidecars
  and suggest rebuilding instead of silently treating them as missing state.
- Keep repo-root runtime artifacts separate from package build output in `dist/`.
- Prefer local-only observability when debugging repo indexing and watch behavior.

## How to Contribute

- Keep the MCP surface narrow and source-anchored.
- Optimize for exact retrieval first; ranking and assembly should build on top of exact source.
- Preserve the repo-local runtime contract under `.astrograph/`.
- When changing package behavior or workflow, update this README and related repo docs in the same
  change.
- If staged package changes require a version bump, follow the package's version policy.

Useful local commands:

- `pnpm test`
- `pnpm type-check`
- `pnpm bench:perf -- --repo /abs/repo --runs 10`
- `pnpm bench:perf:serialize -- --repo /abs/repo --runs 250`
- `pnpm profile:index:clinic`
- `pnpm profile:query:0x`
- `pnpm mcp`

## Profiling

Use the profiling scripts when baseline benchmarks show a regression and you need
stack-level evidence instead of just timings.

- `Clinic Flame`:
  `pnpm profile:index:clinic`
  Use this first for cold indexing and warm refresh analysis from
  `scripts/perf-index.mjs`. It writes collected data under
  `.profiles/clinic/index/`.
- `Clinic Doctor`:
  `pnpm profile:query:clinic`
  Use this when `query_code` latency regresses and you want a higher-level event
  loop and CPU diagnosis. It writes under
  `.profiles/clinic/query/`.
- `0x`:
  `pnpm profile:index:0x` or
  `pnpm profile:query:0x`
  Use this when you specifically want a flamegraph artifact and direct stack-hot
  paths. It writes under `.profiles/0x/`.

Notes:

- `scripts/perf-index.mjs` already includes cold index, warm noop refresh, and
  warm changed-file refresh in one run, so the index profilers cover both cold
  and warm paths.
- Compare before and after dependency changes by running the same profiling
  command on both revisions and comparing the generated HTML/report artifacts in
  `.profiles/`.
- Profiling artifacts are intentionally gitignored.

## What's Next?

Current priorities are clear:

- keep proving the repo-owned retrieval path on normal agent tasks
- strengthen freshness, observability, and repair flows
- keep the source of truth local, deterministic, and cheap to inspect
- continue narrowing the gap between discovery, exact retrieval, and bounded assembly

## Documentation

The main entry points are:

- this README for package overview and usage
- [docs/performance.md](./docs/performance.md) for dependency-specific
  performance workflow and profiling guidance
- [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and contribution workflow
- [docs/release.md](./docs/release.md) for release and trusted publishing workflow

Core commands and surfaces worth knowing:

- `query_code` for discovery, source retrieval, and bounded assembly
- `diagnostics` for metadata-first health, freshness, and readiness-stage reporting
- `doctor` for operator-facing warnings and suggested repair actions
- `get_project_status` for the operator-facing summary of discovery-ready,
  deepening, and deep-retrieval-ready state

## License

MIT. See [LICENSE](./LICENSE).

## Acknowledgements

- `Oxc` for the primary parser path
- `SQLite` and `better-sqlite3` for the local index backend
- the official `Model Context Protocol` TypeScript SDK for the MCP surface
- `Bun` for the local observability server runtime

---

## Author

**Morten Broesby-Olsen** (`mortenbroesby`)

- GitHub: [@mortenbroesby](https://github.com/mortenbroesby)
- LinkedIn: [mortenbroesby](https://www.linkedin.com/in/morten-broesby-olsen/)

---

<p align="center">
  Made with ☕ and ⚡️ by Morten Broesby-Olsen
</p>
