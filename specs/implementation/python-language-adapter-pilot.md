# Python Language Adapter Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Astrograph's hard-coded JS/TS parser path with an adapter-driven language contract, then ship a structured-only Python pilot backed by `tree-sitter-python`.

**Architecture:** Introduce a first-class language adapter layer that owns both parser behavior and language metadata, including extensions, support tiers, summary strategies, and tool availability. Reframe the current JS/TS tree-sitter parser as one adapter family, then add a Python adapter that supports symbol extraction and structured retrieval without claiming graph-tier import/reference semantics.

**Tech Stack:** TypeScript, Node 24, Vitest, `tree-sitter`, `tree-sitter-javascript`, `tree-sitter-typescript`, and `tree-sitter-python`.

**Verification pointers:**
- `tests/parser.golden.test.ts`
- `tests/engine-behavior.test.ts`
- `tests/interface.test.ts`
- `tests/engine-contract.test.ts`
- `pnpm test:package-bin`

---

## Task 1: Establish the adapter contract and migrate JS/TS onto it

**Files:**
- Modify: `package.json`
- Modify: `src/parser.ts`
- Modify: `src/parser/shared.ts`
- Modify: `src/language-registry.ts`
- Modify: `src/types/config.ts`
- Modify: `src/types/retrieval.ts`
- Modify: `src/types/diagnostics.ts`
- Create: `src/languages/index.ts`
- Create: `src/languages/types.ts`
- Create: `src/languages/tree-sitter-js-family.ts`
- Test: `tests/parser.golden.test.ts`
- Test: `tests/interface.test.ts`
- Test: `tests/engine-contract.test.ts`

- [ ] **Step 1: Establish baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/parser.golden.test.ts tests/interface.test.ts tests/engine-contract.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Add a full language-adapter contract**

Define an adapter interface that owns:

- the language id and extension list
- support tiers and per-tier tool availability
- summary strategies
- parser backend id
- `parse()` behavior for structured indexing

Move `SupportedLanguage` beyond the current JS/TS-only union so the registry and parser dispatch no longer need independent hand-maintained language truth. Keep compatibility-sensitive public outputs stable except where language support snapshots intentionally gain adapter-driven metadata.

- [ ] **Step 3: Reframe the existing tree-sitter parser as the JS-family adapter**

Split the current `parseWithTreeSitter()` path so the JavaScript / TypeScript family becomes one adapter implementation rather than the parser singleton for the whole engine. Preserve existing output shape, stable-id generation, chunk-recovery metadata, and current support-tier behavior for `ts`, `tsx`, `js`, and `jsx`.

- [ ] **Step 4: Make the registry adapter-driven**

Replace the static `LANGUAGE_SUPPORT_REGISTRY` construction with adapter-supplied descriptors. Preserve existing discovery / structured / graph semantics for current JS-family languages, but ensure the registry snapshot, diagnostics, and project-status responses derive from adapters rather than duplicated configuration tables.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/parser.golden.test.ts tests/interface.test.ts tests/engine-contract.test.ts
```

Expected: JS/TS parser golden tests remain deterministic and registry / contract outputs stay compatible for existing languages.

---

## Task 2: Add the Python structured-retrieval adapter

**Files:**
- Modify: `package.json`
- Modify: `src/parser/shared.ts`
- Modify: `src/languages/index.ts`
- Modify: `src/language-registry.ts`
- Modify: `src/storage.ts`
- Create: `src/languages/tree-sitter-python.ts`
- Test: `tests/parser.golden.test.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/interface.test.ts`

- [ ] **Step 1: Add the Python parser dependency**

Add `tree-sitter-python` to package/runtime dependencies and wire it into the adapter registry.

Expected: the package still builds and the source parser can select a Python adapter by language id.

- [ ] **Step 2: Implement structured-only Python parsing**

The Python adapter must extract:

- top-level functions
- classes
- methods
- imports
- constants
- docstring-backed summaries
- exact line and byte spans

Do not implement graph-tier reference/importer/dependency behavior for Python in this slice. Decorators may appear in signatures or summaries, but graph semantics and deeper symbol relationships stay out of scope.

- [ ] **Step 3: Declare honest Python support tiers**

Mark Python as:

- `discovery`
- `structured`

Do not mark Python as `graph`. Tool-availability metadata must reflect that `search_symbols`, `get_symbol_source`, `get_file_outline`, `get_file_summary`, `get_context_bundle`, and `get_ranked_context` are supported, while graph tools remain unavailable.

- [ ] **Step 4: Ensure structured retrieval flows use the Python adapter**

Confirm the indexed symbol and file-summary paths can consume Python parse output without JS-specific assumptions. `get_file_summary` and related support-tier outputs should present Python as structured support, not fallback discovery.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/parser.golden.test.ts tests/engine-behavior.test.ts tests/interface.test.ts
```

Expected: Python fixtures index successfully, emit structured symbols, and surface correctly through retrieval and support-tier reporting.

---

## Task 3: Document the language-tier contract and protect compatibility-sensitive surfaces

**Files:**
- Modify: `specs/roadmap/agent-parity-roadmap.md`
- Modify: `specs/api-design/library-api.md`
- Modify: `tests/engine-contract.test.ts`
- Modify: `tests/interface.test.ts`
- Test: `tests/engine-contract.test.ts`
- Test: `tests/interface.test.ts`
- Test: `src/scripts/smoke-package-bin.ts`

- [ ] **Step 1: Document the adapter-driven support model**

Update the relevant spec/API docs so Astrograph now describes language support as adapter-driven, with Python explicitly limited to structured retrieval in this slice. Avoid any wording that implies import graphs, call graphs, or blast-radius support for Python.

- [ ] **Step 2: Lock compatibility-sensitive outputs with tests**

Add or update assertions for:

- language registry snapshots
- project-status support tiers
- parser backend reporting
- package/bin setup behavior if any public help or output changes

Make sure new Python support appears where intended without mutating unrelated MCP / CLI contracts.

- [ ] **Step 3: Final verification**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-behavior.test.ts tests/interface.test.ts
pnpm test:package-bin
pnpm check:version-bump
git diff --check
```

Expected: all commands exit `0`, Python is surfaced as structured-only support, and package/bin behavior remains valid.

- [ ] **Step 4: Commit**

Run:

```bash
git add package.json src/parser.ts src/parser/shared.ts src/language-registry.ts src/storage.ts src/types/config.ts src/types/retrieval.ts src/types/diagnostics.ts src/languages/index.ts src/languages/types.ts src/languages/tree-sitter-js-family.ts src/languages/tree-sitter-python.ts specs/roadmap/agent-parity-roadmap.md specs/api-design/library-api.md tests/parser.golden.test.ts tests/engine-behavior.test.ts tests/interface.test.ts tests/engine-contract.test.ts
pnpm check:version-bump
git commit -m "feat: add adapter-driven python language support"
```

Expected: version policy passes before commit.
