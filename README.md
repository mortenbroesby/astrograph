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
  <img alt="Node" src="https://img.shields.io/badge/node-20.19%2B%20%7C%2022.12%2B-6366f1">
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

## 🗺️ A Map for Your Codebase, Not Another Agent

### ✨ What is Astrograph?

Astrograph gives AI coding agents a local, structured map of your codebase.
Instead of reading whole repositories into context, an agent can ask for file
outlines, symbols, source, and targeted task context.

### 🚫 What it is not

Astrograph is not another coding agent, a hosted code service, or a replacement
for your editor, Git, or tests. Your code stays local. It is also not a generic
vector database or RAG service: it builds a structured code index for precise
retrieval. Read [the concepts guide](./docs/getting-started/concepts.md#what-astrograph-is-not)
when you want the deeper model.

<a id="start-here"></a>
## 🚀 Start Here

In the repository you want to explore:

```bash
npx --yes astrograph
```

Choose your AI client when prompted, restart it, then let it ask Astrograph for
file outlines, symbols, source, and targeted task context. The guided installer
recommends **global setup**: it installs Astrograph for your device, connects
your selected client, and keeps one private index per repository. Choose
**this repository** instead when you want project-owned configuration that
collaborators can review.

Before it writes anything, Astrograph asks which scope and client you want, then
shows the next step. Repository setup offers initial indexing by default;
device-wide setup offers it only as an opt-in, so it leaves the current
repository untouched unless you choose otherwise.

For deterministic automation, name the scope and client explicitly:

```bash
npx --yes astrograph install --yes --scope repository --ide copilot-cli --repo /absolute/path/to/repo
```

New to Astrograph? Follow the [five-minute setup](./docs/getting-started/first-steps.md).

<a id="why-astrograph"></a>
## 🔭 Why Astrograph

Astrograph gives coding agents a local-first, structured way to navigate a
codebase without dumping full-repository context. It returns focused,
source-linked answers so the agent can retrieve less and understand more.

The result is straightforward:

- more reliable answers grounded in source
- less token waste from broad file reads
- less context bloat in long-running agent sessions
- a better default than guessing from partial snippets

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

Install once for Copilot CLI or Codex across repositories:

```bash
npx --yes astrograph
```

This adds one user-level MCP registration and keeps a separate private cache
for each repository. It does not modify repositories unless you explicitly opt
into indexing the current one. Installing `astrograph` globally is an optional
convenience offered by the guide; the MCP registration itself uses a pinned
package invocation and does not depend on your PATH.

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

- Package runtime: Node `^20.19.0 || >=22.12.0` (Node 20.19+, 22, and 24)
- Repository build tooling: Node 22.18+ or 24.11+; the checked-in ASDF toolchain
  remains Node `22.23.1`.
- Repository tooling: [`.tool-versions`](./.tool-versions) pins Node `22.23.1`
  and pnpm `9.15.9` for ASDF users.
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
