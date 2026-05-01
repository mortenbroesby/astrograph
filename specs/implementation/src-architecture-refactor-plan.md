# Source Architecture Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the source architecture review into a sequence of behavior-preserving refactor slices that reduce `src/storage.ts`, split parser internals, unify CLI/MCP command contracts, and narrow shared type ownership.

**Architecture:** Keep `src/index.ts` as the package-facing public barrel while moving implementation concerns into focused internal modules. Extract query/schema/indexing/parser/transport boundaries only after baseline characterization tests are green, and keep every public CLI, MCP, package bin, and TypeScript API contract stable.

**Tech Stack:** TypeScript, Node 24, Vitest, SQLite through `better-sqlite3`, `cac` for installer CLI parsing, MCP SDK, and Superpowers workflow skills.

---

## Review Findings

- `src/storage.ts` is the primary architecture choke point. It currently owns process caches, schema migration, database connection lifecycle, repo metadata sidecars, indexing, watch orchestration, retrieval, diagnostics, and doctor output.
- `src/storage.ts` duplicates refresh/index dependency behavior between `indexFileDirect` and `watchFolder` refresh handling. The two paths can drift around `forceRefresh`, importer expansion, summary strategy changes, and result accounting.
- SQL access is scattered and weakly typed. Generic row casts hide row-shape mismatches while schema setup, row mapping, FTS queries, dependency graph reads, and content reads live in the same module.
- `src/parser.ts` mixes tree-sitter parsing, OXC parsing, import extraction, symbol extraction, summary creation, and fallback behavior. OXC helpers still depend on broad `any` nodes.
- CLI and MCP have separate command surfaces with overlapping argument mapping and validation. `src/cli.ts`, `src/mcp-contract.ts`, and `src/validation.ts` share some parsing but still duplicate option names and engine dispatch mapping.
- `src/mcp.ts` mixes MCP transport with tool dispatch telemetry, completion summaries, token heuristics, and event emission.
- `src/types.ts` is convenient but too broad for internal ownership. It mixes config, watch, indexing, retrieval, diagnostics, events, ranking, and file summaries.

## Operating Rules

- Use an isolated git worktree unless the user explicitly asks for direct `main` work.
- Do not combine lanes. Each task below should produce one reviewable commit.
- Preserve public exports from `src/index.ts`, MCP tool names, CLI JSON output, and package bin behavior unless an ADR explicitly accepts a breaking change.
- Before each source-changing commit, run `pnpm check:version-bump` and include the required package version bump if the policy requires it.
- If a task exposes a behavior bug, stop the refactor and use `superpowers:systematic-debugging` before changing behavior.
- Prefer moving code before redesigning behavior. New abstractions must make an existing ownership boundary explicit.

## Task 1: Storage Schema And Query Boundary

**Files:**
- Modify: `src/storage.ts`
- Create: `src/storage-schema.ts`
- Create: `src/storage-queries.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/interface.test.ts`
- Test: `tests/engine-contract.test.ts`

- [ ] **Step 1: Establish schema and query baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-behavior.test.ts -t "schema|storage mode|corrupted index metadata|indexed rows|diagnostics|doctor"
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Extract schema lifecycle**

Move only these responsibilities from `src/storage.ts` into `src/storage-schema.ts`:

- schema migration definitions
- `initializeDatabase`
- schema-version read/write helpers
- table/column introspection helpers
- storage-version file helpers if they are only used by storage initialization

Keep database connection caching in `src/storage.ts` until connection ownership is explicit.

- [ ] **Step 3: Extract typed query helpers**

Create `src/storage-queries.ts` for row mapping and typed SQL helpers that are used by more than one storage lane:

- `typedAll`
- `typedGet`
- symbol row mapping
- common row interfaces that mirror persisted schema

