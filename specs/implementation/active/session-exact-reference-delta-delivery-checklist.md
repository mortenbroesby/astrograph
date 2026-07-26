# Session Exact-Reference Delta Delivery Checklist

> **Status:** Active — Story 3 of the [Session-Aware Agent Efficiency Epic](../planned/8_session-aware-agent-efficiency-epic.md), selected by the user on 2026-07-26.

**Goal:** Return a smaller, exactly reconstructable response when the caller
proves it already holds the complete current canonical envelope.

**Architecture:** Reuse Story 2's SHA-256 content ID. If a valid session's
`knownContentIds` contains the ID computed for the current success envelope,
return `data: null` plus `meta.contentReference.representation: "reference"`.
The client reconstructs the complete response from its matching cached envelope.
Every other case—changed content, unknown base, malformed session, error, or no
capability—returns the existing full JSON response. No patch algorithm, source
retention, or daemon/session persistence is added.

**Tech Stack:** TypeScript, existing native SHA-256 session store, Vitest, and
the repeat-read benchmark. No dependency or new storage schema.

## Task 1: Exact-reference response contract

**Files:**

- Modify: `src/mcp-session.ts`, `src/mcp-contract.ts`, `src/mcp.ts`,
  `specs/api-design/mcp-tools.md`
- Test: `tests/mcp-session.test.ts`, `tests/compact-mcp.test.ts`

- [ ] Preserve the existing full response for no/unknown/malformed/error cases.
- [ ] Emit a `reference` response only for an exact current ID supplied by the
  client; never infer or accept a base by session ID alone.
- [ ] Define exact client reconstruction and the full fallback in the MCP spec.
- [ ] Keep session-enabled responses JSON-only; ordinary AGC1 remains unchanged.

## Task 2: Measure and prove the choice

**Files:**

- Modify: `scripts/measure-agc1-compact-output-matrix.mjs`,
  `tests/compact-output-traces.test.ts`, `docs/guides/performance.md`
- Test: `tests/mcp-session.test.ts`

- [ ] Add reference/full counts to repeated-read traces without emitting source.
- [ ] Prove byte-equivalent recovery for identical, changed, unknown, malformed,
  and error cases.
- [ ] Record exact token/byte savings and decide whether a real patch algorithm
  is justified; do not begin a line/JSON patch without that evidence.

## Verification

```bash
pnpm exec vitest run tests/mcp-session.test.ts tests/compact-mcp.test.ts tests/compact-output-traces.test.ts
pnpm bench:agc1-compact-output -- --summary
pnpm type-lint
pnpm build
pnpm check:version-bump
git diff --check
```
