# Tree-Sitter Polyglot Support Contract

> **Status:** Active — selected on 2026-08-28. This is the only live
> implementation checklist for Astrograph's public Tree-sitter language set.

**Goal:** Make the shipped 20-language WASM parser set explicit, deterministic,
measured, and truthful across the registry, diagnostics, documentation, and
tests.

**Architecture:** `src/language-registry.ts` is the authoritative static
contract for extension ownership, grammar identity, and traversal tier.
`src/parser/language-adapters.ts` derives the lazy WASM loader from that
registry. No grammar is downloaded at runtime or loaded through a native
fallback.

**Scope:** The JavaScript/TypeScript graph tier and the selected structured
monorepo languages. Keep OCaml, Haskell, Julia, Agda, Verilog, Regex, and JSDoc
out of the registry unless a later product decision supplies a file contract
and fresh value/asset evidence.

## Delivery checklist

- [x] Reconcile the obsolete native-binding plan with the released
  `web-tree-sitter@0.25.10` + `tree-sitter-wasm@1.0.7` runtime.
- [x] Make the public language registry own extension, grammar, and traversal
  data; derive adapters from it so those mappings cannot drift.
- [x] Prove all selected assets load and every structured-language fixture has
  deterministic symbols, including Unicode, CRLF, and malformed-input cases.
- [x] Add registry-to-adapter parity coverage and preserve JavaScript-family
  graph traversal.
- [x] Record a reproducible local cost baseline and the upstream package
  provenance. On macOS x64 / Node 22.23.1, 20 languages resolve to 19 selected
  WASM assets (23.30 MiB); fresh-process all-adapter loads were 69–94 ms, and a
  cold 20-file one-per-language repository indexed 28 symbols in 4,828.1 ms.
  The complete installed `tree-sitter-wasm` package was 143.65 MiB and
  `web-tree-sitter` was 5.66 MiB, so this is not a custom slim-asset package.
- [x] Publish the grammar provenance and cost boundaries in user-facing docs.
- [ ] Run focused parser, registry, interface, package, and version-policy
  verification for the exact branch head; then make the release decision.

## Verification pointers

- `tests/language-registry.test.ts` — deterministic public registry ownership.
- `tests/language-adapters.test.ts` — registry/adapter parity and graph tier.
- `tests/parser-wasm-assets.test.ts` — all selected packaged asset paths load.
- `tests/parser.golden.test.ts` — deterministic parser output and malformed
  structured-input bounds.
- `tests/interface.test.ts` — diagnostics exposes the same registry contract.
- `docs/reference/language-support.md` — user-facing tier, grammar, and
  exclusion contract.
- `docs/guides/performance.md` — measurement method and non-guarantee bounds.
