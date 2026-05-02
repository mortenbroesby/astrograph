# Testing Patterns

Use this as a compact verification reference for repo-native skills.

## Principles

- Prefer the narrowest check that proves the changed behavior.
- For bugs, reproduce first when practical.
- Keep tests close to the owning workspace or contract.
- Do not substitute type-check or lint for behavior verification.

## Repo patterns

- One-workspace code change: run that workspace's `build`, `type-check`,
  `lint`, or `test` as appropriate.
- Shared package or contract change: broaden to affected consumers or
  `pnpm turbo type-check`.
- Docs-only change: `pnpm lint:md` is usually enough.
- User-facing change: add a browser or manual runtime check when practical.

## Red flags

- Verification only happens after a large combined diff
- A fix was not reproduced before it was declared resolved
- Contract changes shipped without consumer checks
