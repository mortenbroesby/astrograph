## 1. Regression Proof

- [x] 1.1 Add one indexed fixture covering Unicode, emoji, CRLF, and same-line symbols; verify the focused test fails for current task-context or context-bundle source extraction.

## 2. Shared Range Extraction

- [x] 2.1 Add one internal UTF-8 byte-range extraction helper in `src/retrieval.ts`, route every persisted exact-range assembly call site through it, and verify the focused regression test passes.
- [x] 2.2 Verify `get_symbol_source`, task context, and context bundles return matching source, hashes, ranges, and token counts without changing their public response shapes.

## 3. Delivery

- [x] 3.1 Run `pnpm build`, `pnpm type-lint`, the focused UTF-8 behavior test, `pnpm check:version-bump --base origin/main`, and `pnpm exec openspec validate fix-context-source-byte-ranges --strict`; resolve scoped failures and record unrelated baseline failures separately.
- [x] 3.2 Apply the patch release decision, review and secret-scan the minimal diff, commit and push the implementation branch, and verify the remote SHA and exact-head required CI before archive.
