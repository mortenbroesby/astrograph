## 1. Device installation registration

- [x] 1.1 Make global Codex and Copilot CLI setup register the device-installed `astrograph mcp` command, and verify focused installer tests assert identical registrations.
- [ ] 1.2 Bootstrap and verify the device command before global registration writes, preserving transactional rollback; verify installation failure leaves both client configs unchanged.

## 2. Shared runtime behavior

- [ ] 2.1 Cover two globally configured clients resolving the same global cache and compatible daemon runtime, and verify focused daemon/installer tests pass.
- [ ] 2.2 Keep stale-record recovery bounded and non-destructive; verify stale runtime tests retain existing global cache paths.

## 3. User experience and verification

- [x] 3.1 Update global-install output and documentation to explain one device runtime with per-client stdio bridges, and verify documentation references the global command.
- [x] 3.2 Run `pnpm exec vitest run --dir tests engine-contract.test.ts daemon-runtime.test.ts runtime-presence.test.ts --no-file-parallelism`, `pnpm type-check`, `pnpm check:version-bump --base origin/main`, and `openspec validate unify-device-runtime --strict --no-interactive`.
- [ ] 3.3 Retest a permission-complete Copilot CLI invocation against the installed registration, append its source-free finding through the allowed report path, and verify index health and no extra daemon is created.
