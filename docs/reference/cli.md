# CLI Reference

Astrograph exposes three main command surfaces:

- `astrograph init`
- `astrograph install --global [--ide copilot-cli|codex]`
- `astrograph cli ...`
- `astrograph git-refresh ...`

Use `astrograph mcp` when you want to run the stdio MCP server directly.

Use `astrograph --version` to print the installed package version. Use
`astrograph --diagnostics` for a no-repository global setup report: Node
compatibility, global config and cache paths, storage selection, and Copilot
CLI/Codex registration presence.

If these commands show an older installed version than expected, update first:

```bash
npm install --global astrograph@latest
```

On macOS, global setup stores `config.json` under `~/.astrograph` and creates
`~/.astrograph/cache` when a repository is first indexed. Pre-v1 releases do
not retain or migrate the former Library cache/config locations.

Prefer `npx astrograph ...` unless you have already verified another local
invocation path in your environment.

## Command Groups

- `astrograph init`
  Writes MCP configuration for supported clients.
- `astrograph install --global [--ide copilot-cli|codex]`
  Registers one user-level MCP server and enables per-repository global cache
  storage. Codex writes its managed Astrograph block to `~/.codex/config.toml`;
  Copilot CLI writes only `mcpServers.astrograph` to
  `~/.copilot/mcp-config.json` (or `$COPILOT_HOME/mcp-config.json`). It does
  not modify a repository: after installing once, open any repository and
  index it or use the MCP tools directly. Normal global use does not require
  `init`, repo-local config, or a chosen cache directory.
  With no `--ide`, it installs for Copilot CLI.
- `astrograph cli`
  Retrieval, indexing, diagnostics, and maintenance commands.
- `astrograph git-refresh`
  Plans index refresh actions for repository automation.
- `astrograph mcp`
  Starts the stdio MCP server.

## Output Behavior

Most CLI commands emit JSON by default. `doctor` also supports a more readable
formatted report unless you pass `--json`.

## File Support

JavaScript modules (`.js`, `.cjs`, `.mjs`) are graph-capable source files, like
TypeScript. Markdown (`.md`), YAML (`.yaml`, `.yml`), and text (`.txt`) are
discovery-only: use `find-files`, `search-text`, and `get-file-summary` for
them, but do not pass them through a `language` filter or expect symbols,
outlines, or dependency-graph results. `get-project-status` and `diagnostics`
return the full registry and available tools for each tier.

