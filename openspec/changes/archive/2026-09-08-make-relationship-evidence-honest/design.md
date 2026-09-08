## Context

See `proposal.md` for motivation. Import rows already persist JSON specifiers, but they do not preserve whether a statement was an import or re-export. Retrieval currently converts file dependency/importer rows into symbol matches by selecting a representative symbol, and exact-reference expansion repeats that selection after matching only the imported name. Public result types expose a reason but no evidence or confidence.

The change crosses parser, persisted analysis, retrieval, and benchmark boundaries. It must remain readable against existing indexes and compatible with existing clients, and it must not pre-empt the later P4 semantic graph.

## Goals / Non-Goals

**Goals:**

- Make the scope and strength of every graph-derived claim machine-readable.
- Preserve import aliases and actual re-export identity through persistence.
- Replace representative-symbol reference promotion with bounded symbol-source evidence.
- Measure correctness before token and latency cost on an identical deterministic fixture.

**Non-Goals:**

- No call graph, type-aware binding resolution, transitive alias resolution, or exhaustive semantic reference index.
- No database schema migration, dependency, response encoding, or new MCP tool.
- No claim that an identifier occurrence is a proven call site; it remains a medium-confidence symbol reference.

## Decisions

### Persist one optional re-export marker on import specifiers

Add `isReexport?: boolean` to `ImportSpecifier`. The tree-sitter import parser marks specifiers produced by `export ... from` statements, both import-specifier normalizers preserve the marker, and the import hash includes it. Existing JSON rows without the marker continue to mean ordinary import, so no database migration is needed.

Alternative considered: infer re-exports from relative versus package module specifiers. That is the current bug and cannot distinguish syntax. Storing a separate relation table is unnecessary for one boolean already carried by persisted JSON.

Compatibility-sensitive files: `src/types/retrieval.ts`, `src/parser/shared.ts`, `src/parser/tree-sitter.ts`, `src/file-analysis.ts`, and `src/doctor.ts`.

### Add optional evidence arrays to existing relation-bearing records

Define one exported `RelationEvidence` record with:

- `scope`: `file` or `symbol`
- `kind`: `import_specifier`, `reexport_specifier`, or `identifier_mention`
- `confidence`: `high` or `medium`
- source file, target file, module specifier, imported name, and local name

Add `relationEvidence?: RelationEvidence[]` to `QueryCodeSymbolMatch`, `ContextBundleItem`, and `TaskContextItem`. Arrays preserve multiple paths when an existing match accumulates reasons. Seed and non-relation records omit the field. File import/re-export facts are high-confidence but explicitly file-scoped; a symbol selected by an import specifier plus a bounded identifier occurrence is medium-confidence and symbol-scoped.

Alternative considered: add a parallel top-level file-relations response. That would duplicate selection and budgeting paths and create a broader public contract. Optional evidence on current records supplies the missing semantics while retaining response compatibility.

Compatibility-sensitive files: `src/types/retrieval.ts` and `src/retrieval.ts`.

### Promote every evidenced use-site, never a representative symbol

For reference expansion, resolve the matching import specifier by imported name, use `localName` when present, and inspect each persisted symbol source in the importer for an identifier-boundary occurrence. Return every matching symbol in stable existing order and no unrelated representative symbol. Re-exports remain file-scoped evidence and are not promoted as identifier references.

The evidence kind deliberately says `identifier_mention`, with medium confidence: this is stronger than a file import and honest about not being semantic binding resolution. Existing bounded graph depth, result limits, deduplication, and token budgeting remain unchanged.

Alternative considered: introduce tree-sitter reference queries and persist a semantic edge index. That belongs to P4 and is not required to stop false representative-symbol claims.

Compatibility-sensitive file: `src/retrieval.ts`.

### Benchmark one fixed adversarial relationship fixture

Add `bench:relationship-evidence` using the existing exact tokenizer and benchmark conventions. Its fixture has a target module with two exports, an importer with an aliased import, an unrelated first symbol, and multiple real use-site symbols, plus a barrel re-export. The script accepts an engine root so the verified before and after commits run the same fixture at least three times. It rejects execution failures, a missing seed outcome, fewer than three runs, unstable repeated ordering, or source-bearing committed output. Incorrect, missing, or unsupported relation evidence remains a valid measured baseline and is reported by the correctness metrics rather than rejected.

Report relation recall, precision, false symbol claims, evidence coverage, confidence coverage, exact response tokens, and latency separately. Add `prebench:relationship-evidence` and restore the missing `prebench:search-ranking` contract before collecting evidence.

Compatibility-sensitive files: `bench/scripts/measure-relationship-evidence.mjs`, `tests/benchmark-scripts.test.ts`, `package.json`, and the source-free review under `docs/reviews/`.

## Risks / Trade-offs

- [Identifier mentions can include a same-named property, string, or comment] -> Label the claim medium-confidence `identifier_mention`, require an import-specifier binding, use identifier boundaries, and defer semantic proof to P4.
- [Optional evidence increases response size] -> Measure exact tokens and reuse one compact record shape; do not add duplicate file-relation envelopes.
- [Changing import hashes causes a one-time refresh] -> Include the marker in the existing deterministic hash so cached analysis cannot silently retain the old meaning.
- [Old indexes lack the marker] -> Treat absence as ordinary import and rely on normal freshness/index refresh behavior for new re-export evidence.
- [Fresh-worktree full tests fail before build] -> Build first; restore the existing benchmark pre-build hook contract and retain focused characterization of the baseline failure.

## Migration Plan

1. Add failing parser and public retrieval tests plus the missing benchmark pre-build hook.
2. Persist and normalize the optional marker, then implement evidence-aware selection.
3. Run the deterministic benchmark against exact before and after commits and commit only aggregate source-free results.
4. Run focused tests, `pnpm build`, `pnpm test`, `pnpm exec openspec validate make-relationship-evidence-honest --strict`, packed-artifact verification, and exact-head CI.
5. Bump the prerelease version because observable retrieval output changes; merge, publish if required by the release decision, verify the global runtime with a fresh client, and archive the OpenSpec change.

Rollback is a normal revert of the behavior commit and prerelease. Optional fields and persisted JSON keep the prior reader compatible; no storage migration requires reversal.
