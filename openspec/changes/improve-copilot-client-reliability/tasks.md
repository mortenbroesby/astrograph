## 1. Reproduce and classify

- [x] 1.1 Reproduce the Copilot-observed stale or missing-index path with the current source and record whether failure occurs in startup, indexing, or MCP transport; verify with a focused local command and a red test or captured failure.
- [x] 1.2 Trace every caller of the selected shared recovery boundary and choose the smallest compatible failure classification; verify the decision against `src/daemon-client.ts`, `src/mcp.ts`, and existing daemon/MCP tests.

## 2. Implement bounded recovery

- [x] 2.1 Preserve strict `content-references-v1` validation and add only the regression coverage needed for valid and malformed sessions; verify `tests/mcp-session.test.ts` passes.
- [x] 2.2 Implement one actionable recovery failure at the shared daemon-to-MCP boundary, retaining the existing single replacement-daemon retry; verify the focused daemon and MCP tests pass.
- [x] 2.3 Exclude nested `.worktrees` copies and add missing/stale-index recovery tests that prove normal indexed retrieval after hydration and the stable recovery failure when the request deadline expires; verify focused filesystem, daemon, and MCP tests pass.

## 3. Verify with Copilot

- [x] 3.1 Run `pnpm check:version-bump` and the focused test, type, and build checks required by the changed source; verify each command succeeds.
- [x] 3.2 Retest the same scenario through the configured Copilot CLI agent and append a privacy-safe outcome, friction, and measured savings entry to the local Copilot × Astrograph Markdown report.
