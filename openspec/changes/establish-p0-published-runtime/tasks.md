## 1. Lightweight priority workflow

- [x] 1.1 Create `BACKLOG.md` with the selected P0, ordered execution slices,
  and measurable exit criteria; verify P0 explicitly covers npm snapshot
  dogfooding, stable Codex/Copilot runtime selection, worktrees, recovery, and
  the daemon reliability gate.
- [x] 1.2 Update `AGENTS.md` to consult `BACKLOG.md` for priority before
  OpenSpec; verify no instruction treats migrated `backlog-*` folders as the
  live queue and leave main-spec synchronization for task 5.5.
- [x] 1.3 Make isolated linked worktrees the repository and laptop-wide default,
  reuse the existing worktree skill, and ignore `.worktrees/`; verify the active
  root is linked, repo routing no longer treats isolation as optional, and the
  global instruction has narrowly documented exceptions.
- [x] 1.4 Define repository-wide Ready and Done gates for tasks, distinguish a
  verified OpenSpec checkbox from delivered work, and verify the policy requires
  scoped commit/push, remote/CI evidence, and external target readback.

## 2. Exact-artifact package channels

- [x] 2.1 Extend `src/scripts/smoke-package-bin.ts` with an explicit existing
  tarball input that skips packing and rejects missing or mismatched packages;
  verify focused script tests and a prebuilt package smoke pass.
- [x] 2.2 Add a minimal release-artifact helper that stages a unique snapshot
  SemVer, packs once, records its SHA-256 and metadata, and fails on an existing
  npm version; verify unit tests cover version generation, paths, and fail-closed
  behavior without publishing.
- [x] 2.3 Extend the manual dispatch in `.github/workflows/ci.yml` with a
  single-platform `snapshot` mode that smoke-tests and publishes the exact
  generated tarball under the `snapshot` tag using trusted publishing; verify
  workflow syntax, scoped triggers, caching, permissions, concurrency, and the
  documented cost comparison.
- [x] 2.4 Change the guarded main release to pass one tarball plus digest from
  package verification to `npm publish <tarball>` without rebuilding; verify
  release-agent tests, `pnpm release:plan`, and artifact identity assertions.
- [x] 2.5 Update `docs/reference/release.md` with snapshot invocation,
  immutable version/digest evidence, `snapshot` versus `latest`, and rollback;
  verify every documented command matches the workflow inputs and scripts.

## 3. Stable device runtime

- [x] 3.1 Add a versioned runtime descriptor and managed install location to
  `src/scripts/install.ts`, including registry-only snapshot resolution,
  absolute Node and package entrypoint capture, atomic activation, and retained
  rollback; verify installer unit tests use no checkout link, local tarball,
  `npx`, PATH lookup, or shim in the activated command.
- [x] 3.2 Generate Codex TOML and Copilot JSON from the same selected runtime
  descriptor while preserving separate stdio bridges and dry-run previews;
  verify exact config serialization tests for both clients.
- [x] 3.3 Remove Astrograph's repository-local MCP version override and add a
  migration check for shadowing project registrations; verify launches from
  neutral directories and repositories with different `.tool-versions` report
  the same immutable version.
- [x] 3.4 Extend `doctor --json` and human diagnostics with configured/effective
  client paths and versions, runtime descriptor health, daemon identity,
  canonical project root, index state, and reload guidance; verify redaction and
  broken-runtime focused tests.

## 4. Multi-client daemon reliability

- [x] 4.1 Key daemon tenants by real canonical worktree root and preserve
  distinct index metadata for worktree aliases; verify
  `tests/daemon-tenants.test.ts` covers aliases, two worktrees, and a separate
  repository.
- [x] 4.2 Isolate daemon state and endpoints by immutable package version while
  retaining lock-coordinated same-version startup, stale recovery, and one
  bounded retry; verify old and new live clients do not enter competing restart
  loops and failures finish within the documented deadline.
- [x] 4.3 Add a reliability harness that exercises Codex- and Copilot-shaped
  stdio bridges concurrently across two worktrees and another repository;
  verify tool listing, project status, hydration, search, version agreement,
  and index isolation over repeated starts.
- [x] 4.4 Record the daemon keep/remove decision from reliability evidence; if
  the daemon passes, verify the shared-process efficiency assertion, otherwise
  replace shared ownership behind the unchanged bridge contract and rerun the
  same harness.
- [ ] 4.5 Give `index_folder` a bounded long-running IPC budget without slowing
  failure feedback for ordinary queries; verify the timeout policy and the live
  published-runtime hydration path.

## 5. Publish and device proof

- [x] 5.1 Run `pnpm build`, `pnpm type-lint`, focused tests,
  `pnpm test:package-bin:prebuilt`, `pnpm check:version-bump`, and strict
  OpenSpec validation for this change; record every result.
- [ ] 5.2 Commit and push the implementation, require exact-head CI success,
  then dispatch the snapshot publish for that SHA; verify npm reports the
  expected `snapshot` version and the published tarball digest matches CI.
- [ ] 5.3 Install `astrograph@snapshot` into this computer's managed runtime and
  activate both clients; verify post-install readback contains registry origin,
  immutable version, absolute runtime paths, and a retained rollback target.
- [ ] 5.4 Reload Codex and Copilot if their live MCP catalogs require it, then
  run tool-list, project status, hydration, and search from multiple
  repositories and two worktrees; record versions, roots, daemon identity,
  index separation, failures, and recovery timings in the change evidence.
- [ ] 5.5 Update `BACKLOG.md` with the achieved P0 state and next unresolved
  priority, sync the repository-workflow spec, and archive this change only
  after all exit criteria and remote/package readbacks pass.
