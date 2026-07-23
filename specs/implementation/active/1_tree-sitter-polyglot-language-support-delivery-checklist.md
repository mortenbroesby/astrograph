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
PowerShell is an additional user-selected, community-maintained grammar. It is
not counted as proof that the unbounded community catalog is supported; it
must meet the same ABI and fixture gate as an upstream parser.

**Tech Stack:** TypeScript, Node.js `>=22.12.0`, `tree-sitter@0.25.0`,
Tree-sitter grammar adapters, SQLite, pnpm, and Vitest.

**Boundaries:** Do not claim the unbounded community grammar ecosystem is
fully supported. Do not add a parser download service, dynamic grammar loading,
network access, a daemon, or a hidden fallback that labels unsupported imports
as graph evidence. Preserve the current four-language JSON/MCP behavior.

## Risk and unknowns gate

Before a language moves from installed to public support, record evidence for
each of these cases. An unknown is a reason to keep the language private or
park it, never to infer a `graph` tier.

- [ ] **Runtime and platforms:** supported Node 22/24 installation, native ABI
  load, macOS/Linux/Windows package behavior or an explicit platform limit,
  and package licence/provenance. Re-test clean installs rather than relying on
  one developer's warmed package store.
- [ ] **Grammar correctness:** valid and invalid syntax, error nodes, empty
  files, very large files/chunk recovery, Unicode identifiers, CRLF input, and
  generated/minified input remain deterministic and bounded.
- [ ] **Language semantics:** fixtures cover the declarations that users
  expect, nested declarations/namespaces/modules, overloads or duplicate
  names, comments/docstrings, and import forms. Claims outside those fixtures
  stay unavailable.
- [ ] **Repository integration:** extension collisions and case sensitivity,
  ignored/generated/binary files, file-size limits, worker concurrency, cache
  invalidation, existing database rows, CLI filters, MCP validation, and
  diagnostics snapshots preserve their v1 behavior.
- [ ] **Cost and rollback:** measure native package and indexing cost per
  batch; pin compatible versions; document a safe exclusion/rollback for a
  grammar that fails CI or a supported platform.

## Delivery log

- [x] **Batch 1 — Python, Bash, PowerShell, C#:** upgraded the Node binding
  from `tree-sitter@0.21.1` to `0.25.0`, and verified native parser loading
  with `tree-sitter-python@0.25.0`, `tree-sitter-bash@0.25.1`,
  `tree-sitter-powershell@0.26.4`, and `tree-sitter-c-sharp@0.23.5`.
  JavaScript was upgraded to `tree-sitter-javascript@0.25.0`; the existing
  TypeScript grammar loads successfully on the new runtime. Python, Bash,
  PowerShell, and C# are now fixture-backed `structured` adapters with no
  import/relation claim.
- [ ] Verify the upgraded runtime through the repository's Node 22 CI before
  release. Local Node 24 source builds require the temporary
  `CXXFLAGS=-std=c++20` workaround because `tree-sitter@0.25.0` declares a
  C++17 build setting while Node 24 headers require C++20.
- [x] **Batch 2 — Java, Go, Rust, JSON:** native parser loading and
  deterministic structured fixtures pass for Java classes/methods, Go
  functions, Rust structs/functions, and JSON top-level keys. JSON moved from
  discovery fallback to structured indexing; nested keys intentionally remain
  out of the symbol list to avoid noisy duplicate configuration symbols. No
  Batch 2 language claims import/relation graph support.
- [x] **Batch 3 — HTML, CSS, C, C++:** native parser loading and structured
  fixtures pass for HTML elements, CSS rule selectors, C structs/functions,
  and C++ classes/methods/functions. Header extension overlap is deterministic:
  `.h` belongs to C while C++ uses `.hh`, `.hpp`, and `.hxx`. All remain
  structured-only pending language-specific relation evidence.
- [x] **Batch 4 — PHP, Ruby, ERB/EJS, Scala:** PHP uses the package's explicit
  `php` grammar export rather than its non-language default bundle; PHP and
  Ruby class/method fixtures, Scala class/function fixtures, and parser-backed
  empty ERB/EJS symbol fixtures pass. They remain structured-only.

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
- [ ] Use this value-first, sequential installation order. Deno projects use
  the already-supported JavaScript/TypeScript adapters, so Deno needs no
  separate grammar package. A failed package load, incompatible native ABI, or
  disproportionately complex adapter is recorded as **parked** in this
  checklist and does not block the other languages in its batch:

  | Batch | Languages | Why this order |
  | --- | --- | --- |
  | 0 — already available | JavaScript, JSX, TypeScript, TSX | React and Deno source is covered now. |
  | 1 — active quick wins | Python, Bash, PowerShell, C# | Common automation and services alongside the requested .NET backend. |
  | 2 | Java, Go, Rust, JSON | Common backend/services plus ubiquitous monorepo configuration. |
  | 3 | HTML, CSS, C, C++ | Front-end assets and native/tooling code. |
  | 4 | PHP, Ruby, ERB/EJS, Scala | Common product stacks and templating. |
  | 5 | OCaml, Haskell, Julia, Verilog | Specialist services, research, and hardware work. |
  | 6 | Agda, Regex, JSDoc | Niche/source-embedded grammars; validate the user-facing file value before shipping. |

  Each batch is installed, load-tested, adapted, and reviewed before the next
  batch begins. A parked language is revisited only after the remaining quick
  wins are complete or new compatibility evidence appears.
- [x] Complete Batch 1 with parser-load tests, deterministic symbol/range
  fixtures, registry entries, and structured-only tier disclosure. The
  runtime upgrade removed the former large-TypeScript-file chunk-recovery
  fallback for the 900-symbol regression fixture; the test now proves that
  improved behavior rather than reporting a false fallback.
- [x] Complete Batch 2 with native-load checks, registry entries, deterministic
  structured fixtures, and CLI/MCP/diagnostics contract updates. Keep its
  platform, Unicode, malformed-input, and performance evidence open under the
  risk-and-unknowns gate until explicitly measured.
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
