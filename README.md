<p align="center">
  <a href="https://github.com/mortenbroesby/astrograph">
    <img src="./assets/astrograph-logo.svg" alt="Astrograph" width="520">
  </a>
</p>

<p align="center">
  Reliable, source-grounded code answers for AI agents.
</p>

<p align="center">
  Local, deterministic code intelligence with less context bloat and lower token waste.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/astrograph"><img alt="npm" src="https://img.shields.io/npm/v/astrograph?color=0f172a&label=npm"></a>
  <a href="https://github.com/mortenbroesby/astrograph/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/mortenbroesby/astrograph/ci.yml?branch=main&label=ci"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-14b8a6"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D24-6366f1">
</p>

<p align="center">
  <a href="#why-astrograph">Why Astrograph</a>
  <span> | </span>
  <a href="#use-cases">Use cases</a>
  <span> | </span>
  <a href="#quick-start">Quick start</a>
  <span> | </span>
  <a href="./docs/README.md">Docs</a>
  <span> | </span>
  <a href="#documentation">Documentation</a>
</p>

---

## Why Astrograph

Astrograph gives AI coding agents structured, local access to the codebase they
are working in.

That means an agent can inspect the implementation of a symbol, trace a code
path across files, or answer repository questions without shoveling large file
dumps into context first.

The result is straightforward:

- more reliable answers grounded in source
- less token waste from broad file reads
- less context bloat in long-running agent sessions
- a better default than guessing from partial snippets

## What It Is

Astrograph is a local MCP server and CLI for code intelligence. It indexes your
repository locally and exposes focused tools for file outlines, symbol lookup,
source retrieval, code-aware search, diagnostics, and refresh workflows.

Use it when you want an agent to ask targeted questions about real code
structure instead of reading half the repository and hoping it found the right
thing.

## What It Is Not

Astrograph is not:

- a memory layer for prior sessions
- a generic chat shell around an LLM
- a brute-force repo-to-context pipeline
- a remote indexing service you have to ship your repo to

It is the code-intelligence layer: local-first, source-grounded, and
deterministic enough to give agents a better starting point than grep plus huge
context windows.

## Use Cases

Reach for Astrograph when you want an agent to:

- jump from a symbol name to its real implementation
- trace a code path across files before making an edit
- answer repository questions without loading whole files into context
- gather precise source context before planning or patching code
- stay efficient in larger repos where broad context gets noisy and expensive

## How It Works

Astrograph indexes your codebase locally and exposes structured tools over MCP
and CLI surfaces. Instead of treating the repository like raw text, agents can
ask for outlines, symbols, source, search results, diagnostics, and targeted
context bundles.

That is where the token savings come from: better questions, smaller retrievals,
and fewer blind scans.

## Why Not Just Grep and File Reads?

Because the default agent fallback is usually too blunt.

Broad search, repeated full-file reads, and oversized context windows are noisy,
expensive, and easy to derail. Astrograph gives the agent structured access to
code so it can retrieve less and understand more.

## Quick Start

### 1) Install

Use dependency-based setup if you want `astrograph` available in repo scripts:

```bash
npm install -D astrograph
```

Or install globally:

```bash
npm install -g astrograph
```

If you prefer one-shot setup without a prior install:

```bash
npx astrograph init
```

### 2) Configure MCP

Run the installer:

```bash
npx astrograph init
```

That writes MCP configuration for your target editor or agent client and
preserves unrelated local config.

If you want non-interactive setup:

```bash
npx astrograph init --yes --repo /absolute/path/to/repo
```

Choose a specific target when needed:

```bash
npx astrograph init --ide codex
npx astrograph init --ide copilot
npx astrograph init --ide copilot-cli
npx astrograph init --ide all
```

If you installed Astrograph globally, you can omit `npx` and run `astrograph`
directly.

For a fresh repository, create the initial index before first use:

```bash
npx astrograph cli index-folder --repo /absolute/path/to/repo
```

### 3) Start your agent session

Once the MCP config is written, start your editor or CLI agent session and use
Astrograph's retrieval tools against the local repository.

## IDE Setup

Astrograph currently supports MCP setup for Codex, GitHub Copilot, and GitHub
Copilot CLI.

Codex writes `.codex/config.toml`:

```bash
npx astrograph init --yes --ide codex --repo /absolute/path/to/repo
```

GitHub Copilot writes `.vscode/mcp.json`:

```bash
npx astrograph init --yes --ide copilot --repo /absolute/path/to/repo
```

GitHub Copilot CLI writes `.mcp.json`:

```bash
npx astrograph init --yes --ide copilot-cli --repo /absolute/path/to/repo
```

To configure multiple clients in one pass:

```bash
npx astrograph init --yes --ide all --repo /absolute/path/to/repo
npx astrograph init --yes --ide codex,copilot --repo /absolute/path/to/repo
```

## Documentation

The README is the short version. Use the docs for operational detail:

- [Docs compendium](./docs/README.md)
- [Concepts](./docs/getting-started/concepts.md)
- [First steps](./docs/getting-started/first-steps.md)
- [CLI reference](./docs/reference/cli.md)
- [Performance guide](./docs/guides/performance.md)
- [Release reference](./docs/reference/release.md)
- [Ralph runner](./docs/guides/ralph-runner.md)

## Project Status

Astrograph is still early. Expect rough edges, but the core value proposition is
already usable today.

## Install Details

- Node target: `>=24`
- Entry command: `astrograph`

## License

MIT. See [LICENSE](./LICENSE).

## Acknowledgements

- `pnpm`, `Turborepo`, `Vite`, `React`, and `Vitest` for the core workspace foundation

---

## Author

**Morten Broesby-Olsen** (mortenbroesby)

- GitHub: [@mortenbroesby](https://github.com/mortenbroesby)
- LinkedIn: [mortenbroesby](https://www.linkedin.com/in/morten-broesby-olsen/)

---

<p align="center">
  Made with ☕ and ⚡️ by Morten Broesby-Olsen
</p>
