## Context

See `proposal.md` for motivation. `better-sqlite3@12.11.1` supports Node 20
but depends on deprecated `prebuild-install`. Version 13 moves to N-API, embeds
prebuilt binaries, removes that dependency, and requires Node 22. Astrograph's
managed runtime, contributor build, and required CI already use Node 22; Node
20 reached upstream end-of-life on 2026-03-24.

## Goals / Non-Goals

**Goals:**

- Remove the deprecated package from Astrograph's production dependency graph.
- Make one Node 22.12 minimum consistent across package metadata, build output,
  installer diagnostics, tests, docs, and optional compatibility verification.
- Preserve native SQLite behavior on Node 22 and 24.

**Non-Goals:**

- Replace SQLite, suppress npm warnings, fork an upstream package, or add a
  transitive dependency override.
- Rewrite historical evidence that was correct when recorded.
- Expand automatic GitHub Actions runner usage.

## Decisions

### Upgrade the owner of the deprecated dependency

Set `better-sqlite3` to `^13.0.3` and regenerate `pnpm-lock.yaml`. This fixes
the warning at its source. Overrides cannot make another installer API-compatible,
and warning suppression would leave unmaintained production code installed.

### End Node 20 support explicitly

Set package and installer minimums to Node `>=22.12.0`, and compile with the
Node 22 target. Node 20 is EOL and retaining it would pin Astrograph to the old
native addon line. Keep Node 22 and 24 as the manual compatibility choices.

### Preserve historical reviews as evidence

Update current README, troubleshooting, and release references. Add a short
supersession note to `docs/reviews/node-20-to-24-compatibility-baseline-2026-07.md`
instead of altering its dated measurements.

Compatibility-sensitive files are `package.json`, `pnpm-lock.yaml`,
`tsdown.config.ts`, `src/scripts/install.ts`,
`tests/engine-contract.test.ts`, `.github/workflows/node-compatibility.yml`, and
the current runtime documentation.

Verification commands:

- `pnpm why prebuild-install`
- `pnpm exec vitest run tests/engine-contract.test.ts -t "package metadata|global-install prerequisites"`
- `pnpm build && pnpm type-lint`
- `pnpm test:package-bin`
- Node 24: `pnpm test:package-bin:prebuilt` using the existing local Node 24 runtime
- `pnpm check:version-bump --base origin/main`
- `pnpm exec openspec validate remove-deprecated-native-installer --strict`

## Risks / Trade-offs

- **Node 20 users can no longer upgrade in place.** -> State the minimum in npm
  metadata and installer errors; existing installed Astrograph versions remain
  usable until the user upgrades Node.
- **The N-API rewrite could change native behavior.** -> Run focused database
  tests and packed install/index/search smoke on Node 22 and Node 24.
- **A platform lacks an embedded prebuild.** -> Upstream retains source-build
  fallback; the package smoke proves supported CI/macOS paths, while the manual
  compatibility workflow remains available without increasing automatic cost.

## Migration Plan

Release as a breaking alpha version through the normal release agent. Users on
Node 20 upgrade to Node 22.12+ and rerun Astrograph setup. Rollback is the prior
Astrograph release; no index or database migration is introduced.