Do not move feature-specific retrieval ranking or doctor warning assembly in this task.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-behavior.test.ts -t "schema|storage mode|corrupted index metadata|indexed rows|diagnostics|doctor"
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm test:package-bin
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/storage.ts src/storage-schema.ts src/storage-queries.ts tests/engine-behavior.test.ts tests/interface.test.ts tests/engine-contract.test.ts package.json
pnpm check:version-bump
git commit -m "Extract storage schema and query helpers"
```

Expected: version policy passes before commit.

## Task 2: Shared Index Refresh Service

**Files:**
- Modify: `src/storage.ts`
- Create: `src/index-refresh.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/watch-boundary.test.ts`
- Test: `tests/cli-boundary.test.ts`

- [ ] **Step 1: Establish refresh baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-behavior.test.ts -t "refresh|importer|dependency|watch|single-file"
pnpm exec vitest run tests/watch-boundary.test.ts tests/cli-boundary.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Extract shared refresh orchestration**

Create `refreshFileSetWithDependents()` in `src/index-refresh.ts`. It must be used by both:

- `indexFileDirect`
- `watchFolder` changed-path flushing

The helper owns direct importer expansion, `forceRefresh` propagation, indexed file and symbol counting, and final stale-status result assembly. It must not own watcher subscription lifecycle or public `indexFile`/`watchFolder` exports.

- [ ] **Step 3: Verify drift-sensitive behavior**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-behavior.test.ts -t "re-evaluates direct importers|exporter change|single-file refresh|watch refresh|dependency edges"
pnpm exec vitest run tests/watch-boundary.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/storage.ts src/index-refresh.ts tests/engine-behavior.test.ts tests/watch-boundary.test.ts package.json
pnpm check:version-bump
git commit -m "Share indexed file refresh orchestration"
```

Expected: version policy passes before commit.

## Task 3: Retrieval And Context Assembly Boundary

**Files:**
- Modify: `src/storage.ts`
- Create: `src/retrieval.ts`
- Test: `tests/interface.test.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/serialization.test.ts`

- [ ] **Step 1: Establish retrieval baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/serialization.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "search|query|context|source|ranked|bundle|references|graph-aware"
```

Expected: all commands exit `0`.

- [ ] **Step 2: Extract retrieval internals**

Move these internals from `src/storage.ts` into `src/retrieval.ts`:

- symbol and text search scoring
- dependency/importer/reference row picking
- ranked seed resolution
- context bundle item construction
- `queryCode` discover/source/assemble helpers that do not own storage initialization

Keep exported functions in `src/storage.ts` as compatibility wrappers until the retrieval module has stable parameter types.

- [ ] **Step 3: Verify public retrieval contracts**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/serialization.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "query surface|auto query|symbol source|context bundles|ranked query|references"
pnpm test:package-bin
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/storage.ts src/retrieval.ts tests/interface.test.ts tests/engine-behavior.test.ts tests/serialization.test.ts package.json
pnpm check:version-bump
git commit -m "Extract retrieval assembly helpers"
```

Expected: version policy passes before commit.

## Task 4: Parser Backend Adapters

**Files:**
- Modify: `src/parser.ts`
- Create: `src/parser/tree-sitter.ts`
- Create: `src/parser/oxc.ts`
- Create: `src/parser/shared.ts`
- Test: `tests/parser.golden.test.ts`
- Test: `tests/engine-behavior.test.ts`

- [ ] **Step 1: Establish parser baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/parser.golden.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "mjs|cjs|large file|chunk boundaries|doc comments|signature"
```

Expected: all commands exit `0`.

- [ ] **Step 2: Split parser backends**

Move tree-sitter-specific code into `src/parser/tree-sitter.ts` and OXC-specific code into `src/parser/oxc.ts`. Shared symbol, import, line-offset, and summary helpers belong in `src/parser/shared.ts`.

`src/parser.ts` remains the public parser facade and exports `parseSourceFile`, `ParsedFile`, and `supportedLanguageForFile`.

- [ ] **Step 3: Narrow OXC node typing**

Replace broad `any` usage in OXC helper inputs with local structural node types for the fields Astrograph reads. Do not attempt a full OXC AST type model in this task.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/parser.golden.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "mjs|cjs|large file|chunk boundaries|doc comments|signature"
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/parser.ts src/parser/tree-sitter.ts src/parser/oxc.ts src/parser/shared.ts tests/parser.golden.test.ts tests/engine-behavior.test.ts package.json
pnpm check:version-bump
git commit -m "Split parser backend adapters"
```

Expected: version policy passes before commit.

## Task 5: Shared Command Registry For CLI And MCP

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/mcp-contract.ts`
- Modify: `src/validation.ts`
- Create: `src/command-registry.ts`
- Test: `tests/interface.test.ts`
- Test: `tests/cli-boundary.test.ts`
- Test: `tests/engine-contract.test.ts`

- [ ] **Step 1: Establish surface baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/cli-boundary.test.ts tests/engine-contract.test.ts
pnpm test:package-bin
```

