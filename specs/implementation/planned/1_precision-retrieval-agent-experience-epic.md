# Precision Retrieval and Agent Experience Epic

> **Status:** Active — Story 7 (Incremental Freshness Lifecycle) is selected
> through its [delivery checklist](../active/7_incremental-freshness-lifecycle-delivery-checklist.md).
> Stories 1–3, 5, and 6 are closed. Story 4 is the required token-efficient
> output end-cap after Story 7; later stories require their own evidence gates.
>
> **Inspiration, not a cloning target:** jCodeMunch demonstrates useful patterns—tree-sitter structure, persistent lexical search, byte-accurate slices, optional semantics, compact results, and polished setup. Astrograph will retain a small deterministic local-first surface, not copy a 90-tool catalog or unverified marketing claims.

**Vision:** A human or agent can install Astrograph quickly, orient in an unfamiliar repository through a small discovery-first surface, retrieve minimal trustworthy source for a task, and see why it was selected and whether it is fresh.

**Goal:** Incrementally strengthen structural retrieval, ranking, bounded context, compact transport, onboarding, freshness, and measurement. Build deterministic lexical value before considering vectors.

**Architecture:** SQLite remains local durable storage, tree-sitter remains the parser, and checkout-aware artifacts remain the source of truth. Stable symbol identities, content hashes, and exact ranges support an FTS/BM25-style lexical layer and token-budgeted assembler. Semantic scoring is optional, explicitly configured, and never requires a separate always-on vector service.

**Tech Stack:** TypeScript, Node.js 22, SQLite/FTS5, tree-sitter, Vitest, pnpm, MCP stdio, Git, and optional local/provider embeddings.

## Delivery Integrity and Epic Closure Rule

This epic is **not ready to close**. Its completed Munch-inspired product
stories are already merged into `main`, while Story 7 remains the sole active
implementation goal. Do not describe the epic as delivered, or move it to
closed records, until its selected remaining work has merged source, tests, and
user-facing contract documentation to `main` with exact-head verification—or
has been explicitly parked or descoped with a recorded evidence gate.

| Story | Delivery state | Mainline evidence |
| --- | --- | --- |
| 1–2: provenance and lexical ranking | Complete | PR #26, merge `32248d3` |
| 3: token-budgeted task context | Complete | PR #34, merge `b5837a7` |
| 4: token-efficient agent output | Required end-cap | Must deliver measured compact or otherwise token-efficient agent-visible output before epic closure |
| 5: small MCP core | Complete | PR #39, merge `54971f6` |
| 6: onboarding packs | Complete | PR #70, merge `45cbc63` |
| 7: incremental freshness lifecycle | Active | [active delivery checklist](../active/7_incremental-freshness-lifecycle-delivery-checklist.md) |
| 8–10: semantic, reporting, internal serialization | Planned or parked | Their individual evidence gates remain authoritative |

**Definition of done:** every selected story has a closed checklist linking to
its merged `main` commit, exact-head checks, and any required package/contract
evidence; `pointer.md`, the roadmap, this epic, and the closed-record index are
merged to `main` in the same transition. Before the epic closes, Story 4 must
also deliver a measured compact or otherwise token-efficient **agent-visible
output** on `main`; recording that compact output was not worthwhile is not a
substitute for an end-user token-efficiency result. Future stories that do not
pass their selection gates must be explicitly parked or descoped rather than
silently treated as delivered.

## Principles and Evidence Gates

- Separate payload-token reduction, task quality, latency, indexing cost, and end-to-end model spend. One cannot prove another.
- Default to deterministic local retrieval. Any remote embedding source is explicit opt-in and source-private by default.
- A new MCP tool needs a distinct intent that existing primitives cannot compose.
- Every story starts with its own delivery checklist: exact files, baseline output, smallest steps, focused tests, version decision, final checks, review, and merge evidence.
- Public value claims require a pinned corpus/task manifest, tokenizer version, raw tool payloads, judged relevance, cold/warm/delta latency, and documented baselines.

## Story 1 — Provenance-First Symbol Contract

**Status:** Complete — public source/symbol results expose UTF-8 byte ranges
and `get_symbol_source` returns verifiable source provenance. See the closed
[delivery checklist](../closed/provenance-first-symbol-contract-delivery-checklist.md).
PR #26's Fast and Windows CI passed for final exact head `edeab45`.

**Vision:** A symbol is a verifiable address into one exact source version.

**Goal:** Define stable IDs, canonical relative paths, byte/line ranges, source hashes, parser provenance, and freshness on source/symbol results.

**Likely files:** `src/parser/**`, `src/file-analysis.ts`, `src/storage.ts`, `src/retrieval.ts`, `src/types/**`, `src/serialization.ts`, API specs, parser/retrieval tests.

