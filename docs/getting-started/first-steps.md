# First Steps

This is the fastest path from zero to a useful Astrograph session.

## 1. Install Astrograph

If you want Astrograph available in your repository scripts:

```bash
npm install -D astrograph
```

If you just want to initialize once:

```bash
npx --yes astrograph
```

## 2. Configure MCP

Run the installer:

```bash
npx --yes astrograph
```

That writes MCP configuration for your chosen client and preserves unrelated
config.

The guided installer recommends **global setup**: it registers Astrograph for
your chosen client once, keeps a separate private index for each repository,
and does not modify those repositories. Choose **this repository** only when
you want project-owned configuration that collaborators can review.

Repository setup offers to create the first index by default. Global setup asks
separately and defaults to no, so selecting device-wide setup never writes to
the current repository unless you opt in.

Useful explicit targets:

```bash
npx --yes astrograph install --yes --scope global --ide copilot-cli
npx --yes astrograph install --yes --scope global --ide codex
npx --yes astrograph install --yes --scope repository --ide copilot
npx --yes astrograph install --yes --scope repository --ide all
```

For non-interactive setup:

```bash
npx --yes astrograph install --yes --scope repository --ide codex --repo /absolute/path/to/repo
```

### When setup asks to reset

Pre-1.0 Astrograph does not migrate old registrations or index/database
formats. The guided installer explains the mismatch and asks before replacing
Astrograph-owned configuration and state. Valid client files keep unrelated
settings; a malformed whole client config is backed up before Astrograph writes
a fresh Astrograph-only configuration.

Automation stops rather than resetting silently. Re-run with `--reset` only
after reviewing the reported mismatch:

```bash
npx --yes astrograph install --yes --reset --scope repository --ide codex --repo /absolute/path/to/repo
```

The normal interactive view prints numbered phases. Use `--verbose` when you
need detailed optional npm-installation output.

## 3. Create the Initial Index

On a fresh repository, setup writes config but does not build the local index.
Create it explicitly:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

## 4. Check That the Repo Is Healthy

First, confirm that the installed harness is actually wired:

```bash
npx astrograph doctor
```

It checks MCP registration, agent guidance, optional Git refresh hooks, and
whether the index is usable. For the detailed engine-health report, continue
with diagnostics:

Start with diagnostics:

```bash
npx astrograph cli diagnostics --repo /absolute/path/to/repo --scan-freshness
```

If you want a more operator-friendly health report:

```bash
npx astrograph cli doctor --repo /absolute/path/to/repo
```

## 5. Run a Few Useful Retrieval Commands

Inspect the shape of a file:

```bash
npx astrograph cli get-file-outline --repo /absolute/path/to/repo --file src/index.ts
```

Find a symbol:

```bash
npx astrograph cli search-symbols --repo /absolute/path/to/repo --query diagnostics
```

Ask a repository question:

```bash
npx astrograph cli get-task-context \
  --repo /absolute/path/to/repo \
  --query "how does watch refresh remove deleted files?" \
  --payload-token-budget 1200 \
  --include-references
```

## 6. Know What Good Usage Looks Like

Astrograph is most useful when the agent retrieves narrowly and progressively.

Good patterns:

- ask for outlines before full source
- fetch the implementation of the symbol you actually care about
- use diagnostics when freshness or readiness is unclear
- escalate to ranked or bundled context only when the simple query is not enough

## 7. Know Where To Go Next

- For exact command shapes: [CLI Reference](../reference/cli.md)
- For the mental model behind the tool: [Concepts](./concepts.md)
- For the recommended retrieval pattern: [Retrieval Workflows](../guides/retrieval-workflows.md)
- For failure recovery: [Troubleshooting](../guides/troubleshooting.md)
- For tuning and benchmarks: [Performance Guide](../guides/performance.md)
