---
name: release-decision
description: Use when deciding whether Astrograph changes should publish a release, when planning a version bump, or when operating the release agent
---

# Release Decision Skill

Use this skill when deciding whether Astrograph changes should publish an npm
release, when planning a version bump, or when operating the release agent.

## Inputs

- Latest merged release tag, usually the newest `v*.*.*` tag reachable from
  `HEAD`.
- Commit subjects and bodies since that tag.
- Changed files since that tag.
- Current `package.json` version.

## Decision Rules

- `none`: docs, specs, agent rules, README-only, or workflow-only changes.
- `increment`: internal versioned test, benchmark, or script changes that should
  satisfy the alpha increment gate but should not publish npm.
- `patch`: runtime-compatible fixes, refactors, performance work, or package
  metadata changes.
- `minor`: backward-compatible runtime features, normally conventional commits
  beginning with `feat:`.
- `major`: breaking runtime changes, conventional commits with `!`, or commit
  bodies containing `BREAKING CHANGE:`.

The alpha increment never resets. Patch, minor, and major bumps all increase
`-alpha.N` by one from the latest release baseline.

## Commands

Plan without side effects:

```sh
pnpm release:plan
```

Apply version edits locally when release-worthy changes exist:

```sh
pnpm release:apply
```

Use a specific baseline when investigating:

```sh
pnpm release:plan --base v0.1.0-alpha.60
```

## GitHub Actions

Use the `CI` workflow's manual dispatch:

- `release_mode=plan` reports the release decision.
- `release_mode=apply` is allowed only on `main`.
- Apply mode runs after fast and expensive checks, commits any version edit, and
  pushes the matching `v<version>` tag.

Do not tag manually unless the release agent is unavailable.