Expected: all commands exit `0`.

- [ ] **Step 2: Create shared command registry**

Create `src/command-registry.ts` as the source of truth for command/tool metadata and engine dispatch. It should define:

- stable command/tool identifiers
- shared descriptions where wording overlaps
- normalized option names
- engine function dispatch

CLI and MCP adapters may still format their own transport schemas, but they should consume the registry instead of duplicating command-to-engine mapping.

- [ ] **Step 3: Preserve transport-specific validation**

Keep CLI flag parsing and MCP Zod schema conversion transport-specific. Do not force CLI and MCP to share the same raw argument parser; share normalized command inputs instead.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/cli-boundary.test.ts tests/engine-contract.test.ts
pnpm test:package-bin
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/cli.ts src/mcp-contract.ts src/validation.ts src/command-registry.ts tests/interface.test.ts tests/cli-boundary.test.ts tests/engine-contract.test.ts package.json
pnpm check:version-bump
git commit -m "Share CLI and MCP command registry"
```

Expected: version policy passes before commit.

## Task 6: MCP Tool Observability Boundary

**Files:**
- Modify: `src/mcp.ts`
- Create: `src/tool-observability.ts`
- Test: `tests/interface.test.ts`
- Test: `tests/serialization.test.ts`

- [ ] **Step 1: Establish MCP baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/serialization.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Extract tool completion and token estimates**

Move MCP tool completion summaries, heuristic savings, exact sampling cadence, and token estimate construction into `src/tool-observability.ts`.

`src/mcp.ts` should retain:

- SDK server creation
- stdio transport lifecycle
- tool registration
- dispatch call timing and event emission hooks

- [ ] **Step 3: Verify**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/serialization.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/mcp.ts src/tool-observability.ts tests/interface.test.ts tests/serialization.test.ts package.json
pnpm check:version-bump
git commit -m "Extract MCP tool observability"
```

Expected: version policy passes before commit.

## Task 7: Internal Type Ownership Split

**Files:**
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Create: `src/types/config.ts`
- Create: `src/types/retrieval.ts`
- Create: `src/types/diagnostics.ts`
- Create: `src/types/watch.ts`
- Test: `tests/interface.test.ts`
- Test: `tests/engine-contract.test.ts`

- [ ] **Step 1: Establish public type baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Split internal type modules**

Move internal type definitions into domain files:

- config and resolved config types into `src/types/config.ts`
- query, search, source, bundle, and ranking types into `src/types/retrieval.ts`
- diagnostics, doctor, readiness, and events into `src/types/diagnostics.ts`
- watch options, events, backends, and diagnostics into `src/types/watch.ts`

Keep `src/types.ts` as a compatibility barrel during this task.

- [ ] **Step 3: Preserve public exports**

Keep `src/index.ts` public type exports stable. If any export name changes are necessary, stop and write an ADR before continuing.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm test:package-bin
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/types.ts src/index.ts src/types/config.ts src/types/retrieval.ts src/types/diagnostics.ts src/types/watch.ts tests/interface.test.ts tests/engine-contract.test.ts package.json
pnpm check:version-bump
git commit -m "Split internal type ownership"
```

Expected: version policy passes before commit.

## Exit Criteria

- `src/storage.ts` no longer owns schema migration, common SQL row helpers, retrieval assembly, parser logic, or duplicated watch/index refresh orchestration.
- `indexFileDirect` and `watchFolder` use the same refresh service for changed file sets and direct importer expansion.
- OXC parser code no longer relies on broad `any` for helper boundaries.
- CLI and MCP command dispatch share one command registry while preserving transport-specific schemas.
- MCP transport code no longer owns token estimation and completion summary policy.
- `src/types.ts` remains available as a compatibility barrel, but internal imports can target narrower domain type modules.
- Public `src/index.ts` exports, MCP tool names, CLI JSON outputs, and package bin behavior remain stable.

## Full Verification

Run after all tasks land:

```bash
pnpm type-lint
pnpm build
pnpm test
pnpm test:package-bin
pnpm check:version-bump
```

Expected: all commands exit `0`, with `pnpm check:version-bump` passing against the staged package version policy.
