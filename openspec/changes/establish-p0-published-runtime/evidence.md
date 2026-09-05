# Verification Evidence

## Shared daemon decision

Decision: keep the shared daemon for the snapshot candidate.

Evidence recorded 2026-09-05:

- `pnpm exec vitest run tests/daemon-runtime.test.ts tests/daemon-server.test.ts tests/daemon-process.test.ts tests/daemon-tenants.test.ts` passed 17/17 tests with host Unix-socket access.
- Six simultaneous command callers performed one incompatible-version replacement and all completed against the replacement process.
- Two simultaneous reconcilers caused exactly one authenticated shutdown; malformed handoff state failed closed and dead-owner state recovered.
- `pnpm exec vitest run tests/daemon-reliability.test.ts` passed twice, in 12.7 seconds and 16.3 seconds.
- Each reliability run started Codex- and Copilot-named stdio clients twice, for four bridge lifetimes total, while retaining one compatible daemon PID.
- The clients listed the same complete tool set and package version, hydrated two linked worktrees plus a separate repository, reused their indexes after restart, and kept all three storage identities distinct.
- A search for the primary-worktree-only symbol from the linked worktree returned no results, directly checking tenant isolation.

The one shared daemon therefore reduces four bridge processes to one indexing
service without failing the current concurrency, restart, recovery, version, or
isolation gates. Removal is not justified by current evidence. Reconsider this
decision if the published-snapshot device proof fails the same harness or if a
reproducible failure remains attributable to shared daemon ownership.

## Pending device evidence

Exact-head CI, npm snapshot publication/digest, managed installation, and live
Codex/Copilot catalog readback remain pending and are recorded here when tasks
5.2 through 5.4 complete.

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

A laptop-wide read-only scan also found clean tracked project overrides pinned
to `astrograph@0.3.1-alpha.74` in Playground and two of its worktrees, plus an
untracked Playground Copilot CLI override. These explain the separately
reported live daemon/client mismatch: project configuration takes precedence
over the new global registration. They remain device-migration work for the
published `.232` snapshot rather than being silently edited in unrelated
worktrees.

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
