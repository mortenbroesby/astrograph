# Token-Efficient Agent Output Delivery Checklist

> **Status:** Closed — completed Story 4 end-cap of the
> [Precision Retrieval and Agent Experience epic](./precision-retrieval-agent-experience-epic.md).

**Goal:** Deliver a measured, inspectable, agent-visible token-efficiency result
on `main` while ordinary JSON remains the stable default and failures fall back
without data loss.

**Architecture:** First capture real MCP envelopes and their declared token
counts. Compare a deterministic, lossless compact JSON draft only for the
measured repetitive shapes. Make the public contract decision in an ADR before
implementation; retain JSON as default, a reference decoder, strict v1 errors,
and explicit format-selection metrics. Do not add binary transport, hidden tool
routing, semantic retrieval, a daemon, or shared mutable state.

**Tech stack:** TypeScript, Node.js `>=22.12.0`, MCP v1, `fast-json-stringify`,
`gpt-tokenizer`, pnpm, Vitest, and the existing serialization benchmarks.

---

## Task 1: Establish the agent-visible baseline

**Files:** `src/serialization.ts`, `src/mcp.ts`, `src/mcp-contract.ts`,
`src/tool-observability.ts`, `scripts/perf-serialize.mjs`,
`tests/serialization.test.ts`, `tests/interface.test.ts`, and this checklist.

- [x] Capture deterministic successful, empty, error, and provenance-heavy
  MCP envelopes for `search_symbols`, `get_file_tree`, `get_file_outline`, and
  bounded `get_task_context`.
- [x] Record serialized bytes, exact declared tokenizer count, readability, and
  encode/decode latency for each envelope. Keep retrieval/source-token savings
  separate from response-encoding savings.
- [x] Add a reproducible benchmark fixture and command; record the baseline in
  this checklist before changing the public contract.

## Baseline evidence (2026-07-23)

- `pnpm bench:mcp-envelopes` creates and removes a deterministic two-file
  TypeScript fixture, dispatches real MCP v1 tools, normalizes only the
  fixture's temporary absolute path to `/fixture`, and prints the complete,
  readable JSON envelopes. It measures full agent-visible envelope bytes,
  `cl100k_base` tokens, and dispatch-plus-serialization latency.
- The initial baseline recorded: `search_symbols` success `1,457 bytes / 414
  tokens / 142.490ms`; empty `433 / 136 / 147.770ms`; strict invalid-argument
  error `234 / 72 / 111.509ms`; `get_file_tree` `312 / 105 / 151.374ms`;
  `get_file_outline` `1,106 / 322 / 156.886ms`; and provenance-heavy bounded
  `get_task_context` `1,881 / 523 / 173.403ms`.
- These are baseline measurements only. They prove the repetitive response
  shapes worth evaluating; the command output also records JSON encode latency
  and compact encode/reference-decode latency. The next task must compare a
  lossless draft against the same stabilized envelopes.

## Task 2: Select and specify one lossless reduction

**Files:** this checklist, `specs/architecture/adrs.md`, a new ADR under
`specs/architecture/`, `specs/api-design/mcp-tools.md`, and
`docs/guides/performance.md`.

- [x] Benchmark a table/path-interned, versioned compact JSON draft against the
  baseline. Set any `auto` threshold only from measured savings; do not assume
  a fixed percentage.
- [x] If compact JSON is not the best measured result, select a different
  inspectable, lossless, agent-visible reduction instead; do not close this
  story without a delivered result.
- [x] Record the ADR and public contract: selected tools, `json|compact|auto`
  behavior if used, versioned envelope, reference decoder, JSON fallback,
  error behavior, and `get_task_context` budget accounting per format.

## Selected reduction (2026-07-23)

- The same stabilized fixture round-tripped a versioned `agc1` compact JSON
  implementation exactly for `search_symbols`, `get_file_tree`, and
  `get_file_outline`. It saved `230 / 414` tokens (55.6%) for successful
  search, `78 / 136` (57.4%) for empty search, `70 / 105` (66.7%) for the tree,
  and `190 / 322` (59.0%) for the outline. `get_task_context` was not compacted.
- ADR-007 selects opt-in compact output for those measured shapes only. JSON is
  the default; compact failures and all strict errors use ordinary JSON. `auto`
  must save at least 20 tokens and 25%, thresholds below the smallest measured
  selected saving (70 tokens / 55.6%).

## Task 3: Implement and prove the vertical slice

**Files:** Exact files selected by Task 2, plus focused tests and benchmarks.
Update this checklist before implementation.

- [x] Add round-trip/reference-decoder tests for Unicode, empty/error payloads,
  nested provenance, and default-JSON compatibility.
- [x] Implement only the selected measured shapes. Emit format selection,
  bytes, response-token savings, and encode/decode latency without exposing
  private source content.
- [x] Run focused Vitest, `pnpm type-lint`, `pnpm build`, and `git diff --check`.
- [x] Stage and run `pnpm check:version-bump`, then obtain exact-head
  Fast/package evidence.
- [x] Commit, push, merge, and record the merged main commit and release result
  here. Only then may the Precision/Munch epic be considered for closure.

## Closure evidence (2026-07-23)

- PR [#79](https://github.com/mortenbroesby/astrograph/pull/79) merged the
  implementation commit `2ac14f3` into `main` as squash merge
  `3a8fa04a71e855c2eace9e587ea42ee7d14ea2b7`.
- Exact-head PR CI run `30028856824` passed Fast required checks in 58 seconds;
  the cost-scoped Windows and retry jobs were intentionally skipped. Merged-main
  run `30028967067` passed its Fast job in 58 seconds, including package and
  MCP stdio smoke.
- The guarded release created `v0.7.0-alpha.165` for the merged commit, but its
  npm publication failed with registry `E404`/permission denied at job
  `89280716957`. `npm view astrograph@0.7.0-alpha.165` confirms the version is
  not published. This is a tracked release-operation exception, not a source or
  contract failure; retry publication only after npm registry access is fixed.

## Acceptance evidence

- A reproducible agent-visible baseline and selected reduction are documented.
- The selected output round-trips losslessly (or has an equally inspectable
  public contract) and materially reduces measured response tokens.
- JSON remains the default, errors remain strict v1 envelopes, and every
  compact/auto failure returns the ordinary JSON-safe path.
- The result is merged to `main`; it does not add binary transport, hidden
  routing, remote state, or a shared mutable index.
