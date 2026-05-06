# First Steps

This is the fastest path from zero to a useful Astrograph session.

## 1. Install Astrograph

If you want Astrograph available in your repository scripts:

```bash
npm install -D astrograph
```

If you prefer a global install:

```bash
npm install -g astrograph
```

If you just want to initialize once:

```bash
npx astrograph init
```

## 2. Configure MCP

Run the installer:

```bash
npx astrograph init
```

That writes MCP configuration for your chosen client and preserves unrelated
config.

Useful explicit targets:

```bash
npx astrograph init --ide codex
npx astrograph init --ide copilot
npx astrograph init --ide copilot-cli
npx astrograph init --ide all
```

For non-interactive setup:

```bash
npx astrograph init --yes --repo /absolute/path/to/repo
```

If you installed Astrograph globally, you can omit `npx` and run `astrograph`
directly.

## 3. Create the Initial Index

On a fresh repository, setup writes config but does not build the local index.
Create it explicitly:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

## 4. Check That the Repo Is Healthy

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
npx astrograph cli query-code \
  --repo /absolute/path/to/repo \
  --intent assemble \
  --query "how does watch refresh remove deleted files?" \
  --budget 8000 \
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
