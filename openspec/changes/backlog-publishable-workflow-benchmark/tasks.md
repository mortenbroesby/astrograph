# Publishable Workflow Benchmark Implementation Plan

> Migrated from [the legacy planned tracker](../../../specs-legacy/implementation/planned/publishable-workflow-benchmark.md). The checkbox state below is authoritative going forward.
> References below to `pointer.md` or `specs/` are historical; update this OpenSpec change instead and keep `specs-legacy/` read-only.

## Preserved Plan

> **Status:** Ready — reconciled on 2026-07-29. The harness now contains
> snapshot guards and focused tests, but no report may be published until the
> remaining reproducibility gate passes on a deliberately selected corpus.

**Goal:** Publish a small, reproducible comparison that shows when Astrograph
retrieval beats broad read-all exploration, without presenting stale, synthetic,
or partial results as product proof.

**Architecture:** Reuse the existing task-card corpus, workflow runner, exact
`cl100k_base` tokenizer, and Markdown report renderer. First make the corpus
strictly snapshot-locked and representative; then check in one generated
Markdown summary with its JSON evidence. Do not add an HTML dashboard, hosted
service, telemetry, model evaluation, or a new benchmark framework.

**Tech Stack:** TypeScript, Node.js 22, existing `bench/` runner and report
renderer, Vitest, Markdown.

---

## Task 1: Make the comparison valid on its declared snapshot

**Files:** `package.json`, `tests/benchmark-scripts.test.ts`, `bench/tests/fixtures/benchmarks/ai-context-engine-benchmark-corpus.json`,
`bench/tests/fixtures/benchmarks/tasks/*.md`, `bench/tests/*benchmark*.test.ts`,
`bench/src/cli.ts`

- [ ] Record the exact source commit and Node/platform metadata for a fresh
  corpus run; reject a report when its manifest snapshot does not match.
- [x] Make every supported `pnpm bench:*` command build before it measures, so
  a source checkout cannot benchmark stale `dist/` output. Direct Node-script
  invocation is diagnostic-only and is not evidence.
- [ ] Replace or repair task cards that no longer retrieve their declared
  targets on the locked checkout. Keep a broad read-all baseline and only the
  Astrograph workflows that are meaningful for that task.
- [ ] Add focused tests for snapshot rejection, task-card validation, and the
  report's success/recall/token totals.
- [ ] Run:

  ```bash
  pnpm exec vitest run bench/tests/benchmark.test.ts
  node --experimental-strip-types ./bench/src/cli.ts --strict
  ```

  Expected: the strict run writes a report only when the corpus and checkout
  match, with no failed selected workflow.

## Task 2: Publish one auditable result, not a dashboard

**Files:** `bench/src/report.ts`, `docs/benchmarks/latest.md`,
`docs/guides/benchmarks.md`, `docs/README.md`, `README.md`

- [ ] Add the smallest report section that labels the baseline, selected
  Astrograph workflow, task count, success/recall, token reduction, tool calls,
  latency, repository SHA, Node version, and run date.
- [ ] Check in the generated Markdown result and companion JSON evidence only
  after Task 1 passes. Link it from the benchmark guide and README.
- [ ] State scope and limitations beside every headline: it is a fixed corpus,
  not a productivity, quality, or cost guarantee for all repositories or
  models.
- [ ] Keep visualisation to the Markdown comparison table. Add HTML or a TUI
  only if Markdown makes a concrete comparison hard to read.

## Task 3: Add a proportionate CI regression gate

**Files:** `tests/compact-agc1-harness.test.ts`,
`tests/compact-output-fixtures.test.ts`, `bench/scripts/measure-agc1-compact-output-matrix.mjs`,
`.github/workflows/ci.yml`, `.agents/rules/github-actions-cost.md`

- [ ] Keep numerical throughput and end-to-end latency out of required hosted
  CI: runner hardware and daemon startup make them noisy and unsuitable for a
  stable PR gate.
- [ ] Add only deterministic compact-output integrity/token-budget assertions
  to the existing Fast job, after measuring their clean-run duration. Preserve
  the existing path filters, cache, concurrency cancellation, and 15-minute
  budget.
- [ ] Repair the compact-output runner's clean-runtime/daemon-start behavior
  before using it in automation. Its 2026-07-26 local run timed out while
  starting a daemon, so it is not a reliable check yet.
- [ ] Keep the full four-fixture and workflow-corpus runs opt-in: an existing
  PR label or manual dispatch may publish an artifact and summary. Do not add a
  schedule, a broad trigger, or a new larger runner.
- [ ] Before changing `.github/workflows/ci.yml`, obtain
  `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true` and document the added minutes,
  trigger, and reason in the PR.

## Task 4: Verify and release deliberately

**Files:** only the Task 1–2 files.

- [ ] Run focused benchmark tests, then:

  ```bash
  pnpm type-lint
  pnpm build
  pnpm test
  pnpm check:version-bump
  git diff --check
  ```

- [ ] Use the release-decision workflow before committing because changes in
  `bench/`, tests, or package-facing documentation may require a release.
- [ ] Commit the corpus, generated evidence, and docs together only when the
  strict run is reproducible from the recorded checkout.

## Current evidence and gate

The exploratory run on `1f591a2` reported a 31.8% aggregate token reduction
across 20 workflow/task rows, but it used a corpus locked to `74f79fa` and had
7 failed workflow rows. It is useful diagnosis, not publishable evidence. The
strict snapshot plus zero-selected-workflow-failures gate above must pass before
any workflow-level number appears in the README.
