# Deterministic Lexical Ranking Delivery Checklist

> **Epic:** [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md), Story 2
>
> **Status:** Active — establish the judged corpus and current ranking evidence
> before modifying the ranking signal.

**Goal:** Return the same locally ranked symbol results for the same corpus and
query, with explicit lexical-field weights, deterministic tie-breaking, and
recorded relevance and latency evidence.

**Architecture:** Reuse SQLite FTS5 `symbol_search` as the lexical index and
keep kind/language/path filters as SQL hard constraints. Replace the current
heuristic-only ordering only after a small judged fixture proves the selected
BM25 signal improves or preserves the recorded task results. Do not introduce
semantic retrieval, a vector service, or a second search tool.

**Tech Stack:** TypeScript, Node.js 22 LTS, SQLite FTS5 unicode61 tokenizer,
pnpm, Vitest, existing retrieval/config contracts.

---

## Task 1: Baseline Existing Ranking

**Files:**
- Inspect: `src/retrieval.ts`, `src/storage-schema.ts`, `src/config.ts`
- Inspect tests: `tests/engine-behavior.test.ts`, `tests/engine-contract.test.ts`
- Create: focused judged fixture/test only if none exists
- Record: this checklist

- [x] Run the focused CI-mode ranking baseline and record command, pass count,
  warm latency, and index-size evidence.
  `CI=1 pnpm exec vitest run --no-file-parallelism
  tests/engine-behavior.test.ts --testNamePattern='ranks generator|path
  presets|overlapping preset|substring search|repo-config ranking'` passes 5
  focused tests in 14.91 seconds. Per-query warm latency and index-size delta
  remain unmeasured until the judged fixture exists.

- [x] Record the current contract: FTS5 unicode61 provides a candidate
  shortlist; weighted exact/prefix/contains scoring plus intent/path bonuses
  determines order. Filters are already hard SQL constraints.
  `symbol_search` uses FTS5 `unicode61`, but `loadSymbolRows()` takes an
  unordered shortlist and `scoreSymbolRow()` supplies the final heuristic
  score. This is deterministic with stable tie-breaking, but not a BM25
  ranking contract and has no recorded quality metrics.

- [x] Add a small deterministic judged fixture containing exact-name, acronym,
  natural-language, path-scoped, and no-result queries with expected top-k
  symbols. `keeps judged lexical ranking deterministic across exact, acronym,
  summary, path, and no-result queries` passed in CI mode (1 test, 1.58
  seconds); the repeated natural-language query also asserts stable ordered
  symbol IDs. The fixture uses stable symbol names because temporary fixture
  paths vary per run.

## Task 2: Select and Specify the Lexical Signal

- [ ] Compare existing results with SQLite FTS5 `bm25(symbol_search, ...)` on
  the judged fixture. Select BM25 only if it improves or preserves every
  required task; otherwise record the evidence-driven defer decision.

- [ ] Fix tokenizer, named field weights, candidate limit, deterministic
  tie-break sequence, and incremental FTS update lifecycle in this checklist.

- [ ] Define requested-only ranking explanations; do not grow ordinary
  discovery payloads without measured need.

## Task 3: Implement and Measure Only When Selected

- [ ] Add only the selected deterministic ranking behavior and focused tests.
  Preserve exact lookup and filters as hard constraints.

- [ ] Record precision@k, MRR, zero-result rate, warm latency, and index-size
  delta for the judged fixture, with exact command and raw expected output.

- [ ] Run affected engine/interface tests, `CI=1 pnpm type-lint`, package
  smoke when the shipped surface changes, `pnpm check:version-bump`, and
  `git diff --check`. Update the release decision and merge only after CI
  validates the exact commit.
