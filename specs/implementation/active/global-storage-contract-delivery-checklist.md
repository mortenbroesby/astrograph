# Global Storage Contract Delivery Checklist

> **Epic:** [Global Install and Cache Epic](./global-install-and-cache-epic.md),
> Story 1
>
> **Status:** Active — this checklist is the only authorized implementation
> scope for the global Astrograph effort.

**Goal:** Add a tested storage-location contract that can select isolated,
user-private global storage for a canonical repository while preserving the
existing repository-local default.

**Architecture:** Model storage location as a typed policy. A platform-path
provider, injectable in tests, resolves the user cache root; a stable hash of
the canonical repository root selects its isolated directory. Keep all mutable
repository state within that directory, and leave the default repository-local
layout unchanged until a later installer story opts into global storage.

**Tech Stack:** TypeScript, Node.js 22 LTS, SQLite WAL, Vitest, existing
path/hash helpers, pnpm.

---

## Task 1: Establish Contract and Baseline

**Files:** `src/config.ts`, `src/types/config.ts`, `src/types.ts`,
`src/storage.ts`, `tests/engine-contract.test.ts`, and
`tests/engine-behavior.test.ts`.

- [ ] **Step 1: Record the baseline.**

  Run:

  ```bash
  pnpm type-lint
  pnpm exec vitest run tests/engine-contract.test.ts tests/engine-behavior.test.ts
  ```

  Expected: both commands exit `0`; existing repository-local storage behavior
  is captured before any resolver changes.

- [ ] **Step 2: Define typed selection and precedence.**

  Add the `repo-local | global` storage-location policy and validation. Define
  and test the precedence order: explicit CLI selection, repository config,
  then global default. Reject unknown policy values without silently choosing a
  storage location.

- [ ] **Step 3: Add a testable global path resolver.**

  Resolve the platform-appropriate, user-private cache root through an injected
  environment/path provider. Canonicalize the repository root, derive a stable
  hash, and use it as the repository directory name. Do not use the branch,
  current working directory, basename, or raw uncanonicalized path as identity.

- [ ] **Step 4: Route complete repository state as one unit.**

  When global mode is selected, place the SQLite index, repo metadata,
  integrity marker, storage version, and event file under the same
  repository-specific directory. Keep the repository-local layout byte-for-byte
  compatible in `repo-local` mode.

- [ ] **Step 5: Add focused contract coverage.**

  Add cases for canonical aliases, paths with spaces, distinct repositories
  sharing a basename, injected platform paths, policy precedence, invalid
  policy input, and unchanged repository-local behavior.

- [ ] **Step 6: Verify and commit.**

  Run:

  ```bash
  pnpm type-lint
  pnpm exec vitest run tests/engine-contract.test.ts tests/engine-behavior.test.ts
  pnpm check:version-bump
  git diff --check
  ```

  Expected: all commands exit `0`. Commit only the listed source and test files
  plus this checklist and its epic status update:

  ```bash
  git add src/config.ts src/types/config.ts src/types.ts src/storage.ts tests/engine-contract.test.ts tests/engine-behavior.test.ts specs/implementation/active/global-install-and-cache-epic.md specs/implementation/active/global-storage-contract-delivery-checklist.md
  git commit -m "feat: add global storage location contract"
  ```

  Expected: the package version policy passes before the commit.
