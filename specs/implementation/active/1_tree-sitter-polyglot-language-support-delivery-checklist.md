# Tree-Sitter Polyglot Language Support Delivery Checklist

> **Status:** Active — selected after the Precision/Munch epic closed.

**Goal:** Expand Astrograph from its current JavaScript-family-only parser
coverage to every parser currently listed in Tree-sitter's upstream
organization, while reporting only the support tier each language can prove.

**Architecture:** Tree-sitter is a parser framework; every grammar is a
separate generated `TSLanguage` artifact and Astrograph's current extraction
logic assumes JavaScript/TypeScript node names. Replace that implicit switch
with testable language adapters. An adapter may provide deterministic symbols
and imports only where its grammar and fixtures prove them; every other parser
remains explicitly structured-only rather than being presented as graph-ready.
The target baseline is the 24 upstream parsers named by Tree-sitter: Agda,
Bash, C, C++, C#, CSS, ERB/EJS, Go, Haskell, HTML, Java, JavaScript, JSDoc,
JSON, Julia, OCaml, PHP, Python, Regex, Ruby, Rust, Scala, TypeScript, and
Verilog. JavaScript and TypeScript already cover `js`, `jsx`, `ts`, and `tsx`.

**Tech Stack:** TypeScript, Node.js `>=22.12.0`, `tree-sitter@0.21.1`,
Tree-sitter grammar adapters, SQLite, pnpm, and Vitest.

**Boundaries:** Do not claim the unbounded community grammar ecosystem is
fully supported. Do not add a parser download service, dynamic grammar loading,
network access, a daemon, or a hidden fallback that labels unsupported imports
as graph evidence. Preserve the current four-language JSON/MCP behavior.

---

## Task 1: Freeze the grammar inventory and compatibility baseline

**Files:** `package.json`, `pnpm-lock.yaml`, `src/language-registry.ts`,
`src/types/config.ts`, `tests/language-registry.test.ts` (new), this checklist,
and `specs/architecture/adrs.md`.

- [ ] Record the exact upstream parser list, npm package/repository, grammar
  version, native ABI compatibility with `tree-sitter@0.21.1`, file-extension
  matrix, and licence for all 24 target parsers. Reject or pin a grammar that
  cannot be loaded by the installed Node binding; do not silently substitute a
  community grammar.
- [ ] Capture the current baseline: four graph-capable language entries
  (`js`, `jsx`, `ts`, `tsx`), their parser-output fixtures, parser package size,
  cold import time, and current `index_folder` behavior for unsupported files.
- [ ] Add the accepted adapter/tier architecture in ADR-008. A language may
  enter the public registry only with a fixture, deterministic symbol result,
  and an explicit `structured` or `graph` support declaration.
- [ ] Verify the baseline with:

  ```bash
  pnpm exec vitest run tests/parser.golden.test.ts tests/interface.test.ts
  pnpm type-lint
  ```

  Expected: current four-language behavior passes unchanged.

## Task 2: Introduce the adapter seam without changing existing behavior

**Files:** `src/parser/tree-sitter.ts`, `src/parser/**` (new adapter modules as
needed), `src/language-registry.ts`, `src/types/config.ts`, `src/types/**`,
`tests/parser.golden.test.ts`, and `tests/language-registry.test.ts`.

- [ ] Define a `LanguageAdapter` contract for grammar loading, extensions,
  top-level symbol extraction, import extraction, comment-summary handling,
  and support tier. Keep generic Tree-sitter lifecycle/chunk recovery shared.
- [ ] Move JS/JSX and TS/TSX behavior into adapters with byte/range/symbol-ID
  parity tests; no existing source, CLI, MCP, or diagnostic JSON may drift.
- [ ] Make the language registry derive its supported-language validation and
  diagnostics snapshot from adapters. Maintain deterministic extension
  collision handling and reject ambiguous ownership at startup/tests.
- [ ] Verify focused parser and interface tests, then run `pnpm type-lint`.

## Task 3: Add every verified upstream grammar in evidence-gated batches

**Files:** `package.json`, `pnpm-lock.yaml`, adapter modules,
`src/language-registry.ts`, parser fixtures/tests, `docs/guides/performance.md`,
and `specs/api-design/mcp-tools.md`.

- [ ] Add adapters and native grammar packages only after Task 1 pins their
  compatible versions. Cover the 24 upstream parser identities across batches
  while preserving the same adapter contract; do not ship a package that cannot
  load on the supported Node platforms.
- [ ] For each language, add a representative fixture with Unicode identifiers
  where grammar permits; assert parser load, deterministic symbol IDs, UTF-8
  byte/line ranges, `get_file_outline`, `get_file_tree`, search filtering, and
  diagnostics registry disclosure.
- [ ] Declare `graph` only after fixture-proven import extraction and relation
  behavior. Otherwise declare `structured`, return symbols/outlines honestly,
  and leave dependency graph expansion unavailable for that language.
- [ ] Measure package-size delta, cold parser-load time, and representative
  indexing latency per batch; document the result without mixing parser cost
  with retrieval quality claims.

## Task 4: Publish the public support contract and close safely

**Files:** `README.md`, `docs/README.md`, `docs/guides/performance.md`,
`specs/api-design/mcp-tools.md`, `specs/api-design/library-api.md`, this
checklist, roadmap/indexes, and focused tests.

- [ ] Document the exact supported parser set, extensions, support tiers,
  grammar/package versions, and unsupported-file fallback. State explicitly
  that the list is the upstream Tree-sitter organization set at delivery time,
  not every community grammar.
- [ ] Prove CLI, MCP, library exports, `diagnostics`, and `get_project_status`
  report the same registry; test invalid language filters and existing v1 error
  envelopes.
- [ ] Run focused Vitest, `pnpm type-lint`, `pnpm build`,
  `pnpm check:version-bump`, `git diff --check`, package smoke, and exact-head
  Fast CI. This runtime feature requires a minor version decision unless the
  release policy records a stricter result.
- [ ] Commit, push, review, merge, and record package/CI evidence here. Move
  the checklist to `closed/` only after all 24 target parser identities have
  fixture-backed registry entries or a recorded upstream/ABI exclusion.

## Acceptance evidence

- The public registry enumerates every upstream Tree-sitter parser identity
  from the Task 1 inventory, with package/version/extension/tier evidence.
- Existing JS/TS behavior remains compatible and deterministic.
- Every new language has a parser-load and symbol/range fixture; graph claims
  exist only where import/relation tests prove them.
- No dynamic downloads, background process, false graph claim, or vague
  “all Tree-sitter languages” marketing claim is introduced.
