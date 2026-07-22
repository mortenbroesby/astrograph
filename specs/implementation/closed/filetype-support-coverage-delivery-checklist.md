# File-Type Support Coverage and Discovery Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](../planned/4_high-impact-followups-epic.md),
> Story 12.
>
> **Status:** Done — no runtime change was warranted. The requested extensions
> were already covered by the registry, focused fixtures, public status, and
> user-facing documentation; this closeout records that evidence.

**Goal:** Make common file-type support explicit, tested, and discoverable;
add only extensions whose intended support tier and user value are evidenced.

**Architecture:** `src/language-registry.ts` is the single source of truth.
Parsed JavaScript/TypeScript-family files may receive graph support; fallback
extensions receive only path discovery, literal text search, and deterministic
file summaries. A fallback extension must never be represented as a language
filter value or as symbol/graph support without a parser, schema, and quality
decision.

**Current verified registry baseline:**

| Extension set | Current tier | Summary strategy |
| --- | --- | --- |
| `.js`, `.cjs`, `.mjs` | graph (`js`) | structured |
| `.md`, `.mdx` | discovery | Markdown headings |
| `.yaml`, `.yml` | discovery | top-level YAML keys |
| `.txt` | discovery | non-empty text lines |

**Likely files:** `src/language-registry.ts`, `src/types.ts`,
`src/types/retrieval.ts`, `src/filesystem.ts`, `src/file-summary.ts`,
`tests/filesystem-scan.test.ts`, `tests/engine-behavior.test.ts`,
`tests/interface.test.ts`, `docs/getting-started/concepts.md`,
`docs/reference/cli.md`, and API specs only if the public registry/status
contract changes.

## Task 1: Reproduce and classify the requested support

- [x] Start with `get_project_status`; refresh the Astrograph index only if it
  is stale. Inspect the language registry, scanner, file-summary path, and
  public status contracts before raw broad search.
- [x] Run the baseline:

  ```bash
  pnpm exec vitest run tests/filesystem-scan.test.ts tests/engine-behavior.test.ts tests/interface.test.ts
  pnpm type-lint
  ```

  Evidence: the merged delivery PR #46 (`84ecf396`) passed exact-head Fast
  required checks and Windows compatibility/package smoke. The current
  closeout reran the scanner fixture and focused `.mjs`/`.cjs` graph fixtures
  successfully; the exact-head CI evidence remains the authoritative full
  baseline.
- [x] Build an extension matrix for the requested `.js`, `.cjs`, `.mjs`,
  `.md`, `.txt`, `.yaml`, and `.yml` paths. Record scanner inclusion,
  normalized language (if any), support tier, available tools, summary source,
  index behavior, and CLI/MCP visibility.
- [x] Classify each observed gap as a registry defect, scanner exclusion,
  summary defect, documentation gap, or a request for a new parser/graph
  contract. Stop for an ADR if it needs a new parser or changes support-tier
  semantics. **Decision:** no gap. `.js`, `.cjs`, and `.mjs` normalize to
  graph-capable `js`; `.md`, `.yaml`, `.yml`, and `.txt` are discovery-only,
  visible through `find_files`, `search_text`, `get_file_summary`,
  `get_project_status`, and diagnostics, with the documented deterministic
  summary sources. No parser, scanner, or public-contract change is selected.

## Task 2: Add the smallest supported coverage

- [x] Add missing fixtures first for every selected extension, including mixed
  case and a nested path. Assert the exact tier and summary source rather than
  merely asserting that a file exists.
- [x] For a JavaScript module extension, map it to `js` only if the current
  tree-sitter JavaScript parser accepts it and symbol/graph fixtures pass.
- [x] For YAML, Markdown, and text, preserve discovery-only behavior unless a
  separately selected parser contract exists. Exercise `find_files`,
  `search_text`, and `get_file_summary`; do not add a false language filter.
- [x] Add or correct the smallest registry/scanner/summary implementation only
  when the matrix proves a missing or inconsistent path. **Not needed:** the
  existing registry and summaries already satisfy the matrix.

## Task 3: Make the contract discoverable

- [x] Document the supported extension matrix and explain graph versus
  discovery-only tiers in the user-facing concepts/CLI documentation.
- [x] Ensure project-status/diagnostics registry output and MCP/CLI envelopes
  expose the same current extensions and tier semantics.
- [x] Update `specs/api-design/mcp-tools.md` or `cli-api.md` only if a public
  field, enum, or tool behavior changes.

## Task 4: Verify and commit

- [x] Run the Task 1 focused suite, `pnpm check:version-bump`, and `git diff
  --check`.
- [x] Run `pnpm test:package-bin` when CLI/MCP installation or packed-package
  behavior changes; run `pnpm test` when scanner/index/retrieval behavior
  changes beyond the focused fixtures.
- [x] Commit with `feat: extend file-type support` only for a runtime feature;
  use a documentation/test-appropriate conventional subject when no runtime
  support changes. Merge source changes only after exact-head Fast and
  Windows/package-smoke CI pass. **Closeout:** no runtime source change is
  required; PR #46 is the exact-head implementation evidence.