- [x] Baseline `tests/engine-contract.test.ts` and `tests/interface.test.ts`; record current IDs/ranges.
- [x] Specify ID components, UTF-8/CRLF range semantics, hash behavior, separator rules, fallback-parser behavior, and edited-file behavior.
- [x] Add fixtures for duplicate names, nested symbols, Unicode, CRLF, renamed files, fallback parsing, and Windows paths.
- [x] Return additive provenance: ID, canonical path, range, source hash, parser backend, freshness state.
- [x] Prove exact retrieval never slices content different from its recorded hash.
- [x] Focused tests, `pnpm type-lint`, `pnpm check:version-bump`, diff check, commit/push/review/merge.

**Acceptance evidence:** Consumers can independently verify every returned slice’s identity, range, hash, and freshness.

## Story 2 — Deterministic Lexical Ranking

**Status:** Complete — the judged fixture and deterministic BM25 ranking
contract merged as PR #26. See the closed
[delivery checklist](../closed/deterministic-lexical-ranking-delivery-checklist.md).

**Vision:** Natural-language and name queries find the right symbols without a network dependency.

**Goal:** Add deterministic BM25-style ranking over names, qualified names, signatures, summaries, paths, and selected imports; preserve filters as hard constraints.

**Likely files:** `src/retrieval.ts`, `src/storage-schema.ts`, `src/storage-queries.ts`, `src/ranking/**` (new), `src/config.ts`, retrieval tests.

- [x] Create a judged query fixture: exact, acronym, natural-language, path-scoped, no-result.
- [x] Decide FTS5 versus in-memory inverted index; document tokenizer, weights, k1/b, tie-breaks, and incremental update lifecycle.
- [x] Implement deterministic scoring with exact lookup/filter precedence.
- [x] Add requested-only ranking explanation fields; avoid default payload growth.
- [x] Measure precision@k, MRR, zero-result rate, warm latency, and index-size delta against baseline.
- [x] Focused ranking tests, type/version/diff checks, benchmark run, commit/push/review/merge.

**Acceptance evidence:** Same corpus/query always yields the same ranked result with recorded quality and latency.

## Story 3 — Token-Budgeted Task Context

**Status:** Complete — merged as PR #34 after exact-head Fast and Windows
compatibility/package-smoke CI passed. See the closed
[delivery checklist](../closed/token-budgeted-task-context-delivery-checklist.md).
The recorded baseline justified consolidating the three current paths; Story 4
compact transport remains deferred until a separately measured need justifies
it.

**Vision:** One bounded request assembles coherent task context rather than broad file dumps.

**Goal:** Evolve current context/ranked-context behavior into one source-attributed assembler with declared token budget.

**Likely files:** `src/retrieval.ts`, command/MCP contracts, tokenizer, CLI/MCP docs, interface tests.

- [x] Inventory existing context tools and replace them with one direct contract; no compatibility aliases remain.
- [x] Specify task/query, optional anchors, intent hint, budget/depth; output selected source, provenance, exclusions, truncation, actual tokens.
- [x] Select deterministically: anchors → lexical matches → required relations → budget-aware expansion.
- [x] Enforce the serialized agent-visible token limit, rejecting an envelope that cannot fit the declared budget.
- [x] Test exploration/debug/refactor/audit fixtures for relevance, deduplication, provenance, and budget compliance.
- [x] Keep initial intent classification rules-based and explainable.
- [x] Verify MCP/CLI parity, type/version/diff, commit/push/review/merge as PR #34 (`b5837a7`).

**Acceptance evidence:** A single request returns source-attributed task context inside its stated budget.

## Story 4 — Token-Efficient Agent Output

**Status:** Required end-cap — do not start it ahead of Story 7, but do not
close this epic until it produces a measured compact or otherwise
token-efficient agent-visible output on `main`. Compact, versioned JSON remains
the preferred candidate. The baseline must still establish repeatable material
savings before choosing its exact envelope; if it is unsuitable, select another
inspectable, lossless agent-visible output reduction rather than declaring the
epic complete without one. See the [ingested assessment](../../../docs/reviews/compact-output-vs-internal-serialization-2026-07-22.md).

**Vision:** Retrieval saves tokens in selection and in response encoding.

**Goal:** Deliver an opt-in, versioned compact *JSON* response format for
selected repetitive MCP result shapes—or a proven equivalent agent-visible
token-efficiency result—while ordinary JSON remains default and fail-open. This
is the agent-facing successor to token-budgeted retrieval; it is not a binary
transport change.

**Likely files:** `src/serialization.ts`, `src/mcp.ts`, `src/mcp-contract.ts`,
`src/types/**`, MCP/CLI contracts, API docs, benchmarks, and
serialization/interface tests.

