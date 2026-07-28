# CLI Reference

Astrograph exposes three main command surfaces:

- `astrograph install`
- `astrograph status [--repo /abs/repo] [--json]`
- `astrograph update|repair|reconfigure|uninstall ...`
- `astrograph doctor [--repo /abs/repo] [--json]`
- `astrograph cli ...`
- `astrograph git-refresh ...`

Use `astrograph mcp` when you want to run the stdio MCP server directly.

Use `astrograph --version` to print the installed package version. Use
`astrograph --diagnostics` for a no-repository global setup report: Node
compatibility, global config and cache paths, storage selection, and Copilot
CLI/Codex registration presence.

The normal MCP registration pins the exact Astrograph package version selected
during setup. It does not check for updates at startup and does not depend on a
global executable. Use the explicit `update` command when you choose to refresh
the registration.

The guided global flow can also install the optional shell command with npm. It
asks first and never makes the MCP registration depend on that step: if npm's
global prefix or PATH needs attention, setup warns and leaves the registration
usable. This is especially relevant when the repository uses pnpm, Yarn, or
another package manager.

On macOS, global setup stores `config.json` under `~/.astrograph` and creates
`~/.astrograph/cache` when a repository is first indexed. Pre-v1 releases do
not retain or migrate the former Library cache/config locations.

Prefer `npx astrograph ...` unless you have already verified another local
invocation path in your environment.

## Command Groups

- `astrograph install`
  Writes MCP configuration for supported clients.
- `astrograph install --yes --scope global --ide copilot-cli|codex`
  Registers one user-level MCP server and enables per-repository global cache
  storage. Codex writes its managed Astrograph block to `~/.codex/config.toml`;
  Copilot CLI writes only `mcpServers.astrograph` to
  `~/.copilot/mcp-config.json` (or `$COPILOT_HOME/mcp-config.json`). It does
  not modify a repository: after installing once, open any repository and
  index it or use the MCP tools directly. Normal global use does not require
  `install`, repo-local config, or a chosen cache directory.
  With no `--ide`, it installs for Copilot CLI.
- `astrograph doctor [--repo /abs/repo] [--json]`
  Verifies the current setup without writing files: repository-local MCP
  registrations, global registrations, managed agent guidance, opted-in Git
  refresh hooks, and index/retrieval health. Use this after setup or whenever
  the harness seems unavailable.
- `astrograph status [--repo /abs/repo] [--json]`
  Is the fast, read-only setup dashboard. It skips the more expensive freshness
  scan used by `doctor`. Running the bare guided command in a TTY presents the
  same state before offering explicit index, reapply, repair, reconfigure, or
  single-registration removal actions.
- `astrograph update|repair|reconfigure --yes --scope global|repository --ide ...`
  Rewrites only Astrograph-managed registration. These are deliberate actions;
  none performs an automatic update check. Each changed configuration gets a
  local timestamped backup first. Before 1.0, a detected setup-version mismatch
  is not migrated: interactive setup asks before a clean reset; automation must
  add `--reset` alongside `--yes`.
- `astrograph uninstall --yes --scope global|repository --ide ...`
  Removes only the selected Astrograph MCP registration. It leaves the optional
  global CLI and all index/cache data untouched.
