## 1. Establish Trustworthy Comparison Evidence

- [x] 1.1 Add the selected change to the `BACKLOG.md` active manifest in an isolated implementation worktree and verify the recorded branch, base SHA, ownership, and next action match the live task.
- [x] 1.2 Add focused failing tests for jCodeMunch alias expansion, tool-error rejection, missing source bodies, and successful two-symbol batches; verify the new cases fail against the current harness for the intended reasons.
- [x] 1.3 Update `bench/scripts/jcodemunch-comparison.mjs` to resolve canonical ids, batch both declared targets, validate structured source success, and exclude failures from aggregates; verify `bench/tests/jcodemunch-comparison.test.ts` passes.
- [x] 1.4 Record source-response bytes and tokens separately from total workflow cost and verify generated source-free JSON/report aggregates distinguish both measures without committing raw responses.

## 2. Compact Exact-Source Output

- [x] 2.1 Add focused characterization and failing compact-format tests for default JSON, single and batched Unicode source items, empty results, error fallback, auto thresholds, malformed rows, and exact decode equality; verify failures identify only missing `get_symbol_source` support.
- [x] 2.2 Expose the existing `format` option on the `get_symbol_source` MCP schema and extend `src/compact-mcp.ts` with the smallest positional `agc1` encoding that retains each item once; verify compact decoder round trips restore the complete validated v1 envelope including compatibility fields.
- [x] 2.3 Extend the live MCP interface/stdio coverage to prove omitted format remains ordinary JSON, explicit compact output decodes losslessly, content-reference sessions remain JSON, and unsupported or failed output falls back safely; verify `tests/interface.test.ts` passes.

## 3. Correct the Comparison Record

- [x] 3.1 Run three isolated successful comparison trials per server on one exact commit and verify all source-producing responses contain both requested implementations with raw source-bearing evidence only under ignored `.benchmarks/`.
- [x] 3.2 Update `docs/reviews/jcodemunch-comparison-2026-09-06.md` and `docs/guides/benchmarks.md` with corrected workflow/source-response metrics, the invalid earlier-run explanation, alias semantics, versions, SHA, and reproduction commands; verify every reported aggregate recomputes from the ignored evidence.
- [x] 3.3 Decide whether the corrected evidence justifies a separate warm-index optimization change and record that decision without adding index work to this change.

## 4. Verification and Delivery

- [x] 4.1 Run the focused benchmark/compact/interface tests, `pnpm build`, and `pnpm type-lint`; fix scoped failures and record unrelated baseline failures separately.
- [x] 4.2 Bump the monotonic package version, run `pnpm check:version-bump --base origin/main`, `pnpm verify:fast`, the repository release-decision workflow, and `pnpm exec openspec validate improve-exact-source-parity --strict`; verify every required gate passes.
- [x] 4.3 Review the minimal diff, secret-scan changed files, commit and push the implementation branch, and verify its remote SHA and exact-head required CI before merge.
- [x] 4.4 Merge through GitHub, verify `origin/main` and main CI at the exact merged commit, sync the delta spec, and archive the completed OpenSpec change.
