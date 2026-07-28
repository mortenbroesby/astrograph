# Troubleshooting

Start with the read-only health check. It reports the relevant setup, index, or
retrieval problem and the next safe command.

```bash
npx --yes astrograph doctor --repo /absolute/path/to/repo
```

For detailed state, use:

```bash
npx --yes astrograph cli diagnostics --repo /absolute/path/to/repo --scan-freshness
```

## Node.js or Native Dependency Errors

The published package supports Node 20.19+, 22, and 24. Check the runtime that
starts Astrograph:

```bash
node --version
```

Upgrade to a supported version and reinstall. If installation still fails, keep
the complete error: native prebuild availability depends on your operating
system and architecture.

## `astrograph: command not found`

The global command is optional. Your MCP registration continues to work through
its pinned `npx` invocation.

If you want the convenience command after switching Node versions, install it
under the active runtime:

```bash
npm install --global astrograph@latest
astrograph --version
```

If it is still unavailable, follow your runtime manager's documented refresh
step or inspect `npm prefix --global`. Do not add an Astrograph-specific path
to your shell profile.

## No Results or a Stale Index

Create or refresh the index:

```bash
npx --yes astrograph cli index-folder --repo /absolute/path/to/repo
```

For automatic refresh while editing:

```bash
npx --yes astrograph cli watch --repo /absolute/path/to/repo
```

## Setup Needs Repair or Reset

Use guided setup to inspect the current state, or repair one managed
registration explicitly:

```bash
npx --yes astrograph
npx --yes astrograph repair --yes --scope global --ide codex
```

Before 1.0, Astrograph does not migrate obsolete setup or index formats.
Interactive setup explains a mismatch and asks before replacing only
Astrograph-managed state. Automation stops until you explicitly add `--reset`:

```bash
npx --yes astrograph install --yes --reset --scope repository --ide codex --repo /absolute/path/to/repo
```

Valid client configuration is changed only in Astrograph's managed block or
server entry. Malformed whole-client configuration is backed up before a fresh
Astrograph-only configuration is written.

## Cache Recovery

Do not delete cache directories manually. Inspect and archive the selected
global cache instead:

```bash
npx --yes astrograph cache status --repo /absolute/path/to/repo
npx --yes astrograph cache remove --repo /absolute/path/to/repo
npx --yes astrograph cache remove --repo /absolute/path/to/repo --yes
```

The first removal is a preview. Cache operations are scoped to the selected
repository and never remove repository source or another MCP server.

## Report an Installer Defect

For a reproducible Astrograph-owned installer failure, generate a copyable,
redacted issue URL:

```bash
npx --yes astrograph report-issue --diagnostics-consent --message "short failure summary"
```

The command does not open a browser, send diagnostics, or create an issue.
