# Node 20–24 Compatibility Baseline — July 2026

## Scope

This review verifies the published Astrograph package on macOS x64. It
distinguishes the package runtime from the contributor build toolchain: tsdown
requires Node 22.18+ or 24.11+, while a published tarball is expected to run
on Node 20.19+.

## Findings

| Runtime | Package result | Evidence |
| --- | --- | --- |
| Node 20.19.0 | Pass | Node 22 built the artifact; Node 20 ran `pnpm test:package-bin:prebuilt`, including packed install, CLI index/search, local/global setup, diagnostics, cache isolation, and typed config. |
| Node 22.23.1 | Pass | `pnpm test:package-bin`, `pnpm type-lint`, `pnpm agents:check`, and focused installer contract tests passed. |
| Node 24.13.0 | Pass | `pnpm test:package-bin` passed end to end. |

The reported Node 24 work-laptop failure did not reproduce on this macOS x64
machine. Capture its OS, architecture, install command, and full stderr if it
recurs; native-module prebuild/source-build behavior is platform-specific.

## Repaired Boundaries

- `better-sqlite3@13.0.1` declares Node `>=22` and segfaulted on a Node 20
  database open. `better-sqlite3@12.11.1` supports Node 20–26 and passed the
  same database/indexing workflow after its normal native build fallback.
- `execa@10.0.0` uses `Set.prototype.union`, unavailable in Node 20. Execa
  `9.6.1` supports Node `>=20.5` and preserves Astrograph's `execaSync` use.
- The global installer previously duplicated a Node 22.12-only guard. It now
  uses the shared Node 20.19+/22.12+ runtime policy.

## Deliberate Boundaries

- Node 20 is a supported package runtime, not a contributor build runtime:
  current tsdown requires Node 22.18+ or 24.11+. The prebuilt package smoke
  proves the consumer path without running `prepack` under Node 20.
- No GitHub Actions matrix was added. The existing cost policy prohibits a
  material runner-minute increase without `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true`.
  Add cost-bounded continuous Node 20/24 coverage only after that approval.
