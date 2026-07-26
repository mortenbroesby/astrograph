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
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D22.12.0-6366f1">
</p>

<p align="center">
  <a href="#start-here">Start here</a>
  <span> | </span>
  <a href="#why-astrograph">Why Astrograph</a>
  <span> | </span>
  <a href="#key-features">Features</a>
  <span> | </span>
  <a href="#documentation">Documentation</a>
</p>

---

<a id="start-here"></a>
## 🚀 Start Here

In the repository you want to explore:

```bash
npx astrograph install
```

Choose your AI client when prompted, restart it, then let it ask Astrograph for
file outlines, symbols, source, and targeted task context. The guided installer
recommends **global setup**: it installs Astrograph for your device, connects
your selected client, and keeps one private index per repository. Choose
**this repository** instead when you want project-owned configuration that
collaborators can review.

Before it writes anything, Astrograph asks which scope and client you want, then
shows the next step. Choose the recommended options and confirm to set it up for
every repository on this device.

Use the explicit version for automation:

```bash
npx astrograph install --yes --ide codex --repo /absolute/path/to/repo
```

New to Astrograph? Follow the [five-minute setup](./docs/getting-started/first-steps.md).

<a id="why-astrograph"></a>
## 🔭 Why Astrograph

Astrograph gives coding agents a local-first, structured way to navigate a
codebase without dumping full-repository context. It returns focused,
source-linked answers so the agent can retrieve less and understand more.

<a id="key-features"></a>
## ✨ Key Features

- 🧠 **Persistent local context** — an index per repository, stored on your machine
- 🔍 **Progressive retrieval** — outlines, symbols, source, then bounded context when needed
- 🛠️ **MCP + CLI surfaces** — the same engine for Codex, Copilot, and the shell
- 🧹 **Health and refresh tools** — inspect stale indexes instead of guessing
- 🧪 **Measured output efficiency** — source-grounded results with explicit evidence

## 🧭 When To Use It

Reach for Astrograph when an agent needs to:

- jump from a symbol name to its real implementation
- trace a code path before making an edit
- answer a repository question without loading whole files into context
- gather precise context for planning, debugging, or refactoring

## ⚙️ How It Works

Astrograph indexes code locally and exposes structured retrieval through MCP and
the CLI. Instead of treating your repository as raw text, agents can ask for an
outline, a symbol, verified source, or a bounded task-context bundle.

## 🌍 Use It Everywhere (Recommended)

Install once for Codex or Copilot CLI across repositories:

```bash
npm install --global astrograph@latest
astrograph install --global --ide codex
```

This adds one user-level MCP registration and keeps a separate private cache
for each repository. It does not modify repositories. For Copilot CLI, replace
`codex` with `copilot-cli`.

## 🧪 Evidence, Not Promises

Astrograph ships reproducible benchmark commands. The current deterministic
MCP-envelope baseline measured **55.6%–66.7% fewer `cl100k_base` tokens** for
supported compact responses; ordinary JSON remains the default. This is a
response-size measurement, not an end-to-end productivity claim.

For the method, limits, and the workflow benchmark that compares a broad
read-all baseline with Astrograph retrieval, see [Benchmark evidence](./docs/guides/benchmarks.md).

## 📈 npm Downloads

<p align="center">
  <a href="https://www.npmjs.com/package/astrograph"><img alt="Astrograph npm downloads in the last month" src="https://img.shields.io/npm/dm/astrograph?label=npm%20downloads%20%2F%20month&color=0f172a"></a>
</p>

<a id="documentation"></a>
## 📚 Documentation

The README is the guided introduction. Use the docs when you need more detail:

- [Docs compendium](./docs/README.md)
- [Concepts](./docs/getting-started/concepts.md)
- [First steps](./docs/getting-started/first-steps.md)
- [Retrieval workflows](./docs/guides/retrieval-workflows.md)
- [Troubleshooting](./docs/guides/troubleshooting.md)
- [Performance and benchmark evidence](./docs/guides/performance.md)
- [CLI reference](./docs/reference/cli.md) and [config reference](./docs/reference/config.md)
- [Language support](./docs/reference/language-support.md)
- [Release reference](./docs/reference/release.md)

## 🧪 Project Status

Astrograph is still early. Expect rough edges, but the core value proposition is
already usable today.

## 📦 Install Details

- Node target: `>=22.12.0` (Node 22 LTS or newer; Node 24 is supported)
- Entry command: `astrograph`
- Supported terminals on Windows: PowerShell, `cmd.exe`, and Git Bash.
- Git is optional for ordinary indexing and retrieval. When Git is unavailable
  or the folder is not a Git checkout, Astrograph uses a safe filesystem
  fallback; Git metadata only enriches checkout identity and refresh behavior.

## ⚖️ License

MIT. See [LICENSE](./LICENSE).

## 🙏 Acknowledgements

- `pnpm`, `Turborepo`, `Vite`, `React`, and `Vitest` for the core workspace foundation
- Tree-sitter and its grammar maintainers for local, structured parsing
- the Model Context Protocol ecosystem for a common agent integration surface
- the open-source maintainers whose work makes local-first developer tooling possible

---

## 👤 Author

**Morten Broesby-Olsen** (mortenbroesby)

- GitHub: [@mortenbroesby](https://github.com/mortenbroesby)
- LinkedIn: [mortenbroesby](https://www.linkedin.com/in/morten-broesby-olsen/)

---

<p align="center">
  Made with ☕ and ⚡️ by Morten Broesby-Olsen
</p>
