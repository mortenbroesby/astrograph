# Tokenizer and Token-Estimator Research Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](../planned/high-impact-followups-epic.md), Story 10
>
> **Status:** Complete — retained `tiktoken` for exact budgets and `tokenx` as
> the explicit estimate after PR #36 (`fa8d2a9`) passed exact-head Fast and
> Windows compatibility/package-smoke CI. No production replacement was
> selected because the material-benefit gate was not met.

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
- Test: `bench/tests/tokenizer.test.ts`, `bench/tests/**`

- [x] Record the current exact and estimated algorithms, tokenizer model,
  package versions, installed/package footprint, licenses, Node support, and
  native-binary behavior. See
  `docs/reviews/tokenizer-estimator-research-2026-07-22.md`.
- [x] Select at most three maintained candidates with a concrete reason to
  evaluate each. Exclude remote APIs and unmaintained or incompatible packages.
  `gpt-tokenizer@3.4.0` and `js-tiktoken@1.0.21` are the two exact candidates;
  the unrelated BSV Tokenator package is explicitly excluded.
- [x] Define a locked corpus: task-context JSON, empty/error envelopes,
  provenance-heavy results, Unicode/CRLF source, and large source snippets.
  The exact cases and measurements are defined in the research record.

## Task 2: Measure and Decide

**Files:**
- Create or modify: a focused benchmark under `bench/`
- Modify: `docs/reviews/tokenizer-estimator-research-<date>.md`
- Test: `bench/tests/tokenizer.test.ts`, benchmark tests

- [x] Measure exact-count agreement, estimation error distribution, warm
  latency, memory/package cost, and deterministic repeatability for every
  corpus case. The checked-in fresh-process benchmark compares all seven locked
  corpus cases; the research record contains three-run latency/RSS medians and
  exact/estimation results.
- [x] Record operational evidence: offline behavior, Node 22+ compatibility,
  license, release activity, dependency depth, and native-install risk.
  All candidates are local Node packages; the research record captures package
  metadata, zero/one dependency depth, WASM/pure-JS behavior, and licenses.
- [x] Decide retain, replace, or defer separately for exact counts and fast
  estimates. Do not replace a dependency without a material measured benefit.
  Retain `tiktoken` for exact counts and `tokenx` as the labelled estimate;
  neither exact candidate provides sufficient total benefit to replace it.

## Task 3: Apply Only a Selected Change

**Selection gate:** Not met. Task 2 found no material benefit that outweighs
the dependency and runtime risk.

**Likely files:** `src/tokenizer.ts`, `bench/src/tokenizer.ts`, `package.json`,
`pnpm-lock.yaml`, API/benchmark docs, and focused tokenizer/context tests.

- [x] No replacement was selected: `gpt-tokenizer`'s speed gain did not justify
  its package cost, `js-tiktoken` had no resource advantage, and `tokenx`
  remains too inaccurate for budget enforcement. No compatibility adapter or
  production-tokenizer change is warranted.
- [x] Add regression fixtures for every accepted corpus case and update token
  budget/benchmark claims to name the chosen metric. The locked corpus and
  deterministic candidate test are shipped in PR #36; exact counts remain
  `tiktoken cl100k_base` and estimates remain explicitly labelled `tokenx`.
- [x] Run `pnpm type-lint`, focused tokenizer/context/benchmark tests,
  `pnpm test:package-bin`, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`. The selected research change passed its focused/full
  benchmark suite, type/version/release/diff checks, and exact-head hosted Fast
  and Windows/package-smoke CI in PR #36.
