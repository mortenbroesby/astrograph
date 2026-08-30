# Session-Aware Agent Efficiency Epic

> **Status:** Closed — all selected Stories 1–7 merged in PR #99 on
> 2026-07-26.
>
> **Inspiration:** CodeDrift's emphasis on session-aware reads, composed
> context, observable agent efficiency, and privacy controls. This is a
> clean-room product plan: adopt only outcomes that beat Astrograph's existing
> local, deterministic retrieval primitives.

**Goal:** Reduce repeated agent context safely and measurably, while retaining
complete, attributable source retrieval and Astrograph's local-first model.

**Architecture:** Start with a trace benchmark, then add only the smallest
independently useful capability that it justifies. A session is an explicitly
scoped, bounded, client-provided identifier; it is never inferred from
arbitrary agent transcripts. Existing retrieval remains the source of truth. A
delta is an optional representation of a previously returned, content-addressed
payload and must always have an exact full-payload fallback.

**Tech Stack:** TypeScript, Node.js 22 LTS, existing SQLite/retrieval and MCP
contracts, Vitest, the existing tokenizer benchmark tooling, and deterministic
JSON/AGC1 output. No network service, embedding store, background daemon, or
large local ML model is in scope.

---

## Selection rules

This epic is deliberately evidence-first. Do not start a later story merely
because its design is attractive.

- Establish the corpus and repeat-read trace baseline before changing a public
  MCP response.
- Measure exact `cl100k_base` tokens, bytes, latency, correctness, and bounded
  storage; report the command, commit, fixture, and result in the checklist.
- A proposed representation must recover the exact canonical response and
  retain source provenance. A client that lacks session/delta support receives
  the existing full response.
- Select an implementation only when it improves at least two representative
  repeat-read traces with no correctness, privacy, or ordinary one-shot-query
  regression. Set a numeric launch target after the baseline—not beforehand.
- Reuse `get_task_context`, source/symbol retrieval, outlines, and lexical
  search before adding a composition surface. A new tool needs proof that an
  existing composition cannot meet the stated task and token budget.
- The current serving compact-output contract remains JSON plus AGC1. AGC2 or
  any replacement compact format needs its own losslessness and weighted-token
  gate; it is not smuggled in through this epic.

## Story map

| Order | Story | Depends on | Selection evidence |
| --- | --- | --- | --- |
| 1 | Repeat-read trace and benchmark foundation | Existing compact-output fixtures | Reproducible baseline across four repository shapes and ordinary/repeated reads. |
| 2 | Explicit session and content-reference contract | Story 1 | Selected by the user; preserve the full-response fallback and bounded local state. |
| 3 | Optional exact delta responses | Stories 1–2 | Selected by the user; exact-reference reuse first, with full fallback. |
| 4 | Bounded task dossier composition | Story 1 | Consolidated by explicit user selection; audit existing composition first. |
| 5 | Privacy-safe Astrograph report | Story 1 | Consolidated by explicit user selection; opt-in JSON only. |
| 6 | Explicit cross-session bookmarks | Stories 1, 4 | Consolidated by explicit user selection; explicit repository-local records only. |
| 7 | Configurable privacy-output policy | Story 5 | Consolidated by explicit user selection; deterministic policy only. |

## Story 1: Repeat-read trace and benchmark foundation

**Outcome:** A future change can be judged against real agent-read patterns,
not a synthetic one-response token count.

**Scope:** Extend the current compact-output benchmark fixtures with a small
front-end repository, a front-end plus C#/Java/Kotlin monorepo, a single
repository with deliberately unused code, and a text-heavy repository. Add
trace manifests for one-shot exploration and repeated source/symbol/context
reads. Capture canonical response bytes, exact tokenizer counts, latency, and
the recovery/correctness oracle. Keep the harness offline and deterministic.

**Expected files:** `bench/`, `tests/compact-mcp*.test.ts`,
`src/compact-mcp.ts`, `docs/guides/performance.md`, and a dedicated fixture
directory under `tests/fixtures/`. Confirm exact paths after auditing the
current harness; do not create a second benchmark framework.

**Acceptance evidence:** A documented command emits machine-readable results
for each fixture and trace, with a checked test proving fixture determinism.
The report separates raw source tokens, canonical JSON/AGC1 envelope tokens,
and any candidate representation. It contains no source content by default.

**Initial baseline (2026-07-26):** `pnpm bench:agc1-compact-output --
--summary` at `f6f175b` on the four deterministic fixtures emitted 32 captures
in eight traces. All 16 AGC1-eligible captures recovered exactly. Canonical
JSON totaled 23,519 `cl100k_base` tokens; AGC1 totaled 5,272 for eligible
captures. This validates the harness only; it does not yet establish that a
stateful session feature has material user benefit.

## Story 2: Explicit session and content-reference contract

**Status:** Complete — merged in PR #97 as `0.9.0-alpha.180`.

**Outcome:** A capable client may say which content-addressed responses it
already has; Astrograph can decline safely and return the canonical full
response.

**Scope:** Design a small additive MCP capability negotiation and an opaque
client-generated session identifier with a bounded lifetime, count, and byte
budget. Persist only references and hashes needed for the selected process or
storage scope—never agent prompts, arbitrary conversation logs, or unbounded
source copies. Define restart, cache invalidation, malformed input, and
concurrent-client behavior before implementation.

