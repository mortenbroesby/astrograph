<p align="center">
  <img src="./assets/astrograph-logo.svg" alt="Astrograph" width="520">
</p>

<p align="center">
  Local, deterministic code intelligence for AI agents.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mortenbroesby/astrograph"><img alt="npm" src="https://img.shields.io/npm/v/%40mortenbroesby%2Fastrograph?color=0f172a&label=npm"></a>
  <a href="https://github.com/mortenbroesby/astrograph/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/mortenbroesby/astrograph/ci.yml?branch=main&label=ci"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-14b8a6"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D24-6366f1">
</p>

<p align="center">
  <a href="#install">Install</a>
  <span> | </span>
  <a href="#quick-start">Quick start</a>
  <span> | </span>
  <a href="#mcp-tools">MCP tools</a>
  <span> | </span>
  <a href="#configuration">Configuration</a>
  <span> | </span>
  <a href="#development">Development</a>
</p>

---

Astrograph indexes a local repository and gives coding agents a reliable way to
find files, inspect symbols, retrieve exact source, and assemble bounded context
without sending the whole repo through a prompt.

It is built for the boring part of agent work that has to be correct:
fresh local state, source-backed answers, predictable budgets, and clear repair
signals when the index drifts.

## Why Astrograph?

Agents are useful when they can move through a codebase with the same discipline
as a senior engineer: discover broadly, inspect exact source, then act on a small
set of relevant files. Astrograph provides that retrieval layer as a local Node
package.

| Need | Astrograph gives you |
| --- | --- |
| Find relevant code | Symbol, text, file, and outline search over a repo-local index |
| Trust the answer | Exact source retrieval with optional content verification |
| Stay inside a prompt budget | Ranked context bundles with token limits |
| Keep state fresh | Incremental file refresh, watch mode, diagnostics, and doctor reports |
| Wire into agents | Stdio MCP server, JSON CLI, and TypeScript API |

## Install

```bash
npm install -D @mortenbroesby/astrograph
```

Astrograph targets Node `24.x`. The published package exposes two bin names:

- `astrograph` is the primary command
- `ai-context-engine` is a compatibility alias

## Quick Start

Index a repository:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

Ask for relevant code:

```bash
npx astrograph cli query-code \
  --repo /absolute/path/to/repo \
  --query "where is authentication handled?" \
  --include-text
```

Retrieve exact source by symbol id:

```bash
npx astrograph cli query-code \
  --repo /absolute/path/to/repo \
  --intent source \
  --symbols "src/auth.ts#AuthService" \
  --context-lines 3 \
  --verify
```

Check freshness and repair guidance:

```bash
npx astrograph cli diagnostics --repo /absolute/path/to/repo
npx astrograph cli doctor --repo /absolute/path/to/repo
```

## What It Builds

Astrograph stores repo-local runtime state under `.astrograph/`:

```text
.astrograph/
  index.sqlite        file, symbol, import, and search metadata
  repo-meta.json      freshness, readiness, config, and support metadata
  integrity.sha256    metadata integrity sidecar
  events.jsonl        local diagnostic event stream
  raw-cache/          supporting source cache state
```

That directory is runtime state. Keep it out of npm packages and treat it like a
local cache, not as source control truth.

## MCP Tools

Run the stdio MCP server:

```bash
npx astrograph mcp
```

Astrograph exposes a small tool surface:

| Tool | Purpose |
| --- | --- |
| `index_folder` | Index every supported file under a repo root |
| `index_file` | Refresh one supported file |
| `find_files` | Find files by path, name, and glob |
| `search_text` | Search indexed or live repo text with bounded results |
| `get_file_summary` | Return deterministic summaries for indexed or discovery-only files |
| `get_project_status` | Report readiness, freshness, support tiers, and watcher health |
| `get_repo_outline` | Summarize files and symbols by language |
| `get_file_tree` | Return indexed files with language and symbol counts |
| `get_file_outline` | Return symbols for a single indexed file |
| `suggest_initial_queries` | Suggest useful entry-point queries |
| `query_code` | Unified discovery, exact source, and bounded assembly surface |
| `diagnostics` | Report storage and freshness metadata |

### Codex Setup

Astrograph can write a managed Codex MCP block into `.codex/config.toml`:

```bash
npx @mortenbroesby/astrograph install --ide codex
```

The installer resolves the repo root and preserves unrelated Codex config.

