# Windows CI, Documentation, and Release Gate Delivery Checklist

> **Story:** 7 of the [Remaining Delivery Epic](./remaining-delivery-epic.md)
>
> **Status:** In progress — native Windows CI found portable-path and ESM
> entrypoint gaps; this checklist records their correction before merge.

**Goal:** Make the supported Windows experience continuously verifiable and
visible before any release claims Windows support.

**Architecture:** Keep the existing path-scoped CI topology and add one
native `windows-latest` job with the same Node 22/pnpm cache setup as the fast
gate. Repository-relative values are canonical forward-slash identifiers,
while absolute paths remain host-native. ESM executable detection converts
`process.argv[1]` to a file URL rather than constructing a URL string, so
source-mode CLI, MCP, installer, and child-index workers behave on drive-letter
paths.

**Tech Stack:** TypeScript, Node.js 22, pnpm, Vitest, GitHub Actions,
PowerShell, cmd.exe, and Git Bash.

## Task 1: Establish baseline and scope

**Files:** `.github/workflows/ci.yml`, `docs/reference/cli.md`,
`docs/guides/troubleshooting.md`, `docs/reference/release.md`, `README.md`,
`src/scripts/install.ts`

- [x] Read `.agents/rules/github-actions-cost.md` and retain scoped triggers,
  concurrency cancellation, dependency caching, and the fast/release split.
- [x] Add a Windows job with type checks, filesystem/Git/watch suites, and
  packed-package smoke; keep the release-only job test-free.
- [x] Document reset commands for Git Bash, PowerShell, and cmd.exe.
- [x] State supported Windows terminals, Node prerequisite, and Git-optional
  filesystem fallback in the README and release reference.
- [x] Run the initial native CI proof and record its failure evidence: forward
  slashes were not canonical and source CLI entrypoints emitted no worker JSON.

## Task 2: Canonicalize repository-relative identifiers

**Files:** `src/path-matcher.ts`, `src/filesystem-scan.ts`, `src/storage.ts`,
`src/retrieval.ts`, `src/live-search.ts`, `src/checkout-mapping.ts`

- [x] Expose one forward-slash normalization helper without changing
  host-native absolute-path operations.
- [x] Apply it at filesystem discovery, storage, retrieval, live-search, and
  checkout mapping boundaries before values become SQLite keys or API paths.
- [x] Preserve traversal rejection after canonicalization by checking the
  canonical `../` prefix at every normalized boundary.
- [x] Run `pnpm exec vitest run tests/filesystem-scan.test.ts
  tests/engine-behavior.test.ts tests/git-checkout.test.ts`.

## Task 3: Make ESM executable detection drive-letter safe

**Files:** `src/entrypoint.ts`, `src/cli.ts`, `src/mcp.ts`,
`src/scripts/install.ts`, `tests/entrypoint.test.ts`,
`tests/git-checkout.test.ts`

- [x] Compare `import.meta.url` with `pathToFileURL(process.argv[1]).href`.
- [x] Reuse the helper across CLI, MCP, and installer entrypoints, including
  the source-mode child index worker.
- [x] Make the Git probe fixture assert a host-native absolute root.
- [x] Run `pnpm exec vitest run tests/entrypoint.test.ts tests/git-checkout.test.ts
  tests/watch-backend.test.ts tests/watch-boundary.test.ts`.

## Task 4: Verify and hand off

- [x] Run `pnpm type-lint` and `pnpm test:package-bin`; run
  `pnpm check:version-bump` after incrementing the package version.
- [x] Run `pnpm check:version-bump` and
  `git diff --check` after the required version increment.
- [ ] Commit, push, record an automated PR review, and merge only when both
  the fast and native Windows checks pass.
- [ ] Record the permanent cost effect: one path-scoped Windows job, expected
  to add roughly 2–4 Windows runner minutes per eligible CI run; this is a
  permanent explicit increase authorized by `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true`.
