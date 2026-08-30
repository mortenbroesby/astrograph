# Session-Aware Repeat-Read Trace Delivery Checklist

> **Status:** Closed — baseline merged in PR #95 and superseded by the
> completed parent epic in PR #99.

**Goal:** Produce a deterministic, privacy-safe repeat-read benchmark that
decides whether any session-aware response feature is worth designing.

**Architecture:** Extend the existing `bench:agc1-compact-output` fixture
corpus and script. A trace is a checked-in sequence of current MCP tool calls;
it records canonical response bytes/tokens and only hashes/aggregate outcome
data, never fixture source or query text. This story changes no serving MCP
contract, session state, or output format.

**Baseline:** The existing `small-frontend` slice completed on 2026-07-26:
seven captures, four AGC1-eligible and lossless, with 1,483 canonical JSON
tokens and 468 AGC1 tokens. The full corpus is the next baseline capture and
must be recorded with its commit before a candidate is evaluated.

---

## Task 1: Freeze trace semantics and fixture coverage

**Files:**

- Modify: `tests/fixtures/compact-output/build-fixtures.ts`,
  `tests/fixtures/compact-output/queries.ts`
- Create: `tests/fixtures/compact-output/traces.ts`
- Test: `tests/compact-agc1-harness.test.ts`

- [x] Define trace identifiers, ordered tool calls, and expected response
  identity without storing source or raw query text in benchmark output.
- [x] Add one-shot and repeated-read traces over the existing four repository
  shapes: small front-end, C#/Java product monorepo, text-heavy workspace, and
  dead-code workspace. Reuse their existing deterministic fixture builders.
- [x] Test that trace IDs, order, fixture coverage, and response identity are
  deterministic; retain the current AGC1 losslessness test unchanged.

## Task 2: Extend the one existing benchmark command

**Files:**

- Modify: `scripts/measure-agc1-compact-output-matrix.mjs`,
  `tests/compact-output-fixtures.test.ts`, `package.json`
- Test: `tests/compact-agc1-harness.test.ts`

- [x] Emit a versioned JSON schema containing fixture/trace IDs, operation
  class, canonical bytes/tokens, AGC1 bytes/tokens where eligible, elapsed
  time, response hash, and recovery/correctness result.
- [x] Keep `--summary` source-free and stable. Do not create a competing
  benchmark runner or add a new dependency.
- [x] Add exact tests for the schema, repeated-read aggregation, deterministic
  output, and JSON/AGC1 response recovery.

## Task 3: Document and record the decision baseline

**Files:**

- Modify: `docs/guides/performance.md`,
  `specs/implementation/closed/session-aware-agent-efficiency-epic.md`

- [x] Document the command, its offline fixture boundary, and the difference
  between one-shot and repeated-read measurements.
- [x] Run the full corpus on a clean checkout and record command,
  tokenizer, aggregate counts, and known environment warnings in the epic.
- [x] Decide whether Story 2 has evidence to begin. The completed parent epic
  records the later, independently verified implementation decisions.

## Verification

Run before commit:

```bash
pnpm exec vitest run tests/compact-output-fixtures.test.ts tests/compact-agc1-harness.test.ts
pnpm bench:agc1-compact-output -- --summary
pnpm type-lint
pnpm build
pnpm check:version-bump
git diff --check
```

Expected: fixture tests prove deterministic lossless captures; the full command
prints a source-free report; type-check/build pass; version policy matches the
change; and the diff is whitespace-clean.