**Acceptance evidence:** Contract tests prove unknown/missing/expired session
state produces the unchanged full response; an explicit capability is required
before any abbreviated result; state limits are observable without leaking
source; and all successful references bind to source identity/version.

## Story 3: Optional exact delta responses

**Status:** Complete — exact references were selected over a general patch
format; see the [consolidated delivery checklist](../active/session-aware-epic-completion-delivery-checklist.md).

**Outcome:** Repeat reads can return a smaller lossless patch only when both
client and server prove they share the same base response.

**Scope:** Compare a simple deterministic choice—full JSON versus a standard
structured patch or line diff—using Story 1 traces. Prefer an existing small
dependency or standard representation over a custom codec. Include a reason
field when falling back to full response. Do not apply deltas server-side to
unverified bases.

**Acceptance evidence:** Fixture/property tests reconstruct byte-equivalent
canonical responses for changed, unchanged, reordered, truncated, stale,
malformed, and unknown-base cases. Benchmark results satisfy the selection
rules and show the complete fallback cost.

**Evidence (2026-07-26):** The four-fixture, 32-capture benchmark produced two
exact references in each repeat-read trace, preserved all 16 eligible AGC1
round trips, and reduced delivered JSON by 6,812 of 24,614 canonical
`cl100k_base` tokens (27.7%). Exact references retain the existing full
fallback, so no general patch representation is justified.

## Story 4: Bounded task dossier composition

**Status:** Complete by audit — the existing `get_task_context` is the bounded
composition surface; no duplicate dossier tool was added.

**Outcome:** An agent can request a deterministic dossier—definition, selected
callers/importers/tests, and provenance—only when that is demonstrably better
than composing existing tools.

**Scope:** Audit `get_task_context`, symbol source, lexical search, outline,
and tree results first. If still justified, add one budgeted composition path
with explicit inclusions, exclusions, token accounting, and source anchors.
Git history is optional and local-only; it is not a default dependency.

**Acceptance evidence:** A pinned task corpus proves relevance and token
budget improvement versus the best current tool composition. Every omitted
item has a deterministic explanation, and a user can reproduce the dossier
from its declared inputs.

**Audit evidence (2026-07-26):** `get_task_context` already has explicit
anchors/queries, the four requested intents, deterministic anchor/match/relation
ordering, a token budget, exclusions, and source provenance. The existing
engine behavior suite pins all four intents plus bounded, attributed selection.
It is therefore the minimum composition surface.

## Story 5: Privacy-safe Astrograph report

**Status:** Complete — explicit local JSON aggregate report only.

**Outcome:** Developers can see whether Astrograph is saving context in a
useful way without collecting their source or agent conversations.

**Scope:** Begin with a local JSON report derived from existing event/token
telemetry: operation class, canonical/candidate token totals, fallback rate,
latency bands, and limits reached. Make report collection opt-in and aggregate
only. A dashboard is explicitly deferred until the JSON report proves demand.

**Acceptance evidence:** Tests prove default operation emits no report and an
enabled report contains no source text, prompt text, file content, or raw
queries. Documentation states retention, reset, and privacy boundaries.

## Story 6: Explicit cross-session bookmarks

**Status:** Complete — explicit repository-local symbol bookmarks only.

**Outcome:** A user or agent may intentionally save a small set of task/symbol
references for a later session without hidden transcript mining.

**Scope:** Evaluate a portable, repository-local bookmark record containing
intent, stable source identities, and optional notes with explicit retention
and deletion. Do not add embeddings, automatic memories, or cross-repository
search in the first version.

**Acceptance evidence:** A repeat-task trace demonstrates a useful recall
improvement; stale/renamed/deleted source resolves safely; the user can inspect
and delete every saved record; and no bookmark is created implicitly.

## Story 7: Configurable privacy-output policy

**Status:** Complete — narrow deterministic redaction is off by default and
explicitly marked when applied.

**Outcome:** Teams with stricter output rules can opt into a predictable local
policy without silently altering source truth for everyone else.

**Scope:** Write a threat model and fixture matrix before implementation. Start
with narrow, deterministic patterns and explicit reporting of transformed or
withheld fields. Do not bundle a large ML/crypto package, scan arbitrary files,
or claim complete secret detection.

**Acceptance evidence:** The opt-in policy is off by default, deterministic,
tested against false-positive/false-negative fixtures, and never causes an
unmarked lossy response. The normal source-retrieval contract remains intact.

## Out of scope

- AGC2 or a serving-format replacement.
- A shared mutable index, cross-repository source search, network sync, or
  hidden source upload.
- Background daemons, automatic transcript ingestion, and opaque agent memory.
- A browser dashboard before the local JSON report has demonstrated demand.
- Large local ML models or cryptography added only for speculative redaction.

## Closure evidence

PR #99 merged as `cc7ae6c`. The four-fixture trace benchmark measured 6,812
of 24,614 canonical JSON `cl100k_base` tokens saved by exact references
(27.7%), with all 16 eligible AGC1 round trips exact. The resulting local
report, explicit bookmarks, and optional marked output redaction remain
local-first and source-free. Future analytics work is separately tracked by
the Local Token-Savings Analytics focus; it does not reopen this epic.
