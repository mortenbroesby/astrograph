## 1. Daemon compatibility and handoff

- [ ] 1.1 Make ready daemons reusable by compatible protocol rather than exact package version, and verify focused tests cover a newer client reusing an older compatible daemon plus rejecting an incompatible protocol.
- [ ] 1.2 Add one authenticated internal daemon shutdown path with bounded idle/active-command handling, and verify unauthorized control cannot stop the daemon while an authorized request removes its endpoint and runtime record.
- [ ] 1.3 Add lifecycle handoff for an older live compatible daemon, including the authenticated pre-control fallback and rollback-safe failure guidance, and verify process tests prove one current daemon owns the shared record after upgrade.

## 2. One managed global runtime

- [ ] 2.1 Split repository-local and global managed invocations so global registrations launch the current installed package directly without `npx`, and verify Codex and Copilot CLI previews contain the absolute package/runtime invocation.
- [ ] 2.2 Make global install/update/repair/reconfigure converge every existing Astrograph-owned global client entry while preserving unrelated and unmanaged configuration, and verify repeated lifecycle operations are idempotent and non-destructive.
- [ ] 2.3 Extend source-free global diagnostics for the managed invocation, daemon owner version, and detectable conflicts, and verify no endpoint, token, repository path, source, or query is exposed.

## 3. Upgrade and indexing proof

- [ ] 3.1 Add a packed-package regression that upgrades a managed global setup, proves no client startup invokes a package downloader, and successfully runs `index_folder` through the synchronized singleton daemon.
- [ ] 3.2 Update global setup, lifecycle, and troubleshooting documentation to describe one managed runtime, automatic daemon synchronization, unmanaged-conflict limits, and hydration-first fatal fallback.

## 4. Release verification

- [ ] 4.1 Run `pnpm exec vitest run tests/daemon-runtime.test.ts tests/daemon-process.test.ts tests/engine-contract.test.ts`, `pnpm type-lint`, `pnpm build`, `pnpm test:package-bin`, and `git diff --check`; record any platform limitation instead of weakening the contract.
- [ ] 4.2 Run `pnpm check:version-bump` and `pnpm release:plan`, apply the repository release decision, and verify OpenSpec with `pnpm exec openspec validate single-global-install-and-daemon --strict`.
