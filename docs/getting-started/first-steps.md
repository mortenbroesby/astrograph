# First Steps

This is the shortest path from zero to a useful Astrograph session.

## 1. Connect Your Client

In the repository you want to explore, run:

```bash
npx --yes astrograph
```

This is the quickest path: it runs Astrograph without installing a shell
command. If you want to use `astrograph` directly in any terminal, install it
globally once instead:

```bash
npm install --global astrograph@latest
astrograph install
```

Both commands open the same guided setup. Choose your AI client and setup
scope, then restart the client.

- **This device** registers your client once and keeps a private index for each
  repository.
- **This repository** writes project-owned configuration that collaborators can
  review.

Global installation gives you a permanent `astrograph` command. **This device**
is the device-wide setup scope; starting it through `npx` installs the device
command before registering clients. Both client registrations then run
`astrograph mcp` and share the same device cache and compatible daemon.

For non-interactive device-wide setup, use:

```bash
astrograph install --yes --scope global --ide codex
```

For non-interactive repository setup, use:

```bash
npx --yes astrograph install --yes --scope repository --ide codex --repo /absolute/path/to/repo
```

## 2. Index the Repository

Repository setup offers this during install. If you skipped it, or a newly
opened repository has no index yet, run:

```bash
npx --yes astrograph cli index-folder --repo /absolute/path/to/repo
```

## 3. Ask a Small Question First

Start with an outline or exact symbol rather than a whole-file read:

```bash
npx --yes astrograph cli get-file-outline --repo /absolute/path/to/repo --file src/index.ts
npx --yes astrograph cli search-symbols --repo /absolute/path/to/repo --query diagnostics
```

Then retrieve the exact source or ask for task context only when those results
show that you need more.

## 4. When Something Is Wrong

Run the read-only health check:

```bash
npx --yes astrograph doctor --repo /absolute/path/to/repo
```

It tells you whether setup, the index, or retrieval needs attention. For reset,
runtime-switch, cache, and client-configuration recovery, see
[Troubleshooting](../guides/troubleshooting.md).

## Next

- Learn the mental model in [Concepts](./concepts.md).
- See the recommended query sequence in [Retrieval Workflows](../guides/retrieval-workflows.md).
- Find exact flags in the [CLI Reference](../reference/cli.md).
