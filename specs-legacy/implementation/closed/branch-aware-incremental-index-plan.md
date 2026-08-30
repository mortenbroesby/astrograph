# Branch-Aware Incremental Index Mapping Plan

**Goal:** Reuse unchanged file analysis across Git branches and worktrees without
using mutable branch names as cache keys or weakening freshness guarantees.

**Architecture:** Store immutable analysis artifacts by a content/config/parser
fingerprint. Store each checkout's observed path, Git revision, and dependency
mapping separately; it may reference an artifact only after validating its
fingerprint. Git metadata is optional enrichment, never a prerequisite for
indexing or a source of cache identity.

**Tech Stack:** TypeScript, SQLite, Node Git child processes, existing hash and
filesystem-scan helpers, and Vitest fixtures.

**Execution roadmap:** [Branch-Aware Incremental Index Epic](./branch-aware-incremental-index-epic.md)
breaks this design into independently deliverable stories.

---

## Non-Goals

- Do not add Git mutations, automatic checkout switching, remote access, or a
  public cache-management command.
- Do not treat a branch name, worktree directory, or commit message as proof
  that an indexed artifact is reusable.
- Do not change ranking, retrieval envelopes, or existing freshness semantics
  in the design-only change.

## Data Model and Identity Rules

1. **Analysis artifact** — immutable row keyed by `artifactKey`, derived from:
   `content_hash`, supported language/parser version, summary strategy,
   extraction configuration fingerprint, dependency-analysis version, and
   storage schema version. It contains parse output, summaries, symbols, and
   import facts only.
2. **Checkout mapping** — mutable row keyed by a generated checkout ID, with
   canonical repository root, normalized relative path, artifact key, and
   observed file state. It records optional Git data (`repositoryId`, HEAD OID,
   branch ref, worktree path) for diagnostics only.
3. **Dependency mapping** — mutable per-checkout edges built from artifact
   import facts after paths are resolved in that checkout. An artifact does not
   own dependency edges because identical source can resolve differently after
   a path move or dependency change.
4. **No branch-name cache keys** — a named branch is a display label. Detached
   HEAD uses its OID only as metadata; reuse still requires matching artifact
   fingerprints and checkout-path validation.

## Git Metadata Fallback Matrix

| Repository state | Mapping behavior | Diagnostic label |
| --- | --- | --- |
| Named branch | Record canonical root, HEAD OID, and symbolic ref; validate files before reuse. | `git-branch` |
| Detached HEAD | Record canonical root and HEAD OID; omit branch ref. | `git-detached` |
| Non-Git directory | Use a generated checkout ID rooted at canonical path; no Git fields. | `filesystem` |
| Git unavailable/fails | Continue as filesystem mode and retain a non-fatal diagnostic reason. | `git-unavailable` |
| Linked worktree | Give each canonical worktree root a distinct checkout mapping; artifacts may be shared only by fingerprint. | `git-worktree` |

## Invalidation Contract

| Change | Artifact reuse | Checkout/dependency action |
| --- | --- | --- |
| File content changes | No: create/find new artifact key. | Replace that path mapping; recompute affected dependency edges. |
| Summary/parser/extraction config changes | No: configuration fingerprint changes. | Refresh affected mappings; do not reuse old analysis. |
| Path move/rename with identical content | Yes for analysis artifact. | Create new path mapping and rebuild importer/exporter edges for both paths. |
| Dependency target/export change | Analysis may be reused for unchanged files. | Re-resolve and refresh direct importer edges and graph-dependent freshness. |
| Storage/schema version incompatibility | No. | Reset or migrate storage using the existing guarded version policy. |
| Missing/corrupt mapping metadata | Do not trust mapping. | Fall back to ordinary filesystem scan and rebuild the mapping. |

## Task 1: Add Internal Storage Contracts

**Files:**

- Modify: `src/storage-schema.ts`
- Modify: `src/storage-queries.ts`
- Modify: `src/repo-meta.ts`
- Create: `src/incremental-cache.ts`
- Test: `tests/incremental-cache.test.ts`

- [ ] **Step 1: Establish baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-behavior.test.ts tests/watch-backend.test.ts
```

Expected: both commands exit `0`.

- [ ] **Step 2: Add private schema only**

Add artifact, checkout-mapping, and checkout-dependency tables keyed as defined
above. Add a storage-version migration/reset decision before making the schema
visible to normal indexing. Keep these tables private; no MCP/CLI field changes.

- [ ] **Step 3: Add deterministic cache helpers**

Implement fingerprint construction from existing content hashes plus explicit
parser/config/dependency versions. Helpers must reject incomplete fingerprints
and cannot accept a branch name as an identity input.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm exec vitest run tests/incremental-cache.test.ts tests/engine-behavior.test.ts
pnpm type-lint
pnpm check:version-bump
git diff --check
```

Expected: all commands exit `0`; commit only after version policy passes.

## Task 2: Resolve Checkout Identity Without Requiring Git

**Files:**

- Modify: `src/config.ts`
- Modify: `src/storage.ts`
- Create: `src/git-checkout.ts`
- Test: `tests/git-checkout.test.ts`

- [ ] **Step 1: Add a bounded Git probe**

Use non-mutating `git rev-parse --show-toplevel`, `HEAD`, and symbolic-ref
queries with explicit failure handling. Return the fallback matrix labels above;
never fail indexing solely because Git is absent or unavailable.

- [ ] **Step 2: Create/update checkout mappings**

Use the canonical worktree root plus a generated persistent ID to isolate linked
worktrees. Record Git facts as observations, not lookup keys.

- [ ] **Step 3: Verify fixtures**

Add named-branch, detached-HEAD, non-Git, failed-Git, and linked-worktree
fixtures. Assert matching content can share an artifact while checkout mappings
remain distinct.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm exec vitest run tests/git-checkout.test.ts tests/engine-behavior.test.ts
pnpm type-lint
pnpm check:version-bump
git diff --check
```

Expected: all commands exit `0`.

## Task 3: Integrate Reuse Into Index and Refresh Safely

**Files:**

- Modify: `src/storage.ts`
- Modify: `src/indexing.ts`
- Modify: `src/index-refresh.ts`
- Modify: `src/diagnostics.ts`
- Test: `tests/engine-behavior.test.ts`
- Test: `tests/watch-backend.test.ts`

- [ ] **Step 1: Reuse analysis only after fingerprint equality**

During folder, file, and watch refresh, look up an artifact by full fingerprint.
On a hit, materialize checkout-local symbol/file rows and re-resolve dependency
edges; on a miss, run ordinary analysis and atomically persist the artifact.

- [ ] **Step 2: Preserve freshness on all invalidations**

Treat path moves, changed import targets, missing mappings, and incompatible
storage versions as refresh work. Do not report `fresh` until checkout mappings
and dependency edges reflect the current filesystem state.

- [ ] **Step 3: Add reuse and fallback fixtures**

Cover: same content across two worktrees (artifact reuse); same branch name with
different content (no reuse); rename (reuse artifact, rebuild graph); config
change (no reuse); dependency export change (edge refresh); detached/non-Git
fallback; corrupt mapping (ordinary reindex); and storage-version mismatch.

- [ ] **Step 4: Final verification and release checkpoint**

Run:

```bash
pnpm exec vitest run tests/incremental-cache.test.ts tests/git-checkout.test.ts tests/engine-behavior.test.ts tests/watch-backend.test.ts
pnpm type-lint
pnpm check:version-bump
pnpm release:plan
git diff --check
```

Expected: all checks exit `0`; `release:plan` determines the required release
kind before the implementation commit/push/release workflow.
