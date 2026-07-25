# Token-Budgeted Task Context Delivery Checklist

**Goal:** Replace the current overlapping context paths with one deterministic,
source-attributed task-context contract whose declared budget corresponds to
the payload an agent receives.

**Architecture:** The selected contract will reuse the existing local lexical
ranking, provenance, relation traversal, and tokenizer. It will select anchors
before relations, account for serialized response tokens separately from source
tokens, and report every excluded candidate. It will not add semantic retrieval,
remote services, or compact transport; compact encoding remains a separately
evidenced follow-up after this JSON contract is correct.

**Tech Stack:** TypeScript, Node.js 24, SQLite/FTS5, `tiktoken`, Vitest, pnpm,
CLI JSON, and MCP stdio.

## Selection Evidence

- [x] **Baseline the existing composition.** On main commit `1efcc8f`, the
  checked-in bundle benchmark (`pnpm bench:corpus -- --repo-root . --workflow
  bundle --output .benchmarks/story5-selection`) ran five representative
  tasks at its declared 400-source-token budget. Two tasks returned one of two
  required targets; three returned none. Every task reported truncation. The
  successful tasks took 369–381 ms; failed tasks took 371–392 ms.
- [x] **Measure payload rather than source tokens alone.** For the runner
  artifact query, each current path selected zero items at budget 400 despite
  estimating 4,499 source tokens. At budget 8,000 it selected 18 items and
  4,499 source tokens, but serialized 13,689 tokens (`get_context_bundle`),
  17,123 (`get_ranked_context`), or 30,821 (`query_code` assemble with ranked
  candidates). The three paths therefore cannot provide the same bounded
  agent-visible outcome, and their metadata overlap is material.
- [x] **Select the smallest justified work.** Implement Story 3 only. Do not
  begin compact transport until the canonical JSON payload has an explicit
  budget and a repeatable baseline showing residual encoding cost.

## Task 1: Choose and Specify the Canonical Contract

**Files:**

- Modify: `src/command-registry.ts`
- Modify: `src/mcp-contract.ts`
- Modify: `src/cli.ts`
- Modify: `src/types/retrieval.ts`
- Modify: `specs/api-design/mcp-tools.md`
- Modify: `specs/api-design/cli-api.md`
- Test: `tests/engine-contract.test.ts`
- Test: `tests/interface.test.ts`

- [x] Decide the one task-context command and remove the redundant context
  entry points rather than retaining aliases or compatibility shims.
  **Decision:** `get_task_context` is now the only public bounded-context
  command. `get_context_bundle` and `get_ranked_context` are removed from the
  CLI, MCP registry, package exports, installer lists, and generated guidance;
  `query_code` is restricted to discovery and source intents.
- [x] Specify query, optional symbol anchors, rules-based intent hint, relation
  depth, declared payload budget, source-token accounting, and the JSON result
  fields for selected items, exclusions, truncation, and provenance. The
  contract uses `payloadTokenBudget`, `usedPayloadTokens`,
  `estimatedPayloadTokens`, `sourceTokens`, deterministic exclusions, and
  exact symbol-source provenance. A request whose envelope cannot fit fails
  instead of exceeding its declared budget.
- [x] Update CLI/MCP contract docs and parity tests for the chosen command.
  Evidence: `pnpm type-lint`; focused engine task-context, MCP interface,
  registry, and CLI-boundary suites pass with the global-cache fixture
  permission required by this dogfooding environment.

## Task 2: Deterministic Budget-Aware Assembly

**Files:**

- Modify: `src/retrieval.ts`
- Modify: `src/tokenizer.ts`
- Modify: `src/storage.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/interface.test.ts`

- [x] Select deterministically in this order: explicit anchors, lexical
  matches, required relations, then budget-aware expansion.
  `resolveTaskContextSeedCandidates()` preserves explicit anchor order, adds
  deduplicated lexical matches, then expands enabled relations before applying
  the JSON-payload budget.
- [x] Budget serialized agent-visible JSON using the production tokenizer; only
  documented envelope fields may be excluded from the declared budget. The
  assembler counts its serialized result with `tiktoken`, rejects an envelope
  that cannot fit, and reports the exact used payload tokens.
- [x] Record deterministic exclusion reasons (`budget`, duplicate, unsupported,
  or relation-depth) and preserve source provenance for every selected item.
  Every selected item carries `SymbolSourceItem` provenance; the exclusion
  array is reason-sorted and fixtures cover duplicate and budget behavior.
- [x] Keep intent classification local, rules-based, and explainable. The
  four-value classifier uses documented keyword rules and callers can provide
  an explicit intent override.

## Task 3: Fixture and Measurement Evidence

**Files:**

- Modify: `tests/engine-behavior.test.ts`
- Modify: `tests/interface.test.ts`
- Modify: `bench/src/workflows.ts`
- Modify: `bench/tests/fixtures/benchmarks/ai-context-engine-benchmark-corpus.json`
- Modify: `docs/guides/retrieval-workflows.md`

- [x] Add exploration, debugging, refactor, and audit fixtures that assert
  targets, deterministic order, deduplication, provenance, exclusions, and
  declared-payload budget compliance. `tests/engine-behavior.test.ts` now
  exercises every explicit intent with a stable anchor; existing task-context
  fixtures cover relation expansion, duplicate exclusions, persisted source,
  provenance, and budget compliance.
- [x] Extend the deterministic benchmark only as needed to compare the
  canonical task-context payload with the recorded baseline; capture bytes,
  exact and estimated tokens, relevance, and warm latency separately. The
  `bundle` workflow now invokes `getTaskContext` at a 1,200 payload-token
  budget and reports serialized bytes, source tokens, candidate-payload tokens,
  exact/estimated returned tokens, recall, and latency. On 2026-07-22 the five
  tasks returned 1,074–1,183 exact payload tokens (4,088–4,902 bytes), 46–75%
  task-slice reduction, and 681–771 ms latency; 3/5 tasks had a target hit.
- [x] Update workflow guidance to direct agents to the canonical command only
  after its contract and tests pass. `docs/guides/retrieval-workflows.md` and
  `docs/reference/cli.md` now route bounded retrieval through
  `get-task-context`.

## Task 4: Verify, Release Decision, and Handoff

- [x] Run focused context, interface, and benchmark tests. `bench/tests` (18),
  focused MCP stdio (1), and the Windows-equivalent engine/filesystem/git/watch
  matrix (96 passed, 1 intentionally skipped) pass on 2026-07-22.
- [x] Run `pnpm type-lint`, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`; apply the required pre-v1 version increment for source or
  test changes. The guarded release tool set `0.5.0-alpha.141`; type lint,
  version policy, and diff validation pass.
- [x] Run package-bin smoke and the Fast plus Windows/package-smoke CI paths on
  the exact PR head before merge. PR #34 passed Fast required checks (54s) and
  Windows compatibility/package smoke (4m42s) on `94fdb59`.
- [x] Move this checklist to `../closed/` after PR #34 merged as `b5837a7` and
  record the exact CI evidence in the epic and closed-record index.
