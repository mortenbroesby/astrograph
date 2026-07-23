# Provenance-First Symbol Contract Delivery Checklist

> **Epic:** [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md), Story 1
>
> **Selected by:** [High-Impact Product Follow-Ups Epic](../planned/4_high-impact-followups-epic.md), Story 4
>
> **Status:** Complete — merged with the deterministic lexical-ranking work as
> PR #26 after exact-head Fast and Windows compatibility CI passed.

**Goal:** Ensure a returned source slice is a verifiable address into one exact
source version, with deterministic identity, range, parser provenance, and
freshness evidence.

**Architecture:** Build on existing source/symbol output and storage metadata.
First record the actual current identity and range semantics, then change only
the smallest contract that cannot be independently verified. Do not add a new
retrieval tool, semantic system, or compatibility shim.

**Tech Stack:** TypeScript, Node.js 22 LTS, SQLite, tree-sitter, pnpm, Vitest,
existing CLI/MCP serialization and retrieval contracts.

---

## Task 1: Establish the Existing Source Contract

**Files:**
- Inspect: `src/retrieval.ts`, `src/storage.ts`, `src/file-analysis.ts`,
  `src/types/**`, `src/serialization.ts`
- Inspect tests: `tests/engine-contract.test.ts`, `tests/interface.test.ts`,
  `tests/engine-behavior.test.ts`
- Record: this checklist

- [x] Run the focused CI-mode baseline and record exact results.
  `CI=1 pnpm type-lint` plus `engine-contract`, `interface`, and
  `engine-behavior` pass: 126 tests passed, 1 skipped, in 161.36 seconds.

- [x] Map every source/symbol ID, relative-path normalization, range unit,
  source hash, parser backend, and freshness field currently returned by the
  library, CLI, and MCP.
  Symbol IDs are 16-character SHA-256 prefixes of
  `relativePath:kind:qualifiedName:startByte`; paths are normalized to portable
  repository-relative form. SQLite persists UTF-8 byte offsets, line ranges,
  integrity/content hashes, and parser fallback metadata, but public
  `SymbolSummary` and `get_symbol_source` expose only lines and `verified`.
  `verified` checks the indexed content snapshot, not disk freshness. Source
  slices currently use JavaScript string indexing with byte offsets, which is
  incorrect before non-ASCII text.

- [x] Create a compact fixture matrix for duplicate names, nested symbols,
  Unicode, CRLF, renamed files, fallback parsing, and Windows-style paths.
  Mark existing coverage before adding fixtures.
  Existing tests cover nested paths, rename cleanup, Windows-style patterns,
  and parser fallback metadata. They do not prove public source provenance or
  byte-correct Unicode/CRLF source extraction; those are the selected focused
  fixtures.

## Task 2: Specify the Verifiable Minimum

**Selection gate:** Task 1 shows an operator cannot independently verify a
returned slice using existing fields.

- [x] Define the smallest complete source/symbol provenance envelope: stable
  identity components, canonical relative path, byte/line range semantics,
  content hash, parser provenance, and freshness state.
  **Selected envelope:** each returned source item receives `provenance` with
  canonical path, UTF-8 byte range, source-file SHA-256 integrity hash, parser
  backend/fallback metadata, and `freshness: "indexed-snapshot"`. This is an
  honest statement about the retrieved snapshot; live-disk freshness remains
  the existing diagnostics contract.

- [x] State exact UTF-8 and CRLF behavior, duplicate/nested-symbol separator
  rules, changed-file behavior, and fallback-parser behavior. Do not retain a
  legacy shape solely for compatibility.
  `startByte`/`endByte` are zero-based, end-exclusive UTF-8 offsets in the
  indexed file; line numbers are one-based and include CRLF as one line break.
  The returned source range is calculated in UTF-8 bytes, so non-ASCII prefixes
  cannot shift a slice. IDs retain their persisted path/kind/qualified-name/
  byte-offset components; changed or renamed files receive a newly indexed
  identity. Parser fallback is reported directly from persisted metadata.

- [x] Add or update the API contract spec only for fields selected above:
  `specs/api-design/library-api.md`, `specs/api-design/mcp-tools.md`, and
  `docs/reference/cli.md` define the returned UTF-8 provenance envelope.

## Task 3: Implement and Prove the Selected Contract

- [x] Add the minimal retrieval/storage/serialization behavior and focused
  tests needed by Task 2; do not begin ranking or token-budget work.
  `get_symbol_source` now exposes byte ranges on symbols and provenance on
  each source item. Parser offsets and chunk splitting use UTF-8 byte counts.

- [x] Prove exact retrieval never returns content whose hash or range differs
  from recorded provenance, including Unicode/CRLF and stale/changed cases.
  A focused Unicode/CRLF fixture proves the returned source range starts after
  a multi-byte prefix, ends at its UTF-8 byte length, and reports the indexed
  parser snapshot. Existing refresh/stale fixtures cover changed files; live
  freshness intentionally remains diagnostics-owned.

- [x] Run targeted tests, `CI=1 pnpm type-lint`, packed-package smoke,
  `pnpm check:version-bump`, and `git diff --check`.
  Evidence: the full engine suite has 72 passed/1 skipped, interface has 13
  passed, the targeted Unicode/CRLF fixture passes, and the packed
  `0.5.0-alpha.135` package smoke passes. The staged-diff version guard is run
  again before the release-preparation commit.

- [x] Update this checklist, the Precision Epic, and the high-impact epic with
  measured evidence and the release decision. **Complete:**
  `pnpm release:plan --base v0.4.4-alpha.133` selected minor; apply set
  `0.5.0-alpha.135`. PR #26 run `29871942353` passed Fast required checks and
  Windows compatibility for final exact head `edeab45`, then merged.
