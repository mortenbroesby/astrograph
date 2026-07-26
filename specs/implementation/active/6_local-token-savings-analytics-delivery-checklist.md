# Local Token-Savings Analytics Delivery Checklist

> **Status:** Active — selected by the user on 2026-07-26.

**Goal:** Deliver the smallest credible local token-savings report by extending
the existing `report` command, without noticeable request-path
overhead or any tracking service.

**Architecture:** Start with the existing local event sink, MCP formatting
metrics, and report command. Add only exact values already produced during
response formatting, correlate them with the existing completion event, and
aggregate on explicit report invocation. Keep collection source-free and local.
No new database, periodic job, exporter, network call, token recount, or SDK.

**Default scope:** With `--repo`, report only that repository. Without it,
report the current resolved repository for repository-local storage and all
registered local repositories for global storage. Do not add a scope flag or
scan user directories; global aggregation is limited to existing Astrograph
storage records.

**Tech Stack:** TypeScript, Node.js 22, existing event sink/MCP/CLI modules,
Vitest, and the current compact-output benchmark.

---

## Task 1: Establish the exact-data baseline

**Files:** `src/event-sink.ts`, `src/mcp.ts`, `src/efficiency-report.ts`,
`tests/efficiency-report.test.ts`, `docs/guides/performance.md`

- [x] Run the current report against repo-local and global-storage fixtures;
  map every field to its event source, marking it exact, heuristic, or
  unavailable.
- [x] Specify and test default scope: explicit `--repo` is target-only,
  repository-local no-argument use resolves the current repository, and global
  no-argument use reads only registered Astrograph repositories.
- [x] Prove which formatting paths already expose exact delivered/baseline token
  counts, including JSON, AGC1, and content references.
- [x] Record request-path work before changes; do not add a new counter or
  serializer merely to satisfy the report.

**Result (2026-07-26):** Existing `mcp.tool.response_formatted` events already
contain exact `tokens` and `savedTokens` from `formatMcpEnvelope`; the report
aggregates those values only when explicitly invoked. JSON and reference
responses without a known canonical comparison remain explicitly unavailable.

## Task 2: Add only exact, source-free aggregates

**Files:** `src/mcp.ts`, `src/efficiency-report.ts`, `src/cli.ts`,
`tests/efficiency-report.test.ts`, `tests/interface.test.ts`

- [x] Aggregate existing formatted-response metadata directly; no correlation
  join or additional request event is required.
- [x] Add schema-versioned totals for exact delivered tokens, exact saved
  tokens, unavailable samples, and reference/full counts.
- [x] Exclude source, path, prompt, raw query, session ID, symbol name, and
  response body by focused regression test.
- [x] Keep the command explicit and local; no exporter flag, endpoint, or
  credential option.
- [x] Keep one command: derive default scope from storage mode rather than
  adding a flag, profile, or separate global-report command.

## Task 3: Prove negligible overhead and document the handoff

**Files:** `scripts/measure-agc1-compact-output-matrix.mjs`,
`tests/compact-output-traces.test.ts`, `docs/guides/performance.md`,
`specs/api-design/cli-api.md`

- [x] Compare the existing compact-output trace before and after; account for
  any latency change and reject a change that adds tokenization or persistence
  to a normal request.
- [x] Document the JSON report as a local offline handoff shape for a future
  separately selected exporter.
- [x] Run focused tests, `pnpm type-lint`, `pnpm build`,
  `pnpm test:package-bin`, `pnpm check:version-bump`, and `git diff --check`.

**Verification (2026-07-26):** focused report/CLI tests, type-lint, build,
package-bin smoke, version policy, and diff check passed. The small frontend
trace retained 1,578 reference-saved tokens and four exact AGC1 recoveries;
the implementation adds no new request-path event, tokenization, or persistence
operation.

## Commit checkpoint

Before committing source changes, run `pnpm check:version-bump` and use the
release-decision workflow to classify the change. Documentation-only focus
updates require `git diff --check` and the spec-index check instead.