- `astrograph report-issue --diagnostics-consent --message <summary>`
  Prints a sanitized, prefilled browser issue URL after explicit consent. It
  never opens a browser, sends diagnostics, or creates a GitHub issue.
  Expected input, permission, client, and environment failures instead print a
  local next step and a copyable redacted summary; only an Astrograph-owned
  failure suggests this reporting path.
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
npx --yes astrograph
```

Common profiles:

```bash
npx --yes astrograph install --yes --scope global --ide codex
npx --yes astrograph install --yes --scope repository --ide codex --repo /repo
npx --yes astrograph install --yes --scope repository --ide all --repo /repo
npx --yes astrograph install --yes --scope repository --ide codex,copilot-cli --repo /repo
```

Setup never changes `package.json`, installs dependencies, or checks npm for an
update. This keeps ordinary setup deterministic and reviewable.

When current-package validation finds obsolete Astrograph setup, it does not
use a compatibility path. Interactive setup explains why, prints numbered
phases, and asks before reset. Non-interactive setup fails without writes until
`--reset` is supplied with `--yes`:

```bash
npx --yes astrograph install --yes --reset --scope repository --ide codex --repo /repo
```

Valid client configuration is changed only in Astrograph's marked block or
named server entry. If a whole client config is malformed, Astrograph reports
the issue, saves a timestamped backup, and writes a fresh Astrograph-only file
only after reset confirmation. Use `--verbose` for detailed optional npm output.

In the guided flow, repository setup offers first indexing by default. Global
setup offers current-repository indexing separately and defaults to no.

Do not manually delete `.astrograph` state. A missing, malformed, or
incompatible storage marker causes Astrograph to archive the managed cache and
rebuild it on the next operation. If a cache needs recovery, inspect status and
use the scoped archive commands below.

## Local Astrograph Report

```bash
astrograph report
astrograph report --repo /repo
astrograph report --repo /repo --reset --yes
```

The report is local, source-free JSON. Without `--repo`, it reports the current
repository when Astrograph uses repository-local storage, or aggregates the
existing Astrograph stores for all local repositories when global storage is
selected. `--repo` always selects one repository. Reset is deliberately more
strict: it requires both `--repo` and `--yes`.

## Cache Archive and Recovery Commands

Cache archive and recovery commands emit stable JSON envelopes with
`schemaVersion: 1`. They are CLI-only; MCP has no destructive cache tools.

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
astrograph cache remove --repo /repo --yes   # archive that global cache
astrograph cache prune --all --max-bytes 1073741824       # preview only
astrograph cache prune --all --max-bytes 1073741824 --yes # archive oldest inactive caches
astrograph cache restore --repo /repo --receipt /path/to/archive.receipt.json # preview validation
astrograph cache restore --repo /repo --receipt /path/to/archive.receipt.json --yes
```

Before v1, a cache with a missing, malformed, older, or newer storage marker is
archived and rebuilt automatically; Astrograph does not migrate it for
compatibility. Every archive has a JSON receipt containing the original and
archive paths, byte count, reason, timestamp, and a copy-paste restore command.
`cache restore` validates that receipt and restores only into the absent,
canonical cache directory for the selected repository. It rejects symlinks,
out-of-root paths, malformed receipts, collisions, and active SQLite caches.

Archives are retained until you explicitly inspect and handle them; Astrograph
does not silently expire or permanently delete user cache data. Permanent
deletion is deliberately not available through Astrograph's CLI or MCP while
the format is pre-v1. `cache-remove` only accepts the canonical per-repository
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

An active `astrograph cli watch` session also polls its local Git checkout every
30 seconds. A changed HEAD, branch, or checkout mode queues a normal folder
reconciliation behind pending file changes. This monitor lives only for that
watch process; it does not create a background service.

`astrograph git-refresh` computes refresh actions for common repository events:

```bash
npx astrograph git-refresh manual
npx astrograph git-refresh commit --execute
npx astrograph git-refresh checkout <old-head> <new-head> --execute
npx astrograph git-refresh merge --execute
npx astrograph git-refresh push --execute
```

## Guided Setup and Opt-in Integrations

Use `npx --yes astrograph` in an interactive terminal to choose between
project-owned setup for the current repository and user-global setup for every
repository on the device. The global route asks for confirmation before running
an optional exact-version `npm install --global` or editing user-level client
configuration. Declining the optional shell command does not prevent MCP setup.

Repository setup remains available directly through `install` and keeps optional
integrations explicit:

```bash
npx --yes astrograph install --yes --scope repository --ide codex --agents --git-hooks
```

`--agents` adds only an Astrograph-managed guidance block to the client’s
native instruction file. It is guidance, not an unsupported universal agent
runtime hook. `--git-hooks` manages non-blocking `post-commit`,
`post-checkout`, and `post-merge` hooks that delegate to `git-refresh`. It
refuses to replace a hook owned by another tool.

## Configuration

Astrograph reads optional defaults from `astrograph.config.ts`.

```ts
import { defineConfig } from "astrograph";

export default defineConfig({
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
    "maxSymbolResults": 8,
    "maxTextResults": 100,
    "maxChildProcessOutputBytes": 1000000,
    "maxLiveSearchMatches": 100
  }
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
