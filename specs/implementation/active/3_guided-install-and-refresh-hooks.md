# Guided Install and Refresh Hooks Implementation Plan

**Goal:** Provide one comforting interactive Astrograph onboarding flow that
lets people choose repository-local or user-global setup, and explicitly opt
into agent guidance and safe Git-triggered index refresh.

**Architecture:** Keep the existing repository and global setup writers as the
only configuration writers. Add an `astrograph install` onboarding router that
explains scope before invoking those writers, installs the global executable
only after confirmation, and extends local setup with managed Git hook files.
Git hooks are asynchronous and refresh only the affected index; they are never
installed over a hook owned by another tool. Agent integration remains a
managed instruction block, because there is no portable agent runtime-hook API.

**Tech Stack:** TypeScript, Node.js >=22.12.0, Commander, Clack prompts,
execa, pnpm, and Vitest.

---

## Task 1: Model guided setup choices

**Files:**
- Modify: `src/scripts/install.ts`
- Modify: `src/astrograph.ts`
- Test: `tests/engine-contract.test.ts`

- [x] Establish the existing local/global setup test baseline.
- [x] Add one `astrograph install` flow with clear local and global scope
  descriptions and the existing non-interactive flags; do not retain a
  duplicate top-level `init` setup command.
- [x] Make global package installation an explicit interactive confirmation;
  no package or user config writes occur before confirmation.
- [x] Verify the rendered setup outcome names affected locations and next
  action without exposing configuration contents.

## Task 2: Add opt-in safe refresh hooks

**Files:**
- Modify: `src/scripts/install.ts`
- Test: `tests/engine-contract.test.ts`
- Modify: `README.md`
- Modify: `docs/reference/cli.md`

- [x] Add `--git-hooks` and interactive consent for `post-commit`,
  `post-checkout`, and `post-merge` refresh hooks.
- [x] Generate idempotent managed shell hooks which invoke the existing
  detached `astrograph git-refresh` behavior.
- [x] Refuse to overwrite hooks not owned by Astrograph and report that
  decision clearly.
- [x] Keep the existing `--agents` managed instruction block as a separate,
  opt-in agent integration; document that it is guidance rather than an
  unsupported universal runtime hook.

## Task 3: Validate and publish

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `specs/implementation/active/README.md`
- Modify: `pointer.md`

- [x] Run focused installer/hook tests, `pnpm type-lint`, `pnpm build`,
  `pnpm test:package-bin`, `pnpm check:version-bump`, and `git diff --check`.
- [x] Apply the release policy: this backward-compatible CLI feature receives
  a minor alpha increment.
- [x] Commit, push, and open [draft PR #92](https://github.com/mortenbroesby/astrograph/pull/92).
- [ ] Record CI evidence before changing the active pointer again.