See [File Support Tiers](../getting-started/concepts.md#file-support-tiers) for
the complete current extension matrix and summary behavior.

## Setup Commands

Interactive install:

```bash
npx astrograph init
```

Common profiles:

```bash
npx astrograph init --ide copilot
npx astrograph init --yes --ide codex --repo /repo
npx astrograph init --yes --ide all --repo /repo
npx astrograph init --yes --ide codex,copilot-cli --repo /repo
```

If the target repository has a `package.json`, setup ensures Astrograph is
tracked at `latest` in `devDependencies`.

After setup, Astrograph checks npm metadata and prints an update hint when a
newer version is available:

```bash
npm install astrograph@latest
```

If you need to clear local state and rebuild after a major contract change:

Use the command for your terminal, then run `astrograph init --yes`.

```bash
# Git Bash
rm -rf .astrograph
```

```powershell
# PowerShell
Remove-Item -Recurse -Force .astrograph
```

```bat
:: cmd.exe
rmdir /s /q .astrograph
```

## Global Cache Commands

Global cache commands emit stable JSON envelopes with `schemaVersion: 1`.
They are CLI-only; MCP has no destructive cache tools.

`cache status` includes the canonical repository, selected storage location,
and the persisted checkout that populated that cache. `checkout` is `null`
until the repository has been indexed; otherwise it reports its Git mode,
branch/head/worktree identity, diagnostic, and indexed time.

For a globally installed Codex or Copilot CLI client, use these recovery
commands before editing or deleting cache files manually. They operate on the
selected repository's isolated global cache, not a shared cross-repository
index. Re-run the matching `astrograph install --global --ide ...` command to
repair a managed client entry without changing unrelated user configuration.

```bash
astrograph cache status --repo /repo
astrograph cache remove --repo /repo         # preview only
astrograph cache remove --repo /repo --yes   # remove that global cache
astrograph cache prune --all --max-bytes 1073741824       # preview only
astrograph cache prune --all --max-bytes 1073741824 --yes # prune oldest inactive caches
```

Before v1, a cache with a missing, malformed, older, or newer storage marker is
discarded and rebuilt automatically; Astrograph does not migrate or preserve it
for compatibility. `cache-remove` only accepts the canonical per-repository
directory below the current user’s Astrograph cache root and requires `--yes`
to mutate.

`cache prune` is intentionally whole-user-cache scoped: it requires `--all`
and a byte target, sorts repository cache directories by last modification time
then stable identity, skips active SQLite databases, and stops at the requested
target. Symlinked cache paths are rejected rather than traversed.

## Retrieval and Health Commands

Query indexed metadata:

```bash
npx astrograph cli get-task-context \
  --repo /absolute/path/to/repo \
  --query "how does watch refresh remove deleted files?" \
  --payload-token-budget 1200 \
  --include-references
```

Create or refresh the full local index:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

Find files and search text:

```bash
npx astrograph cli search-text --repo /repo --query "readiness"
```

Find symbols:

```bash
npx astrograph cli search-symbols --repo /repo --query diagnostics
```

`search-symbols` returns a bounded JSON envelope rather than a bare array:

```json
{
  "items": [],
  "truncated": false,
  "refinementHints": [],
  "tokenSavings": {
    "unit": "tokens",
    "tokenizer": "cl100k_base",
    "baseline": "all_ranked_symbol_items"
  }
}
```

When `truncated` is true, apply the deterministic `refinementHints` (a lower
`limit`, `filePattern`, or `kind`) before fetching more source. `tokenSavings`
compares returned symbol items with all ranked matches before the result cap.

`query-code` is a CLI and TypeScript-library convenience workflow. It is
intentionally not an MCP tool; MCP clients should compose `search_symbols`,
`get_symbol_source`, and `get_task_context` instead. Use `get_task_context`
only when the narrower discovery/source path cannot answer the task within its
declared payload-token budget.

`get-symbol-source` returns UTF-8 source provenance for every item: a
SHA-256 hash of the returned source, zero-based/end-exclusive byte range,
one-based line range, parser metadata, and `indexed-snapshot` freshness. Use
`diagnostics --scan-freshness` when deciding whether disk content has changed
since indexing.

Inspect file shape:

```bash
npx astrograph cli get-file-outline --repo /repo --file src/storage.ts
```

Check health and readiness:

```bash
npx astrograph cli diagnostics --repo /repo --scan-freshness
npx astrograph cli doctor --repo /repo
```

`diagnostics`, `get-project-status`, and `doctor --json` include
`retrievalHealth`. Treat `safe` as fully usable, `degraded` as limited to its
listed `safeOperations`, and `unsafe` as requiring the included recovery action
before trusting retrieval. The formatted doctor report prints the same guidance.

## Git Refresh

`astrograph git-refresh` computes refresh actions for common repository events:

```bash
npx astrograph git-refresh manual
npx astrograph git-refresh commit --execute
npx astrograph git-refresh checkout <old-head> <new-head> --execute
npx astrograph git-refresh merge --execute
npx astrograph git-refresh push --execute
```

## Configuration

Astrograph reads optional defaults from `astrograph.config.ts`. Legacy
`astrograph.config.json` is still read when no TypeScript config exists.

```ts
import { defineConfig } from "astrograph";

export default defineConfig({
  summaryStrategy: "doc-comments-first",
  storageMode: "wal",
  observability: {
    retentionDays: 3,
    redactSourceText: true,
  },
  ranking: {
    exactName: 1000,
    filePathContains: 120,
    exportedBonus: 20,
  },
  performance: {
    include: ["src/**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/*.test.ts"],
    fileProcessingConcurrency: "auto",
    workerPool: {
      enabled: false,
      maxWorkers: "auto",
    },
  },
  watch: {
    backend: "auto",
    debounceMs: 100,
  },
  limits: {
    maxFilesDiscovered: 100000,
    maxFileBytes: 250000,
    maxSymbolsPerFile: 2000,
    maxSymbolResults: 8,
    maxTextResults: 100,
    maxChildProcessOutputBytes: 1000000,
    maxLiveSearchMatches: 100,
  },
});
```

## Development Commands

```bash
pnpm install
pnpm build
pnpm type-lint
pnpm test
pnpm test:package-bin
```

Source-mode execution during local development:

```bash
ASTROGRAPH_USE_SOURCE=1 pnpm exec astrograph cli diagnostics --repo /repo
```
