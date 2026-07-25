# AGC2 Encoding and Benchmark Redesign

**Status:** Deferred; not selected for implementation.

**Goal:** Replace the current per-tool compact-output experiments only if an
Astrograph-owned AGC2 format demonstrates material, reproducible exact-token
savings over both strict JSON and the AGC1 reference encoder across realistic
repository shapes.

**Architecture:** Treat compact output as a separately benchmarked transport
layer. Keep strict MCP JSON as the default and fail-open response. Use the
published MUNCH specification only as design research: its encoder IDs,
prefix-interning legends, typed rows, generic fallback, and measured fallback
gate inform Astrograph's own AGC2 design; Astrograph must not claim MUNCH wire
compatibility or copy its implementation. The benchmark owns fixture creation,
capture normalization, JSON/AGC1/AGC2 comparison, round-trip assertions, and
machine-readable results.

**Tech Stack:** TypeScript, Node 22+, `tiktoken`, Vitest, existing MCP
dispatcher, and deterministic generated fixture repositories.

## Design research inputs

- [MUNCH compact-output specification](https://github.com/jgravelle/jcodemunch-mcp/blob/main/SPEC_MUNCH.md): evaluate the *ideas* of encoder-specific
  schemas, path-prefix legends, typed rows, and a generic fallback.
- [MUNCH token-savings methodology](https://github.com/jgravelle/jcodemunch-mcp/blob/main/TOKEN_SAVINGS.md): adopt the discipline of representative
  per-tool reporting, not its byte-only metric or its wire format.

## Non-negotiable boundaries

- AGC2 remains Astrograph-owned UTF-8 text/JSON; do not emit `#MUNCH/` or
  advertise MUNCH compatibility.
- No binary transport, dependency download, daemon, hidden routing, or shared
  state.
- `format: "json"` is exact strict JSON. Errors remain strict JSON.
- `auto` may emit AGC2 only after measuring the actual normalized payload.
- A compact request must never silently return a format that cannot be decoded
  by Astrograph's reference decoder.
- Do not replace AGC1 in a release until the selection gate below passes.

## Fixture matrix

Fixtures are generated in-process, committed as source templates rather than
downloaded repositories, and use stable `/fixture/...` paths during capture.

| Fixture | Shape | Required languages/content | Why it matters |
| --- | --- | --- | --- |
| `small-frontend` | 8–12 files | React/TypeScript, CSS, package JSON, tests | Small and sparse responses reveal header/legend overhead and prove fall-open behavior. |
| `product-monorepo` | 60–100 files | React/TypeScript app, C#/.NET API, Java or Kotlin service, shared OpenAPI/config, tests | Repeated path roots and mixed schemas exercise prefix legends, typed fields, and cross-language result lists. |
| `text-heavy-workspace` | 25–40 files | Markdown docs, JSON/YAML configuration, generated-looking changelog and API text | Long previews and text results test quoting, Unicode, whitespace, and non-code payloads. |
| `dead-code-workspace` | 80–120 files | Active product paths plus duplicated/unreferenced TypeScript, C#, and Java code | Broad discovery and outline responses prove behavior with many low-value rows and repeated directories. |

Every fixture must have a small, medium, and broad query set covering:
`search_symbols`, `find_files`, `search_text`, `get_file_tree`,
`get_file_outline`, and one unsupported/error path. Captures must include empty
results, Unicode, quoted/CSV-sensitive text, mixed numeric/boolean fields, and
at least one truncated response.

## Candidate sequence

### Task 1: Establish the reusable harness

**Files:**
- Create: `tests/fixtures/compact-output/*`
- Create: `tests/compact-output-fixtures.test.ts`
- Create: `scripts/measure-compact-output-matrix.mjs`
- Modify: `package.json`

- [ ] Generate the four fixture families and index each with the real engine.
- [ ] Normalize temporary roots, timestamps, and nondeterministic IDs before
  serializing captures.
- [ ] Record one JSON baseline, one frozen AGC1 reference encoding, and every
  AGC2 candidate for each fixture/query pair.
- [ ] Emit a JSON report containing bytes, `cl100k_base` tokens, encode/decode
  latency, selected format, round-trip status, and failure reason.
- [ ] Add a `pnpm bench:compact-output-matrix` command whose output is stable
  enough for CI diffing.

### Task 2: Trial schema-oriented AGC2 candidates

**Files:**
- Modify: `src/compact-mcp.ts`
- Modify: `tests/compact-mcp.test.ts`
- Modify: `specs/api-design/compact-output-v2.md`

- [ ] Implement candidates behind non-serving benchmark selection only:
  1. packed fixed-width rows;
  2. encoder IDs with per-tool schemas;
  3. prefix legends for repeated paths;
  4. typed scalar/table rows; and
  5. a bounded generic homogeneous-row fallback.
- [ ] Compare each candidate with AGC1 and JSON for every matrix capture; do
  not promote a candidate because it wins on a single fixture.
- [ ] Keep the decoder total, strict, and fuzzed against malformed legends,
  escaped delimiters, unknown encoder IDs, row-width errors, and type coercion
  failures.

### Task 3: Select or reject AGC2

**Selection gate:** all conditions are required.

- [ ] AGC2 saves at least **15% weighted exact `cl100k_base` tokens versus
  AGC1** over successful migrated-tool captures across the complete matrix.
- [ ] No representative migrated capture is worse than AGC1; ties must return
  JSON in `auto` mode.
- [ ] AGC2 saves at least 20 tokens and 25% versus strict JSON for every
  capture selected by `auto`.
- [ ] All decoder round trips, malformed-input tests, MCP interface tests,
  package-bin smoke, and type checks pass.
- [ ] The report includes both aggregate and per-fixture results; do not hide
  low-performing small or text-heavy captures behind an average.

If the gate fails, retain AGC1/strict JSON and move this plan to parked with
the measured rejection report. If it passes, write the public AGC2 contract,
perform the storage/cache version decision independently, and create a source
release plan.

## Baseline and final verification

```bash
pnpm exec vitest run tests/compact-mcp.test.ts tests/compact-output-fixtures.test.ts tests/interface.test.ts
pnpm bench:compact-output-matrix
pnpm type-lint
pnpm build
pnpm test:package-bin
pnpm check:version-bump
git diff --check
```

Expected: every command exits `0`; the benchmark report proves or rejects the
selection gate with exact per-capture token counts.

## Commit checkpoint

After source changes, stage only the compact-output implementation, fixtures,
tests, benchmark script, public contract, and report updates. Run
`pnpm check:version-bump` immediately before the intentional commit. Do not
publish, tag, or merge based on benchmark claims without the complete matrix.
