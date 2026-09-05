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
