## 1. Runtime Contract

- [x] 1.1 Change package, build, installer, workflow, and focused contract expectations to Node.js 22.12+; verify Node 20 setup is rejected before configuration writes and Node 22.12 is accepted.
- [x] 1.2 Upgrade `better-sqlite3` to `^13.0.3`, regenerate the lockfile, and verify `pnpm why prebuild-install` returns no dependency path.

## 2. Compatibility Guidance

- [x] 2.1 Update current README, troubleshooting, and release guidance and mark the dated Node 20-24 review superseded; verify no current user-facing file promises Node 20 support.

## 3. Verification and Delivery

- [x] 3.1 Run focused installer/package tests, `pnpm build`, `pnpm type-lint`, `pnpm test:package-bin`, and the prebuilt package smoke under local Node 24; verify native database indexing succeeds and install output has no `prebuild-install` warning.
- [x] 3.2 Run `pnpm check:version-bump --base origin/main`, the release-decision workflow, and strict OpenSpec validation; apply the breaking alpha version decision and resolve scoped failures.
- [ ] 3.3 Review and secret-scan the minimal diff, commit and push the branch, verify exact-head required CI, merge through GitHub, close issue #125 with the delivered evidence, and archive the completed OpenSpec change.
