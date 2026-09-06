## Context

See `proposal.md` for motivation. Astrograph already owns a checked-in task corpus, exact `cl100k_base` token accounting, MCP SDK dependency, JSON evidence, and Markdown reporting under `bench/`; `docs/guides/benchmarks.md` defines the publication boundary. jCodeMunch 1.108.317 is the current PyPI and GitHub release as of 2026-09-06, requires Python 3.10+, and its Codex guidance recommends a preinstalled absolute binary rather than first-run `uvx` output on stdio.

The untouched `origin/main` baseline at `a6e28cd` currently reports 390 passed, 10 failed, and 1 skipped tests. Nine failures are timing/daemon failures and one expects `dist/astrograph.js` before a build. This comparison must use focused benchmark verification and must not absorb those unrelated failures without explicit direction.

## Goals / Non-Goals

**Goals:**

- Keep both servers pinned, local, independently identifiable, and available to fresh Codex clients.
- Compare the same checkout and task inputs with one tokenizer and auditable raw responses.
- Separate deterministic MCP payload measurements from end-to-end agent input-token measurements.
- Make setup and removal reversible without touching Astrograph's production runtime or secrets.

**Non-Goals:**

- Generalize the benchmark to arbitrary MCP servers or repositories.
- Treat vendor savings counters as comparable evidence.
- Exercise remote repositories, semantic embeddings, AI summaries, paid APIs, or telemetry.
- Add a required CI job or make jCodeMunch a package dependency.

## Decisions

### Pin a device-owned jCodeMunch binary

Install `jcodemunch-mcp==1.108.317` with the existing uv-managed Python 3.13, then register the resolved absolute `~/.local/bin/jcodemunch-mcp` path with `codex mcp add`. Record `uv tool list`, `jcodemunch-mcp --version`, `codex mcp get jcodemunch --json`, and the binary path. This avoids mutable `uvx` resolution and first-run stdout during the MCP handshake. A repository virtualenv was rejected because the user requested a global test installation; downloading another interpreter or using unpinned `pip install` was rejected because the installed Python 3.13 already satisfies the package's `>=3.10` requirement and an unpinned package cannot reproduce the comparison.

### Keep the comparison local and deterministic

Commit `.jcodemunch.jsonc` on the test branch with AI summaries, savings sharing, and performance telemetry disabled. Bind the global Codex registration to a dedicated `/Users/macbook/.code-index-astrograph-benchmark` store containing the same controls plus the core/compact handshake profile, because jCodeMunch's project config cannot shape the repository-less initial `tools/list`. This preserves the user's pre-existing `~/.code-index` config and indexes. Index the exact linked worktree path and record both products' effective version, repository commit, index state, and cold/warm condition. Remote summarizers were rejected because they add provider, cost, privacy, and model variance.

### Reuse Astrograph's benchmark primitives

Add at most one focused `bench/scripts/jcodemunch-comparison.mjs` entrypoint plus one focused test if the existing runner cannot launch both stdio servers. Reuse `@modelcontextprotocol/sdk`, `tiktoken`, the checked-in task cards, JSON evidence shape, and Markdown renderer; do not add a dependency or framework. The runner will capture `tools/list`, matched retrieval responses, wall latency, exact serialized tokens, success/target evidence, and cold/warm state. Copying jCodeMunch's own benchmark implementation was rejected because it would make one product's methodology authoritative.

### Report two evidence layers

The deterministic layer compares tool-schema cost and matched MCP retrieval workflows on the same commit. The agent layer runs the same bounded prompt, Codex model, reasoning effort, and fresh-session protocol three times with only the named retrieval server allowed, then records median/range model input tokens, tool calls, completion, and wall time. Results remain separate because a smaller MCP response does not necessarily produce fewer total agent tokens or a correct answer.

### Land reviewed evidence through the test branch

Keep implementation, local-only configuration, OpenSpec artifacts, and draft evidence on `codex/jcodemunch-benchmark`. After focused verification and review, update `docs/guides/benchmarks.md` and add a dated review with reproduction commands, limitations, raw-evidence locations, and uninstall steps. Merge that branch to `main` through GitHub, leave the remote branch available for repeat runs, and verify the exact merged commit. Runtime/package behavior is unchanged, so apply the repository's `no-release` PR policy and confirm that override with the release-decision workflow before completion.

## Risks / Trade-offs

- [The products expose different tools and ranking semantics] -> Use equivalent task outcomes and disclose every tool mapping; do not claim call-for-call equivalence where none exists.
- [Agent runs vary] -> Pin model/reasoning/prompt, use fresh sessions, run three repetitions, and report median plus range instead of one best run.
- [Global registration is not visible to this already-running client] -> Verify configuration immediately, then prove discovery and calls from a fresh client before reporting success.
- [jCodeMunch updates rapidly] -> Pin 1.108.317 for the first comparison and record the release date; upgrades require a new evidence run.
- [Existing full-suite failures obscure regression status] -> Require focused benchmark tests, build, type/lint, OpenSpec validation, and explicit acceptance of the known baseline before implementation.
- [Local index or raw output may contain source] -> Keep raw evidence in ignored `.benchmarks/`; commit only aggregate, source-free results.

## Migration Plan

1. Accept the recorded baseline exception or repair the baseline before implementation.
2. Install and read back the pinned global jCodeMunch tool; register it with Codex without changing Astrograph's registration.
3. Add the local deterministic config and minimal comparison harness on the test branch; run matched cold and warm evidence.
4. Run repeated fresh-client agent trials, review aggregates, and publish the dated report and guide update.
5. Validate, commit, push, open and merge the documentation branch, then verify `origin/main` contains the exact result.

Rollback removes the `jcodemunch` Codex registration with `codex mcp remove jcodemunch`, uninstalls the tool with `uv tool uninstall jcodemunch-mcp`, and removes `/Users/macbook/.code-index-astrograph-benchmark` only after confirming it remains the dedicated benchmark store. The pre-existing `~/.code-index`, preserved pipx venv, Astrograph registration, and Astrograph cache remain untouched.
