## 1. Establish Failing Boundaries

- [ ] 1.1 Restore `prebench:search-ranking` as `pnpm build`, add `prebench:relationship-evidence`, and verify `pnpm exec vitest run tests/benchmark-scripts.test.ts` passes.
- [ ] 1.2 Add a parser golden assertion that distinguishes `export ... from` from ordinary imports and verify it fails before parser behavior changes.
- [ ] 1.3 Add public discovery, context-bundle, and task-context tests with an alias, a barrel re-export, an unrelated first symbol, and multiple importer symbols; verify the tests fail because current results lack evidence or promote the wrong symbol.

## 2. Preserve Relationship Evidence

- [ ] 2.1 Add the optional re-export marker and optional relation-evidence arrays to public retrieval types, then verify `pnpm build` type-checks existing callers without a schema migration.
- [ ] 2.2 Mark actual re-export specifiers, preserve the marker in both normalizers, include it in import hashes, and verify the parser golden test plus existing import-refresh tests pass.

## 3. Make Retrieval Claims Honest

- [ ] 3.1 Attach high-confidence file-scoped import or re-export evidence to dependency/importer selections and verify ordinary package imports are not labeled re-exports.
- [ ] 3.2 Replace representative-symbol reference promotion with alias-aware identifier-boundary selection across every symbol in the importer; verify real use sites are returned in stable order and unrelated symbols are excluded.
- [ ] 3.3 Propagate accumulated evidence through discovery, context bundles, and task context while preserving current bounds and compatibility; verify all focused public-boundary tests pass.

## 4. Measure Correctness Before Cost

- [ ] 4.1 Add the deterministic `bench:relationship-evidence` runner using the existing exact tokenizer, at least three valid runs, stable-order and task-outcome rejection, and source-free aggregate output; verify its benchmark tests pass.
- [ ] 4.2 Run the identical fixture against exact before and after commits and publish relation recall, precision, false symbol claims, evidence/confidence coverage, exact response tokens, and latency in a source-free review.

## 5. Verify and Version

- [ ] 5.1 Bump the prerelease version for the observable response change and verify `pnpm check:version-bump` passes against the intended base.
- [ ] 5.2 Run `pnpm exec vitest run tests/parser.golden.test.ts tests/engine-behavior.test.ts tests/benchmark-scripts.test.ts`, `pnpm build`, `pnpm test`, and `pnpm exec openspec validate make-relationship-evidence-honest --strict`; record any unrelated baseline issue separately.
- [ ] 5.3 Run the repository packed-artifact verification and confirm the packed MCP/CLI returns the optional evidence contract without relying on source-tree imports.

## 6. Integrate and Read Back

- [ ] 6.1 Commit and push the implementation branch, open the scoped PR, and verify required CI on the exact remote head before merge.
- [ ] 6.2 Apply the repository release-decision workflow; when required, merge, publish the prerelease, verify registry/tag integrity, update the managed global runtime while preserving jCodeMunch, and prove a real relation call from a fresh client.
- [ ] 6.3 Sync and archive the completed OpenSpec change, commit and push the archive branch, verify exact-head CI and merge, then confirm clean `main`, matching `origin/main`, and removal of only this task's worktrees/branches.
