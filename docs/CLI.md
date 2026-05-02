# Astrograph CLI

The CLI is useful for scripting, debugging, and repo automation.
All CLI output is JSON by default.

## Available command groups

- `astrograph cli ...` — retrieval and maintenance commands
- `astrograph mcp` — start the stdio MCP server
- `astrograph init` — write IDE MCP config
- `astrograph git-refresh` — compute index refresh actions

## CLI command examples

### Install profiles

Choose one profile to match how many tools you want installed:

| Profile | Included tool set | Trade-off |
|---|---|---|
| `full` | All tools (`query_code`, indexing, diagnostics) | Richest experience; largest surface |
| `some` | Query/discovery + helper tools | Strong day-to-day productivity with fewer hooks |
| `barebones` | Query + file tree + file outline | Lowest complexity and permissions |

```bash
npx @mortenbroesby/astrograph init --ide copilot --mode full
npx @mortenbroesby/astrograph init --yes --ide codex --mode some --repo /repo
npx @mortenbroesby/astrograph init --yes --ide codex --mode barebones --repo /repo
npx @mortenbroesby/astrograph init --yes --ide all --mode some --repo /repo
npx @mortenbroesby/astrograph init --yes --ide codex,copilot-cli --mode full --repo /repo
```

The interactive installer prompts for profile selection when run as:

```bash
npx @mortenbroesby/astrograph init
```

If the target repository has `package.json`, the setup run ensures Astrograph is tracked
at `latest` in dependencies (updating existing entries when needed), and adds:

```json
{
  "@mortenbroesby/astrograph": "latest"
}
```

to `devDependencies`.

After running `init`, the installer checks npm metadata and prints an update
hint when a newer version is available:
`npm install @mortenbroesby/astrograph@latest`.

For major upgrades or after MCP contract changes, clear local state and rebuild
indexing on next run:

```bash
rm -rf .astrograph
astrograph init --yes --repo /absolute/path/to/repo
```

Query indexed metadata:

```bash
npx astrograph cli query-code \
  --repo /absolute/path/to/repo \
  --intent assemble \
  --query "how does watch refresh remove deleted files?" \
  --token-budget 8000 \
  --include-references
```

Find files and search text:

```bash
npx astrograph cli find-files --repo /repo --query storage
npx astrograph cli search-text --repo /repo --query "readiness"
```

Get exact source shape:

```bash
npx astrograph cli get-file-outline --repo /repo --file src/storage.ts
```

Check status and health:

```bash
npx astrograph cli get-project-status --repo /repo --scan-freshness
npx astrograph cli diagnostics --repo /repo
npx astrograph cli doctor --repo /repo
```

## Git refresh helper

`astrograph git-refresh` plans index refresh actions for automation:

```bash
npx astrograph git-refresh manual
npx astrograph git-refresh commit --execute
npx astrograph git-refresh checkout <old-head> <new-head> --execute
npx astrograph git-refresh merge --execute
npx astrograph git-refresh push --execute
```

## Repo configuration

Astrograph reads optional defaults from `astrograph.config.json`.

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

## Development examples

```bash
pnpm install
pnpm build
pnpm type-lint
pnpm test:package-bin
```

Source-mode execution:

```bash
ASTROGRAPH_USE_SOURCE=1 pnpm exec astrograph cli diagnostics --repo /repo
```
