## Context

See `proposal.md` for motivation and `specs/agent-retrieval-efficiency/spec.md` for the public contract. JSON uses the shared tree-sitter path in `src/parser/tree-sitter.ts`; a `pair` currently falls through the generic structural-signature logic and keeps its complete range because its value node is not treated as the signature boundary. The symbol's stored source range is already independent from its signature.

## Goals / Non-Goals

**Goals:**

- Fix the shared parser boundary once so symbol search and file outlines receive the same bounded JSON signature.
- Preserve exact source, provenance, and existing top-level JSON symbol selection.
- Produce correctness-first, exact-tokenizer before/after evidence from clean immutable commits.

**Non-Goals:**

- Configurable truncation limits, partial value previews, nested JSON symbols, a new output encoding, or a new dependency.
- Changes to non-JSON structural signatures or public response field names.

## Decisions

### End JSON pair signatures at the value node

`extractStructuralSignature` in `src/parser/tree-sitter.ts` will use the JSON `pair` value node's start offset as the structural-signature boundary. This keeps the key and separator while excluding scalar, object, and array contents. `createSymbol` continues to use the complete pair as `rangeNode`, so explicit retrieval remains lossless.

Alternative: truncate the completed signature to a fixed character limit. Rejected because it retains arbitrary partial values, can split Unicode or escaped content, and requires a policy knob without improving discovery.

Alternative: add a JSON-only parser path. Rejected because the existing shared function already separates structural signature from source range; one node-type case is the smallest root-cause fix.

### Verify the public boundary before changing parser behavior

Add the smallest failing coverage in `tests/parser.golden.test.ts` and `tests/engine-behavior.test.ts`. The parser test proves large scalar/object/array signatures remain bounded while ranges remain complete. The engine test proves a five-result outline/search response stays bounded and `get_symbol_source` returns byte-, line-, hash-, and token-consistent full source.

### Measure aggregate evidence only

Add a `bench:json-discovery-records` runner and focused benchmark test using the existing `cl100k_base` tokenizer and benchmark conventions. Run the identical fixture at least three times against the exact base and implementation commits. Commit only source-free aggregates covering discovery bytes/tokens, target rank, exact-source bytes/tokens, fidelity, and latency.

## Risks / Trade-offs

- [Consumers may expect JSON values in signatures] -> Preserve every response field and exact-source path; document the intentional structural-signature change and bump the prerelease version.
- [Ending before the value may leave formatting-dependent whitespace] -> Reuse the existing signature whitespace normalization and assert one stable signature in the golden test.
- [A benchmark could claim savings while breaking retrieval] -> Reject runs unless target ordering is stable and exact source matches the fixture with consistent provenance and token accounting.

## Migration Plan

1. Establish failing parser and public retrieval tests on the exact base commit.
2. Apply the single parser-boundary change and run focused tests.
3. Compare clean before/after commits with `pnpm bench:json-discovery-records` and record aggregate evidence.
4. Run `pnpm build`, `pnpm test`, strict OpenSpec validation, version policy, and packed-artifact verification.
5. Deliver through exact-head CI, merge, guarded prerelease publication, managed global runtime update, and fresh-client readback; rollback by reverting the parser commit and publishing the next prerelease if required.
