# Local Token-Savings Analytics Delivery Checklist

> **Status:** Active — selected by the user on 2026-07-26.

**Goal:** Deliver the smallest credible local token-savings report by extending
the existing `efficiency-report` command, without noticeable request-path
overhead or any tracking service.

**Architecture:** Start with the existing local event sink, MCP formatting
metrics, and report command. Add only exact values already produced during
response formatting, correlate them with the existing completion event, and
aggregate on explicit report invocation. Keep collection source-free and local.
No new database, periodic job, exporter, network call, token recount, or SDK.

**Tech Stack:** TypeScript, Node.js 22, existing event sink/MCP/CLI modules,
Vitest, and the current compact-output benchmark.

---

## Task 1: Establish the exact-data baseline

**Files:** `src/event-sink.ts`, `src/mcp.ts`, `src/efficiency-report.ts`,
`tests/efficiency-report.test.ts`, `docs/guides/performance.md`

- [ ] Run `astrograph efficiency-report --repo <fixture>` and map every current
  field to its event source, marking it exact, heuristic, or unavailable.
- [ ] Prove which formatting paths already expose exact delivered/baseline token
  counts, including JSON, AGC1, and content references.
- [ ] Record request-path work before changes; do not add a new counter or
  serializer merely to satisfy the report.

## Task 2: Add only exact, source-free aggregates

**Files:** `src/mcp.ts`, `src/efficiency-report.ts`, `src/cli.ts`,
`tests/efficiency-report.test.ts`, `tests/interface.test.ts`

- [ ] Reuse one existing correlation ID so report aggregation joins only
  metadata that was already available for that response.
- [ ] Add schema-versioned totals for exact delivered tokens, exact saved
  tokens, unavailable samples, and reference/full counts.
- [ ] Exclude source, path, prompt, raw query, session ID, symbol name, and
  response body by focused regression test.
- [ ] Keep the command explicit and local; no exporter flag, endpoint, or
  credential option.

## Task 3: Prove negligible overhead and document the handoff

**Files:** `scripts/measure-agc1-compact-output-matrix.mjs`,
`tests/compact-output-traces.test.ts`, `docs/guides/performance.md`,
`specs/api-design/cli-api.md`

- [ ] Compare the existing compact-output trace before and after; account for
  any latency change and reject a change that adds tokenization or persistence
  to a normal request.
- [ ] Document the JSON report as a local offline handoff shape for a future
  separately selected exporter.
- [ ] Run focused tests, `pnpm type-lint`, `pnpm build`,
  `pnpm test:package-bin`, `pnpm check:version-bump`, and `git diff --check`.

## Commit checkpoint

Before committing source changes, run `pnpm check:version-bump` and use the
release-decision workflow to classify the change. Documentation-only focus
updates require `git diff --check` and the spec-index check instead.
