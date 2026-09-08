## 1. Establish the regression boundary

- [x] 1.1 Add `prebench:json-discovery-records` and `bench:json-discovery-records` script boundaries and verify `pnpm exec vitest run tests/benchmark-scripts.test.ts` passes.
- [x] 1.2 Add a parser golden case with large scalar, object, and array JSON values; verify it fails because signatures scale with their values while the complete ranges remain available.
- [x] 1.3 Add a public engine test for five-result discovery plus exact source/provenance fidelity; verify it fails because the discovery payload embeds complete JSON values.

## 2. Bound JSON structural signatures

- [x] 2.1 End JSON `pair` signatures at their value node in the shared structural-signature path and verify the parser golden test passes with one stable key-only form.
- [x] 2.2 Verify symbol search and file outlines use bounded signatures while exact source preserves the complete property with matching byte range, line range, hash, and token count.
- [x] 2.3 Run the existing parser and retrieval tests to verify non-JSON signatures and top-level-only JSON symbol selection remain unchanged.

## 3. Measure before and after

- [x] 3.1 Add a deterministic source-free benchmark using `cl100k_base`, at least three valid runs, a five-result limit, stable ordering, and exact-source fidelity rejection; verify its focused benchmark test passes.
- [x] 3.2 Run the identical fixture against exact clean before and after commits and publish discovery bytes/tokens, target rank, exact-source bytes/tokens, fidelity, and latency in a source-free review.

## 4. Verify the release artifact

- [x] 4.1 Bump the prerelease version for the observable signature change and verify `pnpm check:version-bump --base origin/main` passes.
- [x] 4.2 Run focused tests, `pnpm build`, `pnpm test`, and `pnpm exec openspec validate bound-json-discovery-records --strict`; record any unrelated baseline issue separately.
- [x] 4.3 Run `pnpm test:package-bin` and verify the packed CLI/MCP preserves bounded JSON discovery and lossless explicit source without source-tree imports.

## 5. Deliver and archive

- [x] 5.1 Commit and push the implementation branch, open the scoped PR, and verify required CI on the exact remote head before merge.
- [ ] 5.2 Apply the release-decision workflow; when required, merge, publish, verify registry/tag integrity, update the managed global runtime while preserving jCodeMunch, and prove the bounded discovery plus exact-source path from a fresh client.
- [ ] 5.3 Sync the delta spec and archive the completed change, verify the archive PR on its exact head, merge it, then confirm clean `main`, matching `origin/main`, and removal of only this task's worktrees and branches.
