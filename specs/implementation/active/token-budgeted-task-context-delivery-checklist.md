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

- [ ] Decide the one task-context command and remove the redundant context
  entry points rather than retaining aliases or compatibility shims.
- [ ] Specify query, optional symbol anchors, rules-based intent hint, relation
  depth, declared payload budget, source-token accounting, and the JSON result
  fields for selected items, exclusions, truncation, and provenance.
- [ ] Update CLI/MCP contract docs and parity tests for the chosen command.

## Task 2: Deterministic Budget-Aware Assembly

**Files:**

- Modify: `src/retrieval.ts`
- Modify: `src/tokenizer.ts`
- Modify: `src/storage.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/interface.test.ts`

- [ ] Select deterministically in this order: explicit anchors, lexical
  matches, required relations, then budget-aware expansion.
- [ ] Budget serialized agent-visible JSON using the production tokenizer; only
  documented envelope fields may be excluded from the declared budget.
- [ ] Record deterministic exclusion reasons (`budget`, duplicate, unsupported,
  or relation-depth) and preserve source provenance for every selected item.
- [ ] Keep intent classification local, rules-based, and explainable.

## Task 3: Fixture and Measurement Evidence

**Files:**

- Modify: `tests/engine-behavior.test.ts`
- Modify: `tests/interface.test.ts`
- Modify: `bench/src/workflows.ts`
- Modify: `bench/tests/fixtures/benchmarks/ai-context-engine-benchmark-corpus.json`
- Modify: `docs/guides/retrieval-workflows.md`

- [ ] Add exploration, debugging, refactor, and audit fixtures that assert
  targets, deterministic order, deduplication, provenance, exclusions, and
  declared-payload budget compliance.
- [ ] Extend the deterministic benchmark only as needed to compare the
  canonical task-context payload with the recorded baseline; capture bytes,
  exact and estimated tokens, relevance, and warm latency separately.
- [ ] Update workflow guidance to direct agents to the canonical command only
  after its contract and tests pass.

## Task 4: Verify, Release Decision, and Handoff

- [ ] Run focused context, interface, and benchmark tests.
- [ ] Run `pnpm type-lint`, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`; apply the required pre-v1 version increment for source or
  test changes.
- [ ] Run package-bin smoke and the Fast plus Windows/package-smoke CI paths on
  the exact PR head before merge.
- [ ] Move this checklist to `../closed/` only after the merged commit and CI
  evidence are recorded in both epics.
