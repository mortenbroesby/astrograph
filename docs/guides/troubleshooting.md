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

In practice, `doctor` is the fastest way to understand what Astrograph thinks
is wrong and what command it wants you to run next.

## Common Problems

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

### Problem: metadata is corrupted or incomplete

Fix:

Run the reset command for your terminal, then run `astrograph init --yes`:

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
Global Codex setup is user-level: do not create repo-local `astrograph.config.*`
or `.codex` files merely to repair a globally installed setup. Re-run
`astrograph install --global --ide codex` if registration needs repair, then
use `cache status` or `doctor` for the repository you opened.

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

Remember that `astrograph init` writes MCP configuration. It does not create
the initial index by itself.

If setup succeeded but retrieval still feels empty, the next command to try is:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

## If You Installed Astrograph Locally

If `astrograph` is not on your shell `PATH`, prefer `npx astrograph ...`
rather than bare `astrograph ...`.

## Where To Go Next

- For first-use flow: [First Steps](../getting-started/first-steps.md)
- For config controls: [Config Reference](../reference/config.md)
- For retrieval habits: [Retrieval Workflows](./retrieval-workflows.md)
