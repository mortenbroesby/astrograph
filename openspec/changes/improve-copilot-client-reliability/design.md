## Context

A real Copilot CLI trial against this repository correctly rejected a malformed short `content-references-v1` session ID, then successfully obtained repository status using a valid session ID. Its `index_folder` and subsequent `search_text` requests timed out or returned `internal_error` against the unhydrated repository. The agent had no stable signal explaining whether to retry indexed retrieval or use its documented filesystem fallback.

The existing code already centralizes session validation in `src/mcp-session.ts`, daemon recovery in `src/daemon-client.ts`, MCP failure mapping in `src/mcp.ts`, and process coverage in `tests/mcp-session.test.ts` and `tests/daemon-process.test.ts`.

## Goals / Non-Goals

**Goals:**

- Preserve strict, compatible client-session validation.
- Make daemon/index recovery outcomes actionable and bounded.
- Prove recovery behavior with focused unit and daemon-process tests, then a Copilot CLI retest.

**Non-Goals:**

- Loosen session identifier validation to accept malformed client input.
- Change storage schemas, repository isolation, or daemon lifecycle design.
- Add external telemetry or automatic filesystem fallback inside Astrograph.

## Decisions

### Retain the existing session envelope

`src/mcp-session.ts` already specifies `content-references-v1`, a 16--128-character URL-safe session ID, and bounded content IDs. Keep that contract; add only regression coverage at `tests/mcp-session.test.ts` where needed. A client must send valid metadata rather than Astrograph silently weakening a trust boundary.

### Classify recovery failures at the shared command boundary

Trace `executeDaemonCommand` in `src/daemon-client.ts` through MCP error mapping in `src/mcp.ts`. Add the smallest typed or recognizable failure at this shared boundary that distinguishes daemon startup/request timeout or index recovery unavailability from an unexpected application error. Preserve the existing one stale-daemon replacement and one retry in `executeDaemonCommand`; do not add loops or per-client retry policy.

### Exclude nested local worktree copies

The reproduction showed that this checkout's unignored `.worktrees/` directory was included in discovery, extending the initial index beyond the fixed IPC timeout. Add `.worktrees` to the existing skip-segment sets in `src/filesystem-scan.ts` and `src/storage.ts`; the latter keeps discovery-only file listing consistent. This is a checkout-local implementation directory, analogous to `.git` and `node_modules`, not source belonging to the target repository.

### Test the boundary, not a Copilot-specific fork

Use `tests/daemon-process.test.ts` for real stale-daemon/retry behavior and the existing MCP test seam in `tests/mcp-session.test.ts` or the closest current MCP failure test for the resulting envelope. Copilot remains a manual compatibility client, not a runtime dependency or a test fixture.

## Risks / Trade-offs

- A more specific failure can expose operational detail. Keep it concise, stable, and free of paths, tokens, or process data.
- A large repository can legitimately require longer indexing than a test fixture. The fix must distinguish a bounded timeout from an arbitrary retry, not increase timeout globally without measurement. A timed-out initial request may continue indexing in the daemon, so the failure must tell clients to retry rather than imply data loss.
- The observed failure could be package-version or daemon-state specific. Reproduce it with the current source before selecting a code path.

## Migration Plan

No data migration. Existing daemon records and indexes retain their format. The new failure classification applies on the next MCP request.

## Validation Gates

The timeout was reproduced with the current source: daemon startup succeeds, but `index_folder` exceeds the fixed 10-second daemon request deadline while scanning nested `.worktrees` copies. The daemon later completes hydration and serves retrieval normally. Implement the smallest discovery exclusion and stable timeout classification; retain the existing one-retry recovery behavior.
