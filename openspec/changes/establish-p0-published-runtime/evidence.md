# Verification Evidence

## Shared daemon decision

Decision: keep one shared daemon per immutable package version.

Evidence recorded 2026-09-05:

- `pnpm exec vitest run tests/daemon-runtime.test.ts tests/daemon-server.test.ts tests/daemon-process.test.ts tests/daemon-tenants.test.ts` passed 17/17 tests with host Unix-socket access.
- Six simultaneous command callers performed one incompatible-version replacement and all completed against the replacement process.
- Two simultaneous reconcilers caused exactly one authenticated shutdown; malformed handoff state failed closed and dead-owner state recovered.
- `pnpm exec vitest run tests/daemon-reliability.test.ts` passed twice, in 12.7 seconds and 16.3 seconds.
- Each reliability run started Codex- and Copilot-named stdio clients twice, for four bridge lifetimes total, while retaining one compatible daemon PID.
- The clients listed the same complete tool set and package version, hydrated two linked worktrees plus a separate repository, reused their indexes after restart, and kept all three storage identities distinct.
- A search for the primary-worktree-only symbol from the linked worktree returned no results, directly checking tenant isolation.

The isolated suite showed that same-version sharing reduces four bridge
processes to one indexing service without weakening tenant isolation. The first
published-snapshot device proof then reproduced a cross-version failure: live
`0.12.0-alpha.217` bridges and the installed `.232` bridge repeatedly contended
for the unversioned `daemon.json` and socket, while the older daemon could not
confirm the newer graceful-shutdown command. The `.233` candidate therefore
uses a deterministic daemon state/socket namespace per immutable package
version. Old and new client sessions can coexist, while Codex and Copilot on
the same selected version still share one daemon. Removing the daemon is not
justified unless the published `.233` proof attributes another failure to
same-version ownership.

## Device evidence

The published `.235` snapshot has exact-head CI, npm digest, managed
installation, and live Codex/Copilot retrieval evidence below. The final
documentation/diagnostic closeout head remains to be published and read back
before task 5.2 and archive.

The first snapshot dispatch, run `33977601352`, stopped safely before npm
publication. Its exact artifact version
`0.13.0-alpha.230.snapshot.33977601352.g2a0f9870dd85` exposed that module startup
still parsed runtime package identity with the production-only version parser.
The runtime parser now accepts only the workflow's immutable snapshot suffix
while release and tag policy remain production-only. Before redispatch, a local
snapshot artifact at `0.13.0-alpha.231.snapshot.999999991.g2a0f9870dd85` was
packed once and the same tarball passed the complete package smoke, including
global Codex and Copilot registration, MCP behavior, and repository isolation.

Exact-head Required CI run `33978622643` passed commit `de0b7c1` in 1 minute
22 seconds. Snapshot run `33978725786` then packed, smoked, and published
`0.13.0-alpha.231.snapshot.33978725786.gde0b7c150a30`. Its immediate dist-tag
readback received a transient npm 404, so the workflow reported failure after
publication. Independent registry readback returned the expected version, and
the downloaded tarball SHA-256
`10798f392d53700c9040997a8095db78845887b61ab5672c1f81f7e1c6e23ed6`
matched CI exactly. Registry verification now retries the expected dist-tag for
up to 60 seconds before failing; `latest` remained `0.12.1-alpha.223`.

Snapshot run `33979146118` passed the corrected exact-artifact workflow in 1
minute 33 seconds and published
`0.13.0-alpha.231.snapshot.33979146118.g2d0b8b76c285` with SHA-256
`67ce07baff94dd3c1fd2f4af225cab97a0defe8fd43c404785bec6f941e8cd14`.
Fresh `codex mcp list` and `copilot mcp list` processes discovered the managed
registration, but the first real `get_project_status` call exposed a missing
`better-sqlite3.node`: the managed install had suppressed all dependency
scripts and its activation probe only listed tools. A targeted
`npm rebuild better-sqlite3` restored the tool immediately. Managed installs
now rebuild only that native dependency in the final version directory and
open an in-memory database before activation. The exact local `.232` runtime
tarball then passed the full package smoke after aligning its global-install
command budget with the existing bounded 16-second MCP startup budget.
Snapshot run `33981198831` published the exact `.232` artifact; npm subsequently
returned `0.13.0-alpha.232.snapshot.33981198831.gcabe86570f60`, and the
downloaded SHA-256
`a232e60512e3c6513de322cfabf3b57dbd383adaa6472d7f9f6c2c4ca73accab`
matched CI. Its dist-tag needed longer than the initial 10-second verification
window, motivating the bounded 60-second readback window.

Snapshot run `33981591192` then passed the complete workflow in 1 minute 36
seconds from exact commit `deb9b2afbafb006c66082d64c4e6b05c72fdb7bd`. It
published `0.13.0-alpha.232.snapshot.33981591192.gdeb9b2afbafb`; registry
readback downloaded the same tarball and matched SHA-256
`43c00a8553a93c76f65f6c5a2591fd75734dc6e0cf547b4ba7438c729493ec36`.
Both global client adapters activated that immutable runtime with absolute Node
and package paths, and `previous.json` retained the working `.231` snapshot.
Two real client-shaped bridges listed all 14 tools and reported `.232`, but
project status reproduced the reported mismatch against a live
`0.12.0-alpha.217` daemon. Process and runtime-state readback confirmed multiple
old MCP sessions alongside the new daemon, proving the unversioned daemon
namespace—not package resolution or SQLite activation—was the remaining root
cause.

