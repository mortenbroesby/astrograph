# Token-Efficient Agent Output Delivery Checklist

> **Status:** Active — selected Story 4 end-cap of the
> [Precision Retrieval and Agent Experience epic](../planned/1_precision-retrieval-agent-experience-epic.md).

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

- [ ] Capture deterministic successful, empty, error, and provenance-heavy
  MCP envelopes for `search_symbols`, `get_file_tree`, `get_file_outline`, and
  bounded `get_task_context`.
- [ ] Record serialized bytes, exact declared tokenizer count, readability, and
  encode/decode latency for each envelope. Keep retrieval/source-token savings
  separate from response-encoding savings.
- [ ] Add a reproducible benchmark fixture and command; record the baseline in
  this checklist before changing the public contract.

## Task 2: Select and specify one lossless reduction

**Files:** this checklist, `specs/architecture/adrs.md`, a new ADR under
`specs/architecture/`, `specs/api-design/mcp-tools.md`, and
`docs/guides/performance.md`.

- [ ] Benchmark a table/path-interned, versioned compact JSON draft against the
  baseline. Set any `auto` threshold only from measured savings; do not assume
  a fixed percentage.
- [ ] If compact JSON is not the best measured result, select a different
  inspectable, lossless, agent-visible reduction instead; do not close this
  story without a delivered result.
- [ ] Record the ADR and public contract: selected tools, `json|compact|auto`
  behavior if used, versioned envelope, reference decoder, JSON fallback,
  error behavior, and `get_task_context` budget accounting per format.

## Task 3: Implement and prove the vertical slice

**Files:** Exact files selected by Task 2, plus focused tests and benchmarks.
Update this checklist before implementation.

- [ ] Add round-trip/reference-decoder tests for Unicode, empty/error payloads,
  nested provenance, and default-JSON compatibility.
- [ ] Implement only the selected measured shapes. Emit format selection,
  bytes, response-token savings, and encode/decode latency without exposing
  private source content.
- [ ] Run focused Vitest, `pnpm type-lint`, `pnpm check:version-bump`,
  `pnpm build`, `git diff --check`, then obtain exact-head Fast/package evidence.
- [ ] Commit, push, merge, and record the merged main commit and release result
  here. Only then may the Precision/Munch epic be considered for closure.

## Acceptance evidence

- A reproducible agent-visible baseline and selected reduction are documented.
- The selected output round-trips losslessly (or has an equally inspectable
  public contract) and materially reduces measured response tokens.
- JSON remains the default, errors remain strict v1 envelopes, and every
  compact/auto failure returns the ordinary JSON-safe path.
- The result is merged to `main`; it does not add binary transport, hidden
  routing, remote state, or a shared mutable index.
