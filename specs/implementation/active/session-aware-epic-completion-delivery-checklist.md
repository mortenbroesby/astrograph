# Session-Aware Agent Efficiency Epic Completion Checklist

> **Status:** Active — one consolidated PR for the remaining Stories 3–7,
> explicitly selected by the user on 2026-07-26.

**Goal:** Complete the remaining agent-efficiency outcomes in one reviewable
branch while preserving local-first behavior, explicit consent, and exact
full-response fallback.

**Architecture:** Finish exact-reference benchmark evidence first; then reuse
existing retrieval primitives unless the dossier audit proves a gap. All durable
state is repository-local and explicitly created; telemetry is opt-in,
aggregate, and source-free; output redaction is opt-in and visibly lossy. No
network service, daemon expansion, automatic transcript ingestion, embedding
store, or source upload is allowed in this PR.

**Tech Stack:** TypeScript, Node.js 22, existing MCP/CLI/SQLite/event sink,
native SHA-256, Vitest, and `cl100k_base` benchmark tooling. No dependencies
unless a concrete implementation step proves native facilities insufficient.

## Task 1: Close Story 3 with measured exact-reference evidence

**Files:** `scripts/measure-agc1-compact-output-matrix.mjs`,
`tests/compact-output-traces.test.ts`, `docs/guides/performance.md`,
`specs/implementation/planned/8_session-aware-agent-efficiency-epic.md`

- [x] Measure full versus reference-only repeated reads on all four fixtures.
- [x] Prove exact reconstruction plus full fallback for changed, malformed,
  unknown, and error cases.
- [x] Record whether a general patch format is justified; do not add one unless
  the benchmark beats exact-reference reuse materially.

**Result (2026-07-26):** `pnpm bench:agc1-compact-output -- --summary`
emitted 32 captures: every repeat-read trace returned two exact references,
all 16 AGC1-eligible reconstructions were exact, and references saved 6,812 of
24,614 canonical JSON `cl100k_base` tokens (27.7%). Existing malformed,
unknown, changed, and error fallback tests remain the contract. A general patch
format is not selected: exact content identity already exceeds the selection
rule without another client-side reconstruction format.

## Task 2: Story 4 dossier audit and minimum composition surface

**Files:** `src/command-registry.ts`, `src/mcp-contract.ts`, `src/mcp.ts`,
`src/index.ts`, `tests/*task-context*.test.ts`, `specs/api-design/mcp-tools.md`

- [x] Compare the best existing composition (`get_task_context`, symbol source,
  search, outline/tree) against pinned exploration/refactor/debug tasks.
- [x] Add one deterministic budgeted dossier only if that audit proves a gap;
  otherwise document existing composition as the delivered outcome.
- [x] Preserve provenance, token accounting, and deterministic exclusions.

**Audit result (2026-07-26):** No additional dossier tool is justified.
`get_task_context` already accepts explicit anchors or a query, covers explore,
debug, refactor, and audit intents, orders anchors/matches/relations
deterministically, bounds the payload, reports exclusions, and attaches exact
source provenance. `tests/engine-behavior.test.ts` pins those four intent
paths, source attribution, relation selection, and budget behavior. Adding a
second composition API would only duplicate the existing contract.

## Task 3: Story 5 opt-in local efficiency report

**Files:** existing event/token telemetry seam, CLI surface, focused tests,
`docs/guides/performance.md`

- [x] Add a JSON-first, opt-in aggregate report with operation class, token
  totals, reference/full fallback counts, and latency bands.
- [x] Guarantee no source, prompt, path, raw query, or session ID is emitted.
- [x] Document retention/reset; do not build a dashboard.

**Delivered (2026-07-26):** `astrograph efficiency-report --repo /abs/repo`
is an explicit JSON-only read of retained local MCP completion aggregates.
`--reset --yes` is the explicit repository-local reset. The report has no
source, prompt, path, query, or session fields.

## Task 4: Story 6 explicit repository-local bookmarks

**Files:** bookmark storage/API/CLI implementation and focused tests,
`specs/api-design/`, `docs/`

- [x] Add inspectable, explicitly created/deleted references to stable source
  identities and optional user notes.
- [x] Safely resolve stale, renamed, and deleted sources.
- [x] Do not create automatic memories, embeddings, or cross-repository search.

**Delivered (2026-07-26):** `bookmark-add`, `bookmark-list`,
`bookmark-resolve`, and `bookmark-remove` persist only explicit repository-local
symbol IDs, intent, optional note, and creation time. Resolve is source-free
and reports renamed/deleted/stale identities as `missing`.

## Task 5: Story 7 opt-in privacy-output policy

**Files:** output-policy module/config, focused fixtures/tests,
`specs/api-design/`, docs

- [x] Write and test narrow deterministic redaction patterns with explicit
  transformed/withheld markers.
- [x] Keep the policy off by default and the normal source contract intact.
- [x] Do not claim complete secret detection or add ML/crypto packages.

**Delivered (2026-07-26):** `outputPrivacy.redactSecretLikeValues` is off by
default. When explicitly enabled, known secret-like strings are replaced with
`[REDACTED:secret]` and the MCP response has an explicit warning. It is narrow,
deterministic, and not a claim of complete secret detection.

## Final verification

```bash
pnpm type-lint
pnpm build
pnpm test:package-bin
pnpm check:version-bump
git diff --check
```

Run focused tests and the benchmark for each task before this final gate.
