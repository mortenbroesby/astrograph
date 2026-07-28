# Troubleshooting

This page is for the common cases where Astrograph is installed but not yet
useful, or where the local repo state has drifted.

## Start With These Commands

Check current health:

```bash
npx astrograph cli diagnostics --repo /absolute/path/to/repo --scan-freshness
```

Get a more direct recovery report:

```bash
npx astrograph cli doctor --repo /absolute/path/to/repo
```

For a fast read-only view of configured clients and index state, use:

```bash
npx --yes astrograph status --repo /absolute/path/to/repo
```

In practice, `doctor` is the fastest way to understand what Astrograph thinks
is wrong and what command it wants you to run next.

## Common Problems

### Problem: Node.js is unsupported or a native dependency will not load

Astrograph's published package supports Node 20.19+, 22, and 24. Check the
runtime that starts Astrograph:

```bash
node --version
```

Upgrade to Node 20.19+ or a current Node 22/24 release, then reinstall the
package. If the error happens during installation, keep the full error output:
native prebuild availability depends on your operating system and architecture.
The repository build itself uses Node 22.18+ or 24.11+ because its build tool
does not support Node 20; package users do not need to run that build.

### Problem: the repo is not indexed yet

Fix:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

This is the required first indexing step for a fresh repository.

### Problem: the index is stale

Fix:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

If you want automatic refresh while editing:

```bash
npx astrograph cli watch --repo /absolute/path/to/repo
```

### Problem: watch mode is not running

Fix:

```bash
npx astrograph cli watch --repo /absolute/path/to/repo
```

### Problem: diagnostics reports too many live MCP processes

Close unused editor or agent sessions, then rerun diagnostics. Astrograph only
reports the count; it never kills another application's process automatically.

### Problem: metadata is corrupted or incomplete

Fix:

Run the reset command for your terminal, then run `astrograph install --yes`:

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

For an opted-in global cache, inspect it first instead of deleting a directory
manually:

```bash
astrograph cache status --repo /absolute/path/to/repo
astrograph cache remove --repo /absolute/path/to/repo
astrograph cache remove --repo /absolute/path/to/repo --yes
```

The first removal command is a dry-run. It only targets the selected
repository’s user-private global cache; no MCP tool can remove cache data.
Global Codex and Copilot CLI setup is user-level: do not create repo-local
`astrograph.config.*`, `.codex`, or `.mcp.json` files merely to repair a
globally installed setup. Run `astrograph repair --yes --scope global --ide codex`
or `astrograph repair --yes --scope global --ide copilot-cli` for the harness you use, then
use `cache status` or `doctor` for the repository you opened.

### Problem: installation changed a client configuration unexpectedly

Astrograph only changes its marker-owned Codex block or its `astrograph` JSON
server entry. Before a change, it saves a timestamped copy beside the affected
config under `.astrograph-backups`. To remove only a registration without
deleting index data, run:

```bash
npx --yes astrograph uninstall --yes --scope global --ide codex
```

Use `--scope repository --repo /absolute/path/to/repo` for a project-owned
registration. Cache/index deletion is deliberately a separate operation.

### Problem: parser health is incomplete on older indexed files

Fix:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

### Problem: unresolved relative imports or symbol imports

Fix the broken importer path or missing exported symbol in the repo, then
reindex:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

### Problem: secret-like content appears in health output

Review the listed files, remove or rotate real secrets that should not be in
source, then reindex.

## If Setup Works but Commands Do Not

Remember that `astrograph install` writes MCP configuration. It does not create
the initial index by itself.

If setup succeeded but retrieval still feels empty, the next command to try is:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

## Reporting an Astrograph Installer Defect

Most setup errors are local conditions: an unsupported Node version, a missing
client, an invalid configuration file, or a permission problem. Astrograph
prints an actionable next step for those errors; do not file an issue that
contains configuration contents or credentials.

For a reproducible Astrograph-owned installer failure, you can explicitly
generate a browser-only, copyable issue link:

```bash
astrograph report-issue --diagnostics-consent --message "short failure summary"
```

The command does not open a browser or create an issue. It prints a URL that
you can inspect, copy, or discard. The generated text includes only the
Astrograph and Node versions, platform, and a redacted failure summary; it
removes common token/password forms and local paths before building the URL.
It rejects messages that identify an ordinary local setup, input, or permission
problem, so that path remains for Astrograph-owned failures only.

## If You Installed Astrograph Locally

If `astrograph` is not on your shell `PATH`, prefer `npx astrograph ...`
rather than bare `astrograph ...`.

## Where To Go Next

- For first-use flow: [First Steps](../getting-started/first-steps.md)
- For config controls: [Config Reference](../reference/config.md)
- For retrieval habits: [Retrieval Workflows](./retrieval-workflows.md)