The `.233` version-scoped daemon change passed 19 focused daemon/runtime tests:
15 state/server/tenant tests, 3 spawned-process recovery tests, and the full
Codex/Copilot reliability harness. The reliability harness completed in 47.1
seconds under current machine load. Build and `pnpm type-lint` also passed. A
local immutable `.233.snapshot.999999994` artifact was packed successfully;
its first full package smoke reached npm global installation but the native
install process exited without output while another machine-wide `npm ci` was
consuming substantial CPU and memory. That attempt is not counted as passing;
the exact-head CI package smoke remains required before publication.

Exact-head CI run `33983223966` passed `.233` commit `b936cb5` in 1 minute 20
seconds, including package and MCP smoke. Snapshot run `33983308867` then
passed in 1 minute 27 seconds and published
`0.13.0-alpha.233.snapshot.33983308867.gb936cb5ddf63`; registry readback matched
SHA-256 `20396149eeb459f98d74f44a4af73061ae6c4ab9ab55e1986ebf568f2a4fcedb`.
Both clients activated it while the old `.217` processes remained live. The
next real device proof no longer reported any version mismatch and reached
`index_folder`, directly proving version-namespace coexistence. Hydration then
exposed a separate uniform 10-second daemon request limit. The next candidate
keeps ordinary queries at 10 seconds and gives full-folder hydration a bounded
240-second IPC budget. Under concurrent machine load, a spawned daemon also
crossed the old 5-second startup ceiling; `.235` uses a 32-second bounded
startup/handoff/activation budget. Package-smoke managed installs likewise have
a 240-second process budget. Final publication and device proof remain required.

A laptop-wide read-only scan also found clean tracked project overrides pinned
to `astrograph@0.3.1-alpha.74` in Playground and two of its worktrees, plus an
untracked Playground Copilot CLI override. These explain the separately
reported live daemon/client mismatch: project configuration takes precedence
over the new global registration. They were handled as explicit device
migration rather than hidden runtime behavior: the migration removed those
Astrograph-only overrides from Playground main and both active feature
worktrees. Cleanup commits `6e514b5`,
`75d0daf`, and `74ee535` were pushed to their respective branches; generated
backup copies were moved to the recoverable temporary folder
`/private/tmp/astrograph-stale-registration-backups-20260905T1846`.

Exact-head Required CI run `33984260764` passed commit `dd8b8dd` in 1 minute 31
seconds. Snapshot run `33984371913` passed in 1 minute 38 seconds and published
`0.13.0-alpha.235.snapshot.33984371913.gdd8b8dde084b`. Registry readback matched
SHA-256 `f718a9d2c894d521a1fa992888f8f190be0becfd5c4ef28bfea55575d9f00e8f`.
Separate global installer runs activated that exact version for Codex and
Copilot CLI with the same absolute Node and package entrypoint; `previous.json`
retained `.233` as rollback.

Two simultaneous real MCP clients named for Codex and Copilot each exposed all
14 tools and reported the exact `.235` snapshot. In 12.97 seconds they hydrated
or reused, then searched, the task worktree, the primary Astrograph checkout,
and the separate Agent Distro repository. All searches returned matches and
all three canonical roots used distinct global storage directories. A later
hydration under severe device load crossed the MCP SDK's default 60-second
caller timeout while the server continued safely; this validates retaining the
bounded 240-second internal `index_folder` budget without changing the fast
10-second ordinary-query budget.

The live proof also exposed that setup diagnostics still inspected the retired
unversioned daemon path. The shared daemon namespace resolver now accepts the
managed runtime's selected immutable version. With a live `.235` bridge,
`doctor --json` reported daemon PID `1793`, the versioned endpoint under
`runtime/daemons/ed6eba9698e8c818`, the exact snapshot version, and
`compatible: true`. The focused runtime tests passed 8/8; the exact installer
contract passed with a verification-only 20-second test ceiling after exceeding
the old 5-second ceiling by 74 ms under machine load. Build, type lint, strict
OpenSpec validation, and `git diff --check` passed after the fix.

## Pre-publication gates

Required task 5.1 evidence recorded 2026-09-05:

- `pnpm build`: passed for `0.13.0-alpha.230`.
- `pnpm type-lint`: passed for the package and benchmark TypeScript projects.
- `pnpm lint:runtime` plus Oxlint on the changed daemon/runtime tests: passed with three pre-existing `no-useless-escape` warnings in `src/scripts/install.ts`.
- Focused daemon/runtime/tenant tests: passed 17/17 with host Unix-socket access.
- `tests/daemon-reliability.test.ts`: passed twice independently.
- `tests/process-script-adoption.test.ts`: passed 3/3 after routing the installer MCP probe through the shared process seam.
- `pnpm test:package-bin:prebuilt`: passed against `astrograph-0.13.0-alpha.230.tgz`, including packed global Codex and Copilot CLI activation.
- `pnpm check:version-bump --base origin/main`: passed.
- `pnpm agents:check`, strict OpenSpec validation, and `git diff --check`: passed.

A supplemental `pnpm test` run passed 378 tests and failed 13. Serial reruns
cleared the daemon process, compact-output, broad MCP, ranking, and Git-watch
failures, identifying full-suite CPU contention. Two current-main assertions
remain independently stale: `tests/interface.test.ts` expects the deliberately
removed `scripts/astrograph.mjs`, and the large-file parser test requires chunk
fallback even though the current parser succeeds in one pass. The aggregate
performance benchmark also has an existing unchecked error-result path. These
are outside this change's required publication gates and are not represented as
passing.
