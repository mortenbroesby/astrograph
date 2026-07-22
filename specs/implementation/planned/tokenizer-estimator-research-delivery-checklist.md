# Tokenizer and Token-Estimator Research Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](../active/high-impact-followups-epic.md), Story 10
>
> **Status:** Planned — research only. Do not replace `tiktoken`, `tokenx`, or
> any task-context contract until this checklist records a material benefit.

**Goal:** Select, retain, or reject exact tokenizers and fast token estimators
using reproducible evidence for Astrograph's agent-visible JSON payloads.

**Architecture:** Keep exact payload budgeting deterministic and local. Compare
the current split (`tiktoken` exact counts; `tokenx` estimates) against a
small candidate set without network calls, source upload, or runtime fallback
chains. A replacement is permitted to be breaking before v1; compatibility is
not an acceptance criterion.

**Tech Stack:** TypeScript, Node.js 22+, pnpm, Vitest, the benchmark corpus,
and candidate libraries pinned in the lockfile only if selected for evaluation.

## Task 1: Establish a Reproducible Candidate Matrix

**Files:**
- Inspect: `src/tokenizer.ts`, `bench/src/tokenizer.ts`, `package.json`,
  `pnpm-lock.yaml`
- Create: `docs/reviews/tokenizer-estimator-research-<date>.md`
- Test: `tests/tokenizer.test.ts`, `bench/tests/**`

- [ ] Record the current exact and estimated algorithms, tokenizer model,
  package versions, installed/package footprint, licenses, Node support, and
  native-binary behavior.
- [ ] Select at most three maintained candidates with a concrete reason to
  evaluate each. Exclude remote APIs and unmaintained or incompatible packages.
- [ ] Define a locked corpus: task-context JSON, empty/error envelopes,
  provenance-heavy results, Unicode/CRLF source, and large source snippets.

## Task 2: Measure and Decide

**Files:**
- Create or modify: a focused benchmark under `bench/`
- Modify: `docs/reviews/tokenizer-estimator-research-<date>.md`
- Test: `tests/tokenizer.test.ts`, benchmark tests

- [ ] Measure exact-count agreement, estimation error distribution, warm
  latency, memory/package cost, and deterministic repeatability for every
  corpus case.
- [ ] Record operational evidence: offline behavior, Node 22+ compatibility,
  license, release activity, dependency depth, and native-install risk.
- [ ] Decide retain, replace, or defer separately for exact counts and fast
  estimates. Do not replace a dependency without a material measured benefit.

## Task 3: Apply Only a Selected Change

**Selection gate:** Task 2 shows a material benefit that outweighs the
dependency and runtime risk.

**Likely files:** `src/tokenizer.ts`, `bench/src/tokenizer.ts`, `package.json`,
`pnpm-lock.yaml`, API/benchmark docs, and focused tokenizer/context tests.

- [ ] Make the smallest direct pre-v1 replacement; do not ship compatibility
  adapters for superseded tokenizer behavior.
- [ ] Add regression fixtures for every accepted corpus case and update token
  budget/benchmark claims to name the chosen metric.
- [ ] Run `pnpm type-lint`, focused tokenizer/context/benchmark tests,
  `pnpm test:package-bin`, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`. Commit only after the release decision is recorded.
