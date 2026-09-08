## 1. Regression Proof

- [x] 1.1 Add the smallest public engine fixture that proves the current scoped
  target beyond 400 unscoped FTS candidates is omitted, lexical-only recall can
  be intersected away, and weaker BM25 evidence can precede an exact name; run
  `pnpm exec vitest run tests/engine-behavior.test.ts -t "selection and ranking"`
  and verify the assertions fail before production changes.

## 2. Candidate Selection and Ordering

- [x] 2.1 Correct the BM25 weight vector for the complete `symbol_search`
  column order in `src/retrieval.ts` and verify the focused name-versus-summary
  ordering assertion passes.
- [x] 2.2 Page deterministic FTS results until 400 in-scope candidates or
  exhaustion, merge them with the existing scoped lexical candidates by symbol
  ID, and verify the focused scope and lexical-recall assertions pass.
- [x] 2.3 Make the existing heuristic score the primary ordering key and BM25
  the next deterministic tie-breaker, then verify exact-name-first and repeated
  stable-order assertions pass without changing public response shapes.

## 3. Benchmark Evidence

- [x] 3.1 Extend the smallest existing deterministic benchmark fixture needed
  to report target recall, first-relevant rank, false positives, scoped recall,
  exact tokenizer tokens, and retrieval latency; run the same fixture before
  and after on the exact comparison commits and commit only source-free
  aggregate evidence.

## 4. Delivery

- [x] 4.1 Run the focused test, `pnpm build`, `pnpm type-lint`,
  `pnpm check:version-bump --base origin/main`,
  `openspec validate correct-search-selection-ranking --strict`, and
  `pnpm verify:fast`; apply the patch release decision and review the minimal
  diff for unrelated or sensitive content.
- [ ] 4.2 Commit and push the implementation branch, require exact-head CI,
  merge and verify remote `main`, publish/read back the required immutable npm
  version, validate the installed runtime with a fresh client, sync and archive
  the OpenSpec change, and retire the completed worktree only after no unique
  files remain.
