# Node 20–24 Compatibility Baseline — July 2026

## Scope

This review verifies the published Astrograph package on macOS x64. It
distinguishes the package runtime from the contributor build toolchain: tsdown
requires Node 22.18+ or 24.11+, while a published tarball is expected to run
on Node 20.19+.

## Reproducible Evidence

**Host:** macOS Darwin 22.6.0, x86_64; pnpm 9.15.9. Each command exited 0.
The package-smoke output covers a disposable Git fixture, packed tarball,
fresh installation, CLI index/search, MCP stdio, typed config, global setup,
and native database access; it emitted no stderr failure output.

| Runtime | Exact command | Result |
| --- | --- | --- |
| Node 20.19.0 | `PATH=<asdf-node-20.19.0>/bin:$PATH pnpm test:package-bin:prebuilt` | Passed against a Node 22-built tarball; `prepack` was intentionally skipped. |
| Node 22.23.1 | `pnpm build && pnpm type-lint && pnpm test:package-bin` | Passed contributor build, type checks, and the normal packed-package smoke. |
| Node 24.13.0 | `PATH=<asdf-node-24.13.0>/bin:$PATH pnpm build && pnpm type-lint && pnpm test:package-bin:prebuilt` | Passed contributor checks and the prebuilt package gate. |

## Findings

| Runtime | Package result | Evidence |
| --- | --- | --- |
| Node 20.19.0 | Pass | Node 22 built the artifact; Node 20 ran `pnpm test:package-bin:prebuilt`, including packed install, CLI index/search, local/global setup, diagnostics, cache isolation, and typed config. |
| Node 22.23.1 | Pass | `pnpm test:package-bin`, `pnpm type-lint`, `pnpm agents:check`, and focused installer contract tests passed. |
| Node 24.13.0 | Pass | `pnpm test:package-bin` passed end to end. |

The reported Node 24 work-laptop failure did not reproduce on this macOS x64
machine. Capture its OS, architecture, install command, and full stderr if it
recurs; it is currently classified as environment-specific, because no source,
runtime API, native ABI/install, toolchain, or configuration failure reproduced
on the only available host. Native-module prebuild/source-build behavior is
platform-specific.

## Repaired Boundaries

- The Tree-sitter core is installed as `@astrograph/tree-sitter` (an npm alias
  for `tree-sitter@0.25.0`). This keeps every grammar while preventing npm from
  applying their stale optional peer ranges to Astrograph's core binding. The
  package smoke performs an isolated `npm install --global` and fails if npm
  emits `ERESOLVE`.
- `better-sqlite3@13.0.1` declares Node `>=22` and segfaulted on a Node 20
  database open. `better-sqlite3@12.11.1` supports Node 20–26 and passed the
  same database/indexing workflow after its normal native build fallback.
- `execa@10.0.0` uses `Set.prototype.union`, unavailable in Node 20. Execa
  `9.6.1` supports Node `>=20.5` and preserves Astrograph's `execaSync` use.
- The global installer previously duplicated a Node 22.12-only guard. It now
  uses the shared Node 20.19+/22.12+ runtime policy.

## Dependency Boundary Inventory

| Package boundary | Selected version | Node 20–24 position | Fallback path |
| --- | --- | --- | --- |
| `better-sqlite3` native addon | `12.11.1` | Declares Node 20.x and 22–26; package smoke opens the database on every tested runtime. | Normal `node-gyp` build when a matching prebuild is unavailable. |
| `tree-sitter` and 19 grammar addons | pinned package set | Native Node ABI surface with no package engine declaration; CLI indexing smoke loads the selected grammars. | Package-manager native build; capture OS/architecture evidence before a platform-specific claim. |
| `@node-rs/xxhash` | `1.7.6` | Declares Node >=12 and ships optional platform binaries. | Optional platform package or its WASI package when available. |
| `@parcel/watcher` | `2.5.6` | Declares Node >=10 and ships optional platform binaries. | Optional platform package; Astrograph's watcher selection can fall back to Node fs watch or polling. |
| `@vscode/ripgrep` | `1.17.1` | Bundled executable boundary; exercised by package install and search smoke. | Astrograph reports its absence rather than requiring a system ripgrep binary. |
| `execa` | `9.6.1` | Declares Node >=20.5; used by package smoke process calls. | No native fallback needed. |
| `tsdown` contributor build tool | `0.22.14` | Declares Node 22.18+ or 24.11+; intentionally outside Node 20 package runtime support. | Build the published artifact under Node 22/24, then use `test:package-bin:prebuilt`. |

## Deliberate Boundaries

- Node 20 is a supported package runtime, not a contributor build runtime:
  current tsdown requires Node 22.18+ or 24.11+. The prebuilt package smoke
  proves the consumer path without running `prepack` under Node 20.
- No GitHub Actions matrix was added. The existing cost policy prohibits a
  material automatic runner-minute increase without
  `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true`. The manual **Node package
  compatibility** workflow is the approved zero-baseline-cost gate: build on
  Node 22, then dispatch it once for Node 20 and once for Node 24 before a
  compatibility release.

## Automation Evidence

[Required CI](https://github.com/mortenbroesby/astrograph/actions/runs/33270379241)
passed the Node 22 package gate on current main. The manual workflow then
passed its packed WASM package smoke on current main for
[Node 20](https://github.com/mortenbroesby/astrograph/actions/runs/33271199916)
and [Node 24](https://github.com/mortenbroesby/astrograph/actions/runs/33271201542).
These runs complete the cost-bounded continuous evidence for the published
Node 20.19+, 22, and 24 support contract.