## CLI

The CLI returns JSON by default so it can be used from scripts and agents.

```bash
npx astrograph cli find-files --repo /repo --query storage
npx astrograph cli search-text --repo /repo --query "readiness"
npx astrograph cli get-file-outline --repo /repo --file src/storage.ts
npx astrograph cli get-project-status --repo /repo --scan-freshness
```

The `query-code` command is the main retrieval entry point:

```bash
npx astrograph cli query-code \
  --repo /repo \
  --intent assemble \
  --query "how does watch refresh remove deleted files?" \
  --token-budget 8000 \
  --include-references
```

## TypeScript API

```ts
import {
  diagnostics,
  indexFolder,
  queryCode,
} from "@mortenbroesby/astrograph";

const repoRoot = "/absolute/path/to/repo";

await indexFolder({ repoRoot });

const result = await queryCode({
  repoRoot,
  intent: "assemble",
  query: "where is stale index metadata handled?",
  tokenBudget: 6000,
  includeReferences: true,
});

const health = await diagnostics({ repoRoot, scanFreshness: true });

console.log(result);
console.log(health.readiness.stage);
```

## Git Refresh Helper

`astrograph git-refresh` plans refresh work for git hooks and local automation.
It chooses `index-file` for small supported source-file changes and falls back
to `index-folder` for structural changes, deletes, renames, large change sets,
or manual refreshes.

```bash
npx astrograph git-refresh manual
npx astrograph git-refresh commit --execute
npx astrograph git-refresh checkout <old-head> <new-head> --execute
npx astrograph git-refresh merge --execute
npx astrograph git-refresh push --execute
```

## Configuration

Astrograph reads optional repo defaults from `astrograph.config.json`:

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

Important defaults:

- `summaryStrategy` supports `doc-comments-first` and `signature-only`
- `storageMode` currently supports `wal`
- `watch.backend` can be `auto`, `parcel`, `node-fs-watch`, or `polling`
- `observability.redactSourceText` is enabled by default
- `performance.include` and `performance.exclude` apply to indexing, freshness
  scans, and watch-triggered subtree rescans
- explicit CLI/API options still apply, but repo-config ceilings remain enforced

## How It Works

```text
repo files
  -> deterministic discovery
  -> parser and summary pipeline
  -> SQLite index in .astrograph/
  -> CLI, MCP, and library retrieval
  -> ranked context bundles for agents
```

The index tracks files, symbols, imports, summaries, readiness, and freshness.
When live state changes, Astrograph can refresh individual files, rescan folders,
or report drift through `diagnostics` and `doctor`.

## Development

```bash
pnpm install
pnpm build
pnpm type-lint
pnpm test
pnpm test:slow
pnpm test:package-bin
```

Useful local commands:

```bash
pnpm bench:small
pnpm bench:perf -- --repo /absolute/path/to/repo --runs 10
pnpm bench:perf:serialize -- --repo /absolute/path/to/repo --runs 250
pnpm profile:index:clinic
pnpm profile:query:0x
```

Source-mode execution is available during package development:

```bash
ASTROGRAPH_USE_SOURCE=1 pnpm exec astrograph cli diagnostics --repo /repo
```

## Versioning

Astrograph treats `package.json` as the canonical version source and uses
npm-compatible prerelease semver:

```text
major.minor.patch-alpha.increment
```

- `major` for breaking MCP, storage, or library contract changes
- `minor` for backward-compatible feature additions
- `patch` for backward-compatible fixes and internal changes
- `increment` for each Astrograph commit, monotonically increasing and never reset

## Security

- Treat `.astrograph/` as local runtime state, not a place for secrets.
- Retained engine event payloads redact source-like text by default.
- Obvious secret-shaped tokens are scrubbed before event persistence.
- `doctor` surfaces obvious secret-like indexed source content as a warning.
- `diagnostics` and `doctor` report corrupted metadata sidecars and suggest rebuilds.

## Documentation

- [Performance workflow](./docs/performance.md)
- [Contributing](./CONTRIBUTING.md)
- [Release and publishing](./docs/release.md)

## License

MIT. See [LICENSE](./LICENSE).

## Author

Morten Broesby-Olsen

- GitHub: [@mortenbroesby](https://github.com/mortenbroesby)
- LinkedIn: [mortenbroesby](https://www.linkedin.com/in/morten-broesby-olsen/)
