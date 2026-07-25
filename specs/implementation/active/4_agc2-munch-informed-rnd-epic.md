# AGC2 Compact Output Research and Development Epic

**Goal:** Establish a benchmark-first, Astrograph-owned compact-output system
that replaces AGC1 only when a representative corpus proves AGC2 is materially
smaller, lossless, safe to decode, and operationally worthwhile.

**Architecture:** This is an R&D epic, not a commitment to a preselected wire
format. It evaluates independent AGC2 candidates behind a non-serving codec
lab: fixed-width packed rows, schema IDs, prefix legends, typed text tables,
and a bounded generic fallback. Strict MCP v1 JSON remains the exact default;
MUNCH is design research only, never a compatibility target or copied
implementation.

**Tech Stack:** TypeScript, Node 22+, `tiktoken`, Vitest, the real Astrograph
MCP dispatcher, deterministic generated repositories, and JSON benchmark
artifacts.

**Decision record:** [ADR-010](../../architecture/adrs.md#adr-010-gate-agc2-on-a-representative-research-corpus)

---

## Story 1: Research Baseline and Codec Constraints

**Purpose:** Turn external MUNCH research and the existing AGC1/AGC2 work into
explicit Astrograph hypotheses, constraints, and falsifiable experiments.

**Files:**
- Modify: `specs/architecture/adrs.md`
- Modify: `specs/implementation/planned/8_agc2-encoding-and-benchmark-redesign.md`
- Create: `specs/implementation/active/4_agc2-munch-informed-rnd-epic.md`

- [x] Inspect the MUNCH specification and reference implementation without
  importing code or claiming compatibility.
- [x] Record reusable ideas: short per-tool schema IDs, prefix interning,
  typed row coercion, generic homogeneous-row fallback, measured fallback, and
  schema/producer mismatch rejection.
- [x] Reject byte-estimate-only evidence for Astrograph; all decisions use
  normalized, exact `cl100k_base` tokens plus bytes and latency.
- [x] Freeze the current AGC2 packed-row experiment as a baseline, not a
  release candidate.

**Acceptance:** ADR-010 and this epic state the boundaries, hypotheses, and
the evidence required to replace AGC1.

## Story 2: Deterministic Repository Corpus

**Purpose:** Build realistic fixture repositories that expose both compacting
opportunities and compact-format overhead.

**Files:**
- Create: `tests/fixtures/compact-output/build-fixtures.ts`
- Create: `tests/fixtures/compact-output/queries.ts`
- Create: `tests/compact-output-fixtures.test.ts`
- Modify: `tests/fixture-repo.ts` only if shared setup is genuinely reusable

- [ ] Generate `small-frontend` (8–12 React/TypeScript/CSS/config/test files).
- [ ] Generate `product-monorepo` (60–100 files: React/TypeScript, C#/.NET,
  Java or Kotlin, OpenAPI/config, and tests).
- [ ] Generate `text-heavy-workspace` (25–40 Markdown, JSON, YAML, and long
  text previews with Unicode, quotes, delimiters, and whitespace).
- [ ] Generate `dead-code-workspace` (80–120 active, duplicated, and
  unreferenced TypeScript/C#/Java files).
- [ ] Define small, medium, broad, empty, error, Unicode, truncated, and
  mixed-type query cases for every compact-capable tool.
- [ ] Normalize roots, timestamps, and generated IDs; assert a repeated run
  returns byte-identical normalized captures.

**Acceptance:** Fixture tests index all four repositories through the real
engine and prove stable normalized MCP envelopes.

## Story 3: Corpus Benchmark Harness

**Purpose:** Make JSON, AGC1, and every candidate AGC2 encoding comparable
without changing a user-visible response.

**Files:**
- Create: `src/compact-mcp-candidates.ts`
- Create: `scripts/measure-compact-output-matrix.mjs`
- Create: `tests/compact-output-benchmark.test.ts`
- Modify: `package.json`

- [ ] Extract an explicit frozen AGC1 reference encoder used only for
  comparison; do not serve it as a new compatibility promise.
- [ ] Make candidate codecs return encoded text, decoder result, token count,
  byte count, encode/decode time, and a rejection reason.
- [ ] Add `pnpm bench:compact-output-matrix --json` with one record per
  fixture/query/codec combination and aggregate weighted statistics.
- [ ] Persist a reviewed baseline report or deterministic assertions so a
  future candidate cannot improve a single happy path while regressing others.
- [ ] Report JSON, AGC1, each AGC2 candidate, and selected outcome separately.

**Acceptance:** The same normalized envelope produces stable measurements;
benchmark tests detect malformed codecs and unaccounted capture changes.

## Story 4: Codec Laboratory

**Purpose:** Trial independently useful AGC2 structures rather than combining
unproven compression tricks in one opaque redesign.

**Files:**
- Modify: `src/compact-mcp-candidates.ts`
- Modify: `tests/compact-output-benchmark.test.ts`
- Modify: `specs/api-design/compact-output-v2.md` only after a candidate wins

- [ ] Candidate A — packed fixed-width rows, including the current AGC2
  experiment, to establish its exact corpus profile.
- [ ] Candidate B — encoder IDs and declarative per-tool schemas; the decoder
  rejects an unknown schema ID and mismatched producer columns.
- [ ] Candidate C — shared prefix legend for paths only when its measured
  encoding cost is repaid within that response.
- [ ] Candidate D — typed delimited rows with escaping and explicit null,
  boolean, integer, float, and Unicode behavior.
- [ ] Candidate E — bounded generic homogeneous-list fallback with explicit
  refusal for heterogeneous or lossy shapes.
- [ ] Fuzz malformed headers, legends, row widths, type tags, delimiters,
  embedded newlines, quotes, and unknown schema IDs.

**Acceptance:** Each candidate has a lossless decoder, an adversarial test
matrix, and a complete corpus report. Candidates may be rejected individually.

## Story 5: Selection Gate and Product Contract

**Purpose:** Decide whether any candidate becomes AGC2, AGC1 remains, or
compact output stays JSON-only for particular tools.

**Files:**
- Modify: `src/compact-mcp.ts`
- Modify: `src/mcp.ts`
- Modify: `tests/compact-mcp.test.ts`
- Modify: `tests/interface.test.ts`
- Modify: `specs/api-design/compact-output-v2.md`
- Modify: `specs/api-design/mcp-tools.md`

- [ ] Require at least **15% weighted exact `cl100k_base` savings versus
  AGC1** across successful migrated-tool captures in the complete corpus.
- [ ] Require no representative capture to be worse than AGC1; ties or losses
  select JSON in `auto`, and `compact` must clearly document its behavior.
- [ ] Require every AGC2-selected capture to save at least 20 tokens and 25%
  versus strict JSON.
- [ ] Publish the exact encoder IDs, escaping rules, schema lifecycle,
  fallback behavior, decoder contract, and malformed-input behavior only after
  the gate passes.
- [ ] If the gate fails, retain AGC1 and close the epic with the rejection
  report; do not version-bump storage merely to accompany an unproven codec.

**Acceptance:** One documented decision has complete per-fixture evidence,
round-trip coverage, and no hidden behavior change.

## Story 6: Release Evidence and Regression Guard

**Purpose:** Make compact-output performance durable after a codec is selected.

**Files:**
- Modify: `scripts/measure-compact-output-matrix.mjs`
- Modify: `tests/compact-output-benchmark.test.ts`
- Modify: `docs/guides/performance.md`
- Modify: `specs/implementation/roadmap.md`

- [ ] Add a bounded regression test over reviewed benchmark fixtures; it must
  report the specific fixture/query/codec that regressed.
- [ ] Keep the full corpus benchmark local/manual unless its measured runtime
  justifies CI cost under the GitHub Actions guardrail.
- [ ] Record final exact-token, byte, and latency distributions—not only an
  average—and state exclusions explicitly.
- [ ] Run focused tests, `pnpm type-lint`, `pnpm build`,
  `pnpm test:package-bin`, `pnpm check:version-bump`, and `git diff --check`.

**Acceptance:** Release evidence identifies the codec, corpus revision,
tokenizer, baseline, sample count, aggregate, and worst-case results.

## Epic-level stop conditions

- A candidate cannot round-trip every declared supported shape.
- Prefix legends or typed rows cost tokens on the small fixture without a
compensating corpus win.
- A generic encoder drops unknown fields, silently coerces data, or accepts a
schema/producer mismatch.
- The weighted selection gate fails or hides a regression in a fixture class.

In any stop condition, preserve strict JSON and AGC1; record the result in the
benchmark artifact and move the failed candidate to the rejected section of
the epic rather than weakening the gate.

## Initial verification

```bash
pnpm exec vitest run tests/compact-mcp.test.ts tests/interface.test.ts
pnpm bench:mcp-envelopes
pnpm type-lint
git diff --check
```

Expected: current baseline stays reproducible while Stories 2–4 add a separate
non-serving laboratory and corpus harness.

## Commit checkpoints

Commit Story 1 documentation independently. For each source-changing story,
stage only its codec, fixture, harness, test, and contract artifacts; run
`pnpm check:version-bump` before its intentional commit. No story authorizes
npm publication, tag creation, or pulling the PR out of draft.
