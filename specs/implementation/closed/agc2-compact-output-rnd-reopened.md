# Reopened AGC2 Compact Output R&D — Research Result

**Goal:** Re-establish the current AGC1 serving format as a directly measured,
lossless corpus baseline before evaluating further non-serving AGC2 candidates.

**Architecture:** The existing deterministic four-fixture corpus remains the
source of truth. The harness must distinguish the actual output of
`formatMcpEnvelope(..., "compact", ...)` from the frozen AGC1 comparison
encoder, assert they agree for every eligible capture, and prove that the
public decoder restores the normalized MCP v1 envelope. AGC2 remains an
isolated lab; nothing changes in serving output unless the ADR-010 gate passes.

**Tech Stack:** TypeScript, Node 22+, Vitest, `tiktoken`, real Astrograph MCP
dispatch, deterministic fixture repositories, and JSON benchmark artifacts.

**Prior evidence:** The closed [first AGC2 R&D epic](../closed/agc2-compact-output-rnd-epic.md)
rejected five candidates. Its corpus, codecs, and 15% exact-token/no-regression
selection gate are retained rather than restarted from a single happy path.

**Outcome:** Complete — the serving AGC1 baseline is now verified directly on
the deterministic corpus. Alias-symbol and directory-tree candidates each
proved substantial savings on two highly repetitive captures, but neither
provides representative coverage of the retained three-tool compact contract.
AGC1 remains the only serving compact format; AGC2 remains laboratory code.

---

## Task 1: Make the Serving AGC1 Baseline Explicit

**Files:**
- Modify: `scripts/measure-compact-output-matrix.mjs`
- Modify: `tests/compact-output-benchmark.test.ts`
- Modify: `tests/compact-mcp.test.ts`
- Modify: `docs/guides/performance.md`

- [x] **Step 1: Establish the current baseline**

Run:

```bash
pnpm exec vitest run tests/compact-mcp.test.ts tests/compact-output-benchmark.test.ts
pnpm bench:compact-output-matrix -- --summary --fixture=small-frontend
```

Expected: the retained AGC1 contract passes; the matrix records exact
`cl100k_base` measurements and candidate rejection reasons.

- [x] **Step 2: Measure the actual AGC1 serving path**

For each corpus capture, record an `agc1Serving` measurement produced by
`formatMcpEnvelope` with explicit compact format. For eligible successful
tools, assert its parsed payload decodes through `decodeCompactMcpEnvelope` to
the normalized v1 envelope and its exact serialized tokens/bytes agree with
the frozen AGC1 reference. Mark errors and non-compact tools as explicit,
non-comparable fallbacks rather than silently treating JSON as AGC1.

- [x] **Step 3: Make regression evidence useful**

Report serving AGC1 separately from the frozen reference, including
equivalence failures and fallbacks. Keep candidate comparisons against the
serving AGC1 baseline. Add focused tests for compact, auto, JSON, malformed,
and unsupported/error behavior so an AGC1 refactor cannot change the baseline
without a clear failure.

- [x] **Step 4: Verify and checkpoint**

Run:

```bash
pnpm exec vitest run tests/compact-mcp.test.ts tests/compact-output-benchmark.test.ts
pnpm exec vitest run tests/compact-output-fixtures.test.ts
pnpm bench:compact-output-matrix -- --summary
pnpm type-lint
pnpm check:version-bump
git diff --check
```

Expected: all tests and checks exit `0`; full output documents exactly which
captures are AGC1-comparable and confirms serving/reference equality.

- [x] **Step 5: Commit checkpoint**

Run:

```bash
git add scripts/measure-compact-output-matrix.mjs tests/compact-output-benchmark.test.ts tests/compact-mcp.test.ts docs/guides/performance.md specs pointer.md package.json
pnpm check:version-bump
git commit -m "test: measure serving agc1 compact baseline"
```

Expected: version policy passes before commit. The required alpha increment
tracks the harness change; it does not select or release AGC2.

## Task 2: Resume Candidate Research Only After the Baseline Is Green

**Files:**
- Modify: `src/compact-mcp-candidates.ts`
- Modify: `tests/compact-output-benchmark.test.ts`
- Modify: `specs/architecture/adrs.md` only if the selection rule changes

- [x] **Step 1: State one falsifiable candidate hypothesis**

Describe a new lossless textual candidate and why it might beat measured AGC1
on an identified subset without regressing the remaining representative
captures. Do not relabel it as AGC3: AGC2 has not been adopted.

Candidate F is `agc2-alias-symbols`: remove only provably duplicated symbol
fields, intern the shared path prefix and small enums, and emit nothing unless
it beats AGC1 by exact tokens. Its focused evidence is in
[`agc2-alias-symbols-research-2026-07-26.md`](../../../docs/reviews/agc2-alias-symbols-research-2026-07-26.md).

- [x] **Step 2: Implement in the non-serving lab**

Add its codec, decoder, adversarial cases, and matrix entry. It must refuse
unsupported shapes explicitly and preserve all values exactly.

- [x] **Step 3: Select strictly by ADR-010**

Keep the candidate non-serving unless complete-corpus evidence proves at least
15% weighted exact-token savings versus serving AGC1, no representative
regression, and the existing per-response auto threshold.

Result: retain AGC1. Candidate F saves 30.39% across its two accepted broad
symbol captures, but refuses six of eight successful symbol captures and does
not encode file trees or outlines. It is not representative replacement
evidence.

- [x] **Step 4: Verify and checkpoint**

Run the Task 1 verification commands plus candidate-specific round-trip tests,
then `pnpm build` and `pnpm test:package-bin` before any production-selection
commit. If the gate fails, retain AGC1 and record the rejection.

## Deferred Follow-up: Expand Beyond Narrow Results

**Files:**
- Modify: `src/compact-mcp-candidates.ts`
- Modify: `tests/compact-output-benchmark.test.ts`
- Modify: `scripts/measure-compact-output-matrix.mjs`
- Modify: `docs/reviews/agc2-*.md`

- [x] **Step 1: Establish representative coverage before selection**

Design the next candidate to cover the complete retained compact-tool contract
(`search_symbols`, `get_file_tree`, and `get_file_outline`) or write a new,
explicitly approved mixed-format contract with its own gate. Do not use
data-dependent refusal to turn only two unusually repetitive responses into a
production-selection claim. The completed research established that neither
candidate satisfies this condition, so no production selection is authorized.

- [x] **Step 2: Prove or reject it on the full corpus**

Require lossless decoding, malformed-input coverage, an AGC1 serving baseline
match, at least 15% weighted exact-token savings, and no representative
regression. Update the research decision with the full coverage count and
leave serving output untouched unless every gate passes. This cycle rejected
production adoption; any future all-tool codec needs a new selected epic.