- [ ] Capture raw successful, empty, error, and provenance-heavy *agent-visible*
  envelopes for `search_symbols`, `get_file_tree`, `get_file_outline`, and a
  bounded `get_task_context`; measure bytes, the declared tokenizer count,
  readability, and encode/decode latency.
- [ ] Benchmark a deterministic table/path-interned draft against the current
  pretty JSON envelope. Set any `auto` savings threshold from that evidence;
  do not assume 15% or another fixed value in advance.
- [ ] Write an ADR and public contract decision before enabling the selected
  token-efficient output: current MCP v1 explicitly disables compact schema
  variants. Specify selected tools, `format=json|compact|auto` when compact
  JSON wins, versioned envelope, reference decoder, JSON fallback, and
  `get_task_context` budget accounting in each format.
- [ ] Implement the selected agent-visible token-efficiency result for only the
  measured tools; preserve default JSON, strict v1 errors, and inspectable
  fail-open behavior.
- [ ] Add reference decode/round-trip tests for Unicode, errors, nested provenance.
- [ ] Report format selection, bytes, agent-visible token savings, and
  encode/decode latency separately from retrieval and source-token savings.
- [ ] Verify contracts/type/version/diff, commit/push/review/merge.

**Acceptance evidence:** The selected agent-visible output round-trips or
otherwise preserves the public contract, has reproducible token savings for the
measured tools, and is merged to `main` before this epic can close.

## Story 5 — Small MCP Core and Guided Routing

**Status:** Complete — PR #39 corrected generated Codex/Copilot tool visibility,
documented the core/specialized policy, and recorded the 1,520-token full-schema
baseline. The audit found 14 distinct direct tools, so no generic router,
hidden tier, or tool removal was justified. See the
[closed checklist](../closed/mcp-tool-surface-core-delivery-checklist.md) and
[audit](../../../docs/reviews/mcp-tool-surface-audit-2026-07-22.md).

**Vision:** Agents see a small, self-explanatory discovery-first surface.

**Goal:** Define core versus advanced MCP tools and concise guidance without introducing a giant router.

**Likely files:** MCP contract/server, command registry, install guidance, API specs, MCP tests.

- [x] Audit tool intents, overlap, schema size, and composition.
- [x] Declare the preferred core workflow and justify specialized tools.
- [x] Keep direct discovery in concise policy/guidance rather than add a router
  or second tool catalog.
- [x] Document preferred next primitives and “do not use when” guidance.
- [x] Test policy-aligned generated configuration and MCP/CLI contract coverage.
- [x] Measure schema tokens; merge the targeted configuration correction with
  exact-head Fast and Windows/package-smoke CI evidence.

**Acceptance evidence:** A new agent can discover the supported retrieval flow from the stable core.

## Story 6 — Human and Agent Onboarding Packs

**Status:** Complete — merged as PR #70 and published as
`astrograph@0.5.1-alpha.160`; see the closed
[delivery checklist](../closed/human-agent-onboarding-packs-delivery-checklist.md).

**Vision:** Setup, validation, and recovery require no internal command knowledge.

**Goal:** Make `astrograph init` an inspectable idempotent setup path with client/terminal starter packs.

**Likely files:** installer, package bin, README, getting-started/troubleshooting docs, installer tests.

- [ ] Map current setup for Codex/Copilot/Copilot CLI, PowerShell/cmd/Git Bash, and non-Git folders.
- [ ] Complete `init --dry-run`, idempotent `--yes`, explicit clients, and machine-readable proposed-write evidence.
- [ ] Generate concise agent guidance for discovery, budgets, freshness, and safe fallback.
- [ ] Add starter configurations and a packed-package end-to-end setup smoke.
- [ ] Test repeats, conflicts, and write failure recovery; retain scoped writes.
- [ ] Verify Linux + existing Windows gate, version checks, commit/push/review/merge.

**Acceptance evidence:** Clean setup and dry-run both produce clear evidence of a working MCP configuration.

## Story 7 — Incremental Freshness Lifecycle

**Vision:** Exact retrieval remains correct after edits without mandatory full reindex.

**Goal:** Unite content-hash deltas, checkout mapping, watch fallback, and freshness diagnostics.

**Likely files:** storage/index refresh/watch/Git/diagnostics modules; watch and engine tests.

- [ ] Benchmark cold, no-op, edit, rename, delete, worktree switch, unavailable Git, and watcher fallback.
- [ ] Define invalidation keys: canonical path, content hash, parser/config/artifact version, checkout identity.
- [ ] Update only affected symbols/dependencies and provenance/freshness.
- [ ] Report safe fallback reason; never silently claim fresh after probe failure.
- [ ] Emit privacy-safe delta metrics (reused/parsed files, symbols, time).
- [ ] Prove Unix/Windows behavior with spaces and separator cases; commit/push/review/merge.

