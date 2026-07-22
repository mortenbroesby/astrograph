# Deterministic Lexical Ranking Delivery Checklist

> **Epic:** [Precision Retrieval and Agent Experience Epic](../planned/precision-retrieval-agent-experience-epic.md), Story 2
>
> **Status:** Complete — merged with provenance-first retrieval as PR #26 after
> exact-head Fast and Windows compatibility CI passed.

**Goal:** Return the same locally ranked symbol results for the same corpus and
query, with explicit lexical-field weights, deterministic tie-breaking, and
recorded relevance and latency evidence.

**Architecture:** Reuse SQLite FTS5 `symbol_search` as the lexical index and
keep kind/language/path filters as SQL hard constraints. Ordinary lexical
queries use weighted BM25 as their primary order; the existing deterministic
heuristic and stable path/line/name sequence resolve ties. Generation and
ranking-path intents retain their explicit routing because they deliberately
bypass the FTS candidate query. Do not introduce semantic retrieval, a vector
service, or a second search tool.

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

- [x] Select SQLite FTS5 `bm25(symbol_search, 10.0, 7.0, 3.0, 2.0)` for the
  judged fixture: name, qualified name, signature, and summary are weighted in
  that order. It preserves the fixture's exact-name, identifier, summary,
  path-scoped, and no-result expectations while retaining explicit
  generation/path-intent routing outside FTS.

- [x] Fix tokenizer, named field weights, candidate limit, deterministic
  tie-break sequence, and incremental FTS update lifecycle in this checklist.
  Tokenizer: FTS5 `unicode61`; weights: name 10, qualified name 7, signature
  3, summary 2; candidate limit: 400; order: BM25 ascending, existing
  deterministic score descending, exported, path, start line, then name.
  `persistFileIndexResult()` replaces each file's FTS rows transactionally,
  so incremental updates require no separate lifecycle.

- [x] Keep ranking explanations request-only. The selected change exposes no
  new ordinary discovery payload fields; add an explanation contract only when
  a caller has a concrete diagnostic need and a bounded requested surface.

## Task 3: Implement and Measure Only When Selected

- [x] Add only the selected deterministic ranking behavior and focused tests.
  Ordinary lexical candidates carry their weighted BM25 score into the stable
  sorter; exact lookup and SQL kind/language/path constraints remain hard
  constraints. The six focused engine tests passed in CI mode in 10.98 seconds.

- [x] Record precision@k, MRR, zero-result rate, warm latency, and index-size
  delta for the judged fixture, with exact command and raw expected output.
  The warmed five-query fixture returned the expected first result for all four
  result-bearing queries (precision@1 `1.00`, MRR `1.00`); the deliberate
  no-result query makes the zero-result rate `1/5` (`20%`). A direct warm run
  took `16.04ms` total (`3.21ms/query`) and returned:
  `refreshSessionToken`; `HTTPServer`, `listen`; `refreshSessionToken`;
  `rankingWidget`; and `[]`. Reproduce the judged results with
  `CI=1 pnpm exec vitest run --no-file-parallelism tests/engine-behavior.test.ts
  --testNamePattern='keeps judged lexical'`; the direct measurement reused
  `createFixtureRepo`, `indexFolder`, and `searchSymbols` with one warm-up
  pass. Index-size delta is `0 B` by construction: this change
  touches neither `src/storage-schema.ts` nor `src/indexing.ts`, so it cannot
  change persisted FTS rows or the SQLite index artifact.

- [x] Run affected engine/interface tests, `CI=1 pnpm type-lint`, package
  smoke when the shipped surface changes, `pnpm check:version-bump`, and
  `git diff --check`. The recorded targeted engine/interface checks, type lint,
  package smoke, version decision, and whitespace check passed before PR #26;
  run `29871942353` then passed Fast required checks and Windows compatibility
  for final exact head `edeab45`, which merged.
