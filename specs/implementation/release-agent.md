# Release Agent Workflow

## Goal

Add a guarded agentic release path that decides whether merged changes need an
npm release, chooses patch/minor/major when they do, updates the alpha version
using the existing policy, and pushes the matching release tag.

## Architecture

- `src/release-policy.ts` owns pure release classification.
- `src/scripts/release-agent.ts` gathers Git history, applies the policy, and
  optionally edits version-bearing files.
- `CI` workflow manual dispatch runs fast and expensive gates before invoking
  the release agent.
- `release.yml` remains tag-only and handles npm publishing.

## Decision Boundaries

- Docs, specs, agent rules, and workflow-only changes do not publish.
- Internal tests, benchmarks, and non-published scripts use `increment`.
- Runtime package changes publish as:
  - `patch` for compatible fixes, refactors, and package metadata changes.
  - `minor` for `feat:` runtime commits.
  - `major` for `!` or `BREAKING CHANGE:` runtime commits.

## Commands

```sh
pnpm release:plan
pnpm release:apply
pnpm release:plan --base v0.1.0-alpha.60
```

## Verification Gates

Before merging release-agent changes:

```sh
pnpm type-lint
pnpm exec vitest run tests/release-policy.test.ts tests/engine-contract.test.ts
pnpm release:plan
git diff --check
```

For an apply-mode release in GitHub Actions:

1. Dispatch `CI` on `main` with `release_mode=plan`.
2. Confirm the reported release kind and target version.
3. Dispatch `CI` on `main` with `release_mode=apply`.
4. Confirm the workflow commits any required version update.
5. Confirm the matching tag push triggers `release.yml`.

## Cost Guardrails

The release agent is attached to the existing `CI` workflow instead of adding a
new workflow. Apply mode is manual-only, main-only, and reuses existing fast and
expensive gates so ordinary PR and push checks do not gain another always-on job.
