## 1. Baseline and Global Setup

- [x] 1.1 Record the user's direction on the `origin/main` baseline of 390 passed, 10 failed, and 1 skipped tests; proceed only with an accepted baseline exception or a repaired green baseline.
- [x] 1.2 Install `jcodemunch-mcp==1.108.317` as a global `uv` tool using the existing uv-managed Python 3.13 and verify the resolved binary, installed version, package source, and `uv tool list` entry.
- [x] 1.3 Register the resolved jCodeMunch binary globally with Codex without changing the Astrograph registration; verify both entries with `codex mcp get <name> --json` and a fresh Codex CLI process that discovers and calls each server.

## 2. Deterministic Comparison Harness

- [x] 2.1 Add a minimal `.jcodemunch.jsonc` test-branch configuration that disables AI summaries, savings sharing, and performance telemetry; verify `jcodemunch-mcp config --check` reports the intended effective sources without credentials or remote providers.
- [x] 2.2 Index the exact `codex/jcodemunch-benchmark` worktree with both servers and record product versions, repository SHA, worktree path, index identity/state, and cold/warm conditions in ignored raw evidence.
- [x] 2.3 Map the smallest equivalent tool sequences to existing benchmark task outcomes and document every semantic mismatch; verify each sequence retrieves the declared target on the same repository commit.
- [x] 2.4 Reuse the existing MCP SDK, `tiktoken`, task corpus, and report conventions in at most one comparison entrypoint plus one focused test; verify it records `tools/list` cost, serialized response bytes/tokens, calls, latency, target evidence, and cold/warm state for both servers.
- [x] 2.5 Run the focused comparison test and matched cold/warm benchmark three times per server; verify JSON evidence is auditable, source-free aggregates are stable enough to report, and raw source-bearing output remains only under ignored `.benchmarks/`.

## 3. End-to-End Agent Evidence

- [x] 3.1 Define one bounded task prompt and fresh-session procedure with the same Codex model and reasoning effort, one named retrieval server, and no filesystem fallback; verify a dry run exposes any prompt or tool-mapping asymmetry before recording results.
- [x] 3.2 Run three fresh Codex trials per server and record median/range model input tokens, wall time, tool calls, failures, and task success; verify no run changed repository content and disclose discarded runs with reasons.
- [x] 3.3 Compare deterministic payload results separately from agent results and calculate reductions from the same raw counts; verify the report does not reuse either server's self-reported savings as cross-product evidence.

## 4. Documentation and Delivery

- [x] 4.1 Add a dated source-free comparison review and update `docs/guides/benchmarks.md` with pinned setup, reproduction, interpretation limits, evidence locations, and exact uninstall commands; verify links and documented commands from the test worktree.
- [x] 4.2 Run the focused benchmark tests, `pnpm build`, `pnpm type-lint`, `pnpm check:version-bump --base origin/main`, the repository release-decision workflow, and `pnpm exec openspec validate benchmark-jcodemunch-comparison --strict`; fix scoped failures and report accepted baseline failures separately.
- [x] 4.3 Review the minimal diff, secret-scan changed files, commit and push `codex/jcodemunch-benchmark`, then verify `origin/codex/jcodemunch-benchmark` matches the local SHA.
- [x] 4.4 Merge the reviewed branch to `main` through GitHub, preserve the remote test branch for repeat comparisons, and verify required CI and `origin/main` at the exact merged commit before archiving the OpenSpec change.
