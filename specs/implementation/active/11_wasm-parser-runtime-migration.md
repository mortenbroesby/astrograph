# WASM Parser Runtime Migration

> **Status:** Active — selected by the user on 2026-07-27 after packaged
> global installation failed on Linux under Node 20 and 24.

**Goal:** Remove the native `tree-sitter` installation boundary while retaining
Astrograph's existing supported-language and symbol-extraction behavior.

**Architecture:** Replace the Node C++ binding with `web-tree-sitter@0.25.10`
and `tree-sitter-wasm@1.0.7`, which packages precompiled grammar WASM assets.
Keep language adapters and symbol
walkers as Astrograph-owned logic behind one asynchronous parser boundary;
neither the CLI nor MCP contracts change. A grammar asset source is accepted
only when it covers every currently supported language, has compatible
licenses, and can be packaged without a build tool or network request on the
user's machine.

**Tech Stack:** TypeScript, Node.js 20/22/24, `web-tree-sitter`, packaged
WASM grammar assets, tsdown, Vitest, `npm pack`, GitHub Actions.

## Why This Is Necessary

`tree-sitter@0.25.0` contains no prebuilt core runtime for the tested Linux
environment. npm therefore falls back to a native C++ compile; it fails under
the Node 20 and Node 24 package-install gates. macOS source builds succeeding
does not repair the published Linux consumer path.

## Non-goals

- Do not add an operating-system-specific binary matrix or require users to
  install compilers.
- Do not download grammars at runtime, add telemetry, or change MCP/CLI JSON.
- Do not broaden language support during the migration.
- Do not retain the native parser as a fallback: that would preserve the
  installation failure we are removing.

## Task 1: Select and Prove the Asset Source

**Files:** `package.json`, `pnpm-lock.yaml`, a focused parser-fixture test,
and this checklist.

- [x] Inventory every current adapter (Bash, C, C#, C++, CSS, embedded
  templates, Go, HTML, Java, JavaScript, JSON, PHP, PowerShell, Python, Ruby,
  Rust, Scala, TypeScript, and TSX) against the candidate asset package.
- [x] Verify the asset license and package contents. `tree-sitter-wasm@1.0.7`
  declares MIT and supplies a loadable `.wasm` for every one of Astrograph's
  20 language adapters; `tests/parser-wasm-assets.test.ts` proves that mapping.
  The clean packed-package smoke installs npm dependencies without a parser
  postinstall build and loads every selected grammar through the global binary.
- [x] Add a focused proof that initializes the WASM runtime and parses
  JavaScript plus one non-JavaScript fixture from package assets.

**Implementation note (2026-07-28):** `tree-sitter-wasm@1.0.7` loads all 19
Astrograph grammar variants (including PowerShell) through
`web-tree-sitter@0.25.10`. The loader caches only the grammar requested by an
indexed file. The complete asset pack is approximately 144 MB upstream, while
Astrograph uses approximately 23 MB of its assets; extracting a smaller
Astrograph-owned asset package is a size optimization, not a reason to retain
the native install boundary.

**Acceptance criteria:** One version-pinned asset source proves all existing
adapters, or the migration stops and records the missing-grammar blocker rather
than silently dropping support.

## Task 2: Replace the Shared Parser Boundary

**Files:** `src/parser/tree-sitter.ts`, `src/parser/language-adapters.ts`,
`src/tree-sitter-grammar-shims.d.ts`, callers requiring asynchronous parsing,
and focused parser tests.

- [x] Create the smallest lazy, process-local WASM runtime initializer and
  grammar loader; cache only initialized runtime/language values.
- [x] Convert the shared parser call chain to await that boundary while
  preserving adapter names, emitted symbols, imports, ranges, and fallback
  reasons.
- [x] Delete the native `@astrograph/tree-sitter` alias and all native grammar
  dependencies only after the replacement parses every existing fixture.

**Acceptance criteria:** Existing parser fixtures produce the same observable
symbol/import output with no Node native addon loaded.

## Task 3: Package and Node Compatibility Proof

**Files:** package smoke script, package files/build configuration only where
needed, Node compatibility workflow evidence, README/troubleshooting text.

- [x] Assert the packed tarball contains no native Tree-sitter dependency.
  The package manifest is checked after `pnpm pack`; runtime/grammar loading is
  covered by the focused parser fixture suite.
- [x] Assert the packed package resolves the runtime and every selected grammar
  asset, and contains no native Tree-sitter dependency. The focused package
  smoke packs, globally installs, and indexes all 20 grammar fixtures; package
  metadata continues to reject both `tree-sitter` and `@astrograph/tree-sitter`.
- [x] Run the packed global-install smoke locally under Node 20.19, 22.23.1,
  and 24.13. The manual Linux Node 20/24 workflow uses the same focused packed
  WASM smoke without adding a trigger or runner cost.
- [x] Update user-facing Node/parser wording: Node 20.19+, 22, and 24 remain
  supported, and parsing no longer needs a Tree-sitter compiler or native addon.

**Acceptance criteria:** A clean Linux global install and indexed fixture pass
on Node 20 and 24 without a compiler or native Tree-sitter build.

## Verification and Release Checkpoint

- [ ] `pnpm type-lint`
- [ ] Focused parser fixture tests
- [x] `pnpm test:package-bin:wasm` under Node 20, 22, and 24
- [ ] `pnpm check:version-bump --base origin/main`
- [ ] `git diff --check`
- [ ] Apply the release-decision skill; this is a patch-level runtime fix and
  must receive the next alpha version before publication.
