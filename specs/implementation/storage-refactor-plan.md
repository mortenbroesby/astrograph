# Storage Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `src/storage.ts` into smaller, behavior-preserving modules with clear ownership boundaries and focused tests.

**Architecture:** Extract pure and cohesive responsibilities first, then move stateful code only after the target module has characterization coverage. `src/storage.ts` remains the public orchestration layer during the refactor until each extracted module has stable imports and passing focused tests.

**Tech Stack:** TypeScript, Node 24, Vitest, SQLite through `better-sqlite3`, Superpowers workflow skills.

---

## Operating Rules

- Future implementation work must happen in an isolated git worktree unless the user explicitly asks for direct `main` work.
- Every task starts with baseline tests for the slice being moved, then performs the smallest extraction that keeps public behavior unchanged.
- Every source-changing commit must include the required alpha version bump unless version policy is explicitly changed before that commit.
- Do not combine unrelated slices. If a task exposes a behavior bug, stop and use `superpowers:systematic-debugging` before changing behavior.

## Task 1: Readiness And Repo Metadata Boundary

**Files:**
- Modify: `src/storage.ts`
- Create or extend: `src/readiness.ts`
- Create: `src/repo-meta.ts`
- Test: `tests/engine-contract.test.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/interface.test.ts`

- [ ] **Step 1: Verify the current readiness extraction baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm exec vitest run tests/interface.test.ts tests/engine-behavior.test.ts -t "readiness|diagnostics|project status|deepening"
```

Expected: all commands exit `0`.

- [ ] **Step 2: Move repo metadata normalization into `src/repo-meta.ts`**

Move only these responsibilities out of `src/storage.ts`:

- repo metadata record types that are not tied to SQL rows
- `normalizeRepoReadiness` usage remains imported from `src/readiness.ts`
- repo metadata JSON normalization and integrity health helpers
- default watch diagnostics only if it is required by repo metadata normalization

Do not move database access, diagnostics assembly, doctor warnings, or watch runtime code in this task.

- [ ] **Step 3: Re-run focused tests**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "diagnostics|doctor|readiness|deepening"
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit the slice**

Run:

```bash
git add src/storage.ts src/readiness.ts src/repo-meta.ts tests/engine-contract.test.ts package.json
pnpm check:version-bump
git commit -m "Refactor storage metadata helpers"
```

Expected: version policy passes before commit.

## Task 2: Database And Schema Setup Boundary

**Files:**
- Modify: `src/storage.ts`
- Create: `src/storage-schema.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/filesystem-scan.test.ts`

- [ ] **Step 1: Characterize schema behavior**

Run:

```bash
pnpm exec vitest run tests/engine-behavior.test.ts -t "schema|storage mode|corrupted index metadata|indexed rows"
```

Expected: all matched tests exit `0`.

- [ ] **Step 2: Extract schema setup**

Move only schema constants, migrations, database initialization, metadata number read/write helpers, and storage-version helpers into `src/storage-schema.ts`.

Keep connection caching and indexing orchestration in `src/storage.ts` until a later task.

- [ ] **Step 3: Verify schema extraction**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-behavior.test.ts -t "schema|storage mode|corrupted index metadata|indexed rows"
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit the slice**

Run:

```bash
git add src/storage.ts src/storage-schema.ts tests/engine-contract.test.ts package.json
pnpm check:version-bump
git commit -m "Extract storage schema setup"
```

Expected: version policy passes before commit.

## Task 3: Indexing And Refresh Pipeline Boundary

**Files:**
- Modify: `src/storage.ts`
- Create: `src/indexing.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/watch-boundary.test.ts`
- Test: `tests/cli-boundary.test.ts`

- [ ] **Step 1: Establish indexing baseline**

Run:

```bash
pnpm exec vitest run tests/engine-behavior.test.ts -t "index|refresh|worker|watch"
pnpm exec vitest run tests/watch-boundary.test.ts tests/cli-boundary.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Extract file analysis persistence helpers**

Move only file-index persistence helpers and index-finalization helpers into `src/indexing.ts`.

Do not move exported `indexFolder`, `indexFile`, or `watchFolder` in this task. They stay in `src/storage.ts` as the orchestration boundary.

- [ ] **Step 3: Verify indexing extraction**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-behavior.test.ts -t "index|refresh|worker|watch"
pnpm exec vitest run tests/watch-boundary.test.ts tests/cli-boundary.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit the slice**

Run:

```bash
git add src/storage.ts src/indexing.ts tests/engine-contract.test.ts package.json
pnpm check:version-bump
git commit -m "Extract indexing persistence helpers"
```

Expected: version policy passes before commit.

## Task 4: Search, Query, And Context Assembly Boundary

**Files:**
- Modify: `src/storage.ts`
- Create: `src/retrieval.ts`
- Test: `tests/interface.test.ts`
- Test: `tests/engine-behavior.test.ts`

- [ ] **Step 1: Establish retrieval baseline**

Run:

```bash
pnpm exec vitest run tests/interface.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "search|query|context|source|ranked|bundle|references"
```

Expected: all commands exit `0`.

- [ ] **Step 2: Extract retrieval internals**

Move search scoring, dependency/importer row picking, text-match assembly, ranked seed resolution, and context bundle construction into `src/retrieval.ts`.

Keep public exported functions in `src/storage.ts` until the extracted module has stable parameter types and test coverage.

- [ ] **Step 3: Verify retrieval extraction**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "search|query|context|source|ranked|bundle|references"
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit the slice**

Run:

```bash
git add src/storage.ts src/retrieval.ts tests/engine-contract.test.ts package.json
pnpm check:version-bump
git commit -m "Extract retrieval assembly helpers"
```

Expected: version policy passes before commit.

## Task 5: Diagnostics And Doctor Reporting Boundary

**Files:**
- Modify: `src/storage.ts`
- Create: `src/diagnostics.ts`
- Create: `src/doctor.ts`
- Test: `tests/interface.test.ts`
- Test: `tests/engine-behavior.test.ts`

- [ ] **Step 1: Establish diagnostics baseline**

Run:

```bash
pnpm exec vitest run tests/interface.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "diagnostics|doctor|freshness|secret|corrupted|unresolved"
```

Expected: all commands exit `0`.

- [ ] **Step 2: Extract reporting helpers**

Move diagnostics result assembly helpers into `src/diagnostics.ts` and doctor warning/action builders into `src/doctor.ts`.

Keep public `diagnostics()` and `doctor()` exports in `src/storage.ts` unless a follow-up plan explicitly changes the public export layout.

- [ ] **Step 3: Verify diagnostics extraction**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "diagnostics|doctor|freshness|secret|corrupted|unresolved"
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit the slice**

Run:

```bash
git add src/storage.ts src/diagnostics.ts src/doctor.ts tests/engine-contract.test.ts package.json
pnpm check:version-bump
git commit -m "Extract diagnostics reporting helpers"
```

Expected: version policy passes before commit.

## Final Verification

- [ ] **Step 1: Run full local verification**

Run:

```bash
pnpm type-lint
pnpm test
pnpm test:package-bin
```

Expected: all commands exit `0`.

- [ ] **Step 2: Inspect final shape**

Run:

```bash
wc -l src/storage.ts src/readiness.ts src/repo-meta.ts src/storage-schema.ts src/indexing.ts src/retrieval.ts src/diagnostics.ts src/doctor.ts
git status --short --branch
```

Expected: `src/storage.ts` is materially smaller, new modules have clear names, and the worktree is clean after commits.
