# CLI Reference

Astrograph exposes three main command surfaces:

- `astrograph init`
- `astrograph cli ...`
- `astrograph git-refresh ...`

Use `astrograph mcp` when you want to run the stdio MCP server directly.

Prefer `npx astrograph ...` or `pnpm exec astrograph ...` unless you have
already verified another local invocation path in your environment.

## Command Groups

- `astrograph init`
  Writes MCP configuration for supported clients.
- `astrograph cli`
  Retrieval, indexing, diagnostics, and maintenance commands.
- `astrograph git-refresh`
  Plans index refresh actions for repository automation.
- `astrograph mcp`
  Starts the stdio MCP server.

## Output Behavior

Most CLI commands emit JSON by default. `doctor` also supports a more readable
formatted report unless you pass `--json`.

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

```bash
rm -rf .astrograph
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

## Retrieval and Health Commands

Query indexed metadata:

```bash
npx astrograph cli query-code \
  --repo /absolute/path/to/repo \
  --intent assemble \
  --query "how does watch refresh remove deleted files?" \
  --budget 8000 \
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

Inspect file shape:

```bash
npx astrograph cli get-file-outline --repo /repo --file src/storage.ts
```

Check health and readiness:

```bash
npx astrograph cli diagnostics --repo /repo --scan-freshness
npx astrograph cli doctor --repo /repo
```

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
    maxSymbolResults: 20,
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

Source-mode execution:

```bash
ASTROGRAPH_USE_SOURCE=1 pnpm exec astrograph cli diagnostics --repo /repo
```