**Acceptance evidence:** Responses identify known freshness and no-op/delta behavior is measurably cheaper without weaker correctness.

## Story 8 — Optional Semantic/Hybrid Retrieval

**Vision:** Semantics helps ambiguous queries without making local use paid, slow, or opaque.

**Goal:** Add semantic scoring only after lexical evidence shows a judged quality gap.

**Likely files:** `src/embeddings/**` (new), retrieval/config/schema/docs/tests/benchmarks.

- [ ] Set a quality/latency/privacy evidence gate before implementation.
- [ ] Define disabled default, local-first options, explicit remote opt-in, key handling, and no hidden source upload.
- [ ] Store model/version/content-hash keyed embeddings in SQLite; precise invalidation.
- [ ] Start bounded brute-force cosine only if benchmarks support it; add ANN only when corpus scale requires it.
- [ ] Implement explainable hybrid weights/RRF, lexical fallback, timeouts, and provider diagnostics.
- [ ] Compare lexical/semantic/hybrid on judged corpus; privacy + regression tests; commit/push/review/merge.

**Acceptance evidence:** Semantic is optional and demonstrably improves defined queries with no undisclosed privacy cost.

## Story 9 — Honest Benchmark and Reporting

**Vision:** Astrograph value claims are modest, reproducible, and actionable.

**Goal:** Ship a harness separating payload tokens, relevance, latency, index cost, and optional end-to-end outcomes.

**Likely files:** `bench/**`, performance docs, scripts, manual/path-scoped CI only with cost approval.

- [ ] Pin corpus revisions, tokenizer/model versions, tasks, expected anchors, cache state, and baselines.
- [ ] Record raw calls, bytes/tokens, top-k quality, cold/warm/delta latency, storage, memory, failures.
- [ ] Label targeted-file and full-source baselines honestly; never call either universal agent behavior.
- [ ] Add end-to-end model tests only with fixed model/prompt/retry/pricing and variance reporting.
- [ ] Publish commands/artifacts with source/secret redaction; avoid unauditable global counters.
- [ ] Keep full benchmarks manual and cost-scoped; CI verifies a small deterministic fixture.

**Acceptance evidence:** A contributor reruns documented commands and gets comparable raw metrics.

## Story 10 — Internal Artifact Serialization Efficiency

**Status:** Parked — MessagePack is an internal-performance research candidate,
not an MCP response format or an active implementation commitment. See the
[ingested assessment](../../../docs/reviews/compact-output-vs-internal-serialization-2026-07-22.md).

**Vision:** Internal persistence is efficient where measurements prove JSON
serialization is a material cost, while developer inspection remains practical.

**Goal:** Measure and, only if justified, improve the internal
`analysis_artifacts` persistence boundary. MessagePack is one candidate beside
deduplicated JSON/layout; it is never a default replacement for agent-facing
MCP JSON.

**Likely files:** `src/storage-schema.ts`, `src/storage.ts`,
`src/incremental-cache.ts`, `tests/incremental-cache.test.ts`, targeted
benchmarks, and cache/diagnostic docs.

- [ ] Measure artifact-row bytes, SQLite size, warm-cache load time,
  serialization CPU, and memory for current JSON fields.
- [ ] First investigate whether duplicated artifact fields can be removed or
  restructured without a binary format.
- [ ] Compare current JSON, a debuplicated JSON/layout alternative, and
  MessagePack only at `analysis_artifacts`; retain JSON debug tooling.
- [ ] Select MessagePack only if a documented size/latency threshold is met and
  cache-version discard/rebuild behavior remains safe before v1.
- [ ] Do not apply this story to worker IPC, sync, background transport, or MCP
  output without an existing measured boundary and a separate decision.

**Acceptance evidence:** A reproducible benchmark shows a material internal
gain with no public MCP-format change and no loss of normal debugging ability.

## Order and Completion

Order: 1 → 2 → 3; Story 7 can start after Story 1; then 5 → 6 → 7 → 4 → 9 → 10; Story 8 only after Stories 2 and 9 prove it is justified. Story 4 is the required token-efficient end-cap before epic closure. A blocked story records owner/evidence/retry condition and defers behind independent work.

- [ ] Provenance/freshness is a stable retrieval contract.
- [ ] Lexical ranking and bounded context are deterministic and measured.
- [ ] MCP core, onboarding, compact transport, and refresh are verified.
- [ ] Semantic is optional and evidence-led.
- [ ] Benchmarks separate payload, quality, latency, and end-to-end claims.
