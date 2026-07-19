# Staff Engineer Review — July 2026

**Scope:** Architecture, engineering confidence, public surface, simplicity,
and evolution of the current Astrograph repository.

**Method:** This review inspected the current implementation, tests, CI and
release workflows, package metadata, and public documentation. It ran
`pnpm type-lint`, `pnpm test`, `pnpm test:package-bin`, and `pnpm release:plan`
successfully. The release plan identifies a pending minor release from
`v0.3.2-alpha.75` to `0.4.0-alpha.88`; that is evidence of a real release path,
not a recommendation to publish from this review.

## Executive summary

Astrograph is safe to keep shipping as an alpha. Its fundamentals are notably
strong: deterministic indexing behavior is tested, public boundaries are
validated, the packaged CLI is smoked, and release publication is opt-in. The
highest-leverage improvements are deliberately few:

1. Run the full behavioral suite before a release tag exists.
2. Finish the already-planned single version-and-release transaction.
3. Incrementally separate the oversized storage and retrieval ownership areas.
4. Eliminate the contradictory Node runtime promise in the README.

These are confidence and maintainability improvements, not a request to slow
the alpha cadence or rewrite working subsystems.

## Key findings

### 1. Make the full Vitest suite a pre-tag CI gate

**Observation:** Required PR/main CI builds, type-checks, runs a package smoke,
and runs one MCP stdio test, but does not run `pnpm test`. The full suite runs
only in the tag-triggered publish workflow.

**Evidence:** The fast job is limited to build, type lint, release-script
smoke, package smoke, one MCP test, and version policy in
[CI](../../.github/workflows/ci.yml#L82-L107). The publish workflow runs
`pnpm test` after a tag has already triggered it in
[Release](../../.github/workflows/release.yml#L39-L51). The current full suite
passed locally in this review.

**Why it matters:** A behavior regression can create a public release tag before
the suite detects it. npm publication is still prevented if the test fails, but
the tagged state and the retry path are needlessly less clear for a project
that wants frequent alpha releases.

**Recommended action:** Add `pnpm test` to the existing fast CI job, immediately
after type lint. Keep the release-only job test-free as designed; its role is
version/tag mutation, not duplicate validation.

**Trade-offs:** This adds CI minutes to PRs and `main` pushes. It does not add a
new job, runner, or release delay beyond the suite duration; retain existing
concurrency cancellation and measure actual duration after adoption.

**Estimated effort:** S

**Expected impact:** High confidence in every merged alpha; fewer tagged-but-not-
publishable states.

### 2. Complete a single, conflict-aware version-and-release transaction

**Observation:** The repository has good primitives, but the release agent and
version guard do not yet prove a single view of local state, `main`, and npm.

**Evidence:** `release-agent.ts` calculates a target from the latest reachable
tag and the checkout, then mutates `package.json` and the engine contract test
when apply mode is used
([release agent](../../src/scripts/release-agent.ts#L169-L219)).
`check-version-bump.ts` validates only the staged package delta against `HEAD`
([version guard](../../src/scripts/check-version-bump.ts#L62-L111)). The release
workflow commits those two files and pushes the tag
([CI release step](../../.github/workflows/ci.yml#L156-L177)). None of these
paths compares a candidate against npm's published version or independently
refreshes `main` before mutation.

**Why it matters:** Continuous alpha releases amplify race and retry cases.
Without one idempotent decision/apply path, an already-bumped merge, a stale
checkout, or an npm/version conflict can produce confusing manual recovery.

**Recommended action:** Deliver Remaining Delivery Epic Story 8 as written:
one side-effect-free plan plus one idempotent apply path shared by local use,
merged-PR CI, and manual CI. Give it explicit `main` and npm conflict checks,
coupled-update ownership, and focused tests for normal, already-bumped, and
conflict cases.

**Trade-offs:** npm lookup introduces an external dependency; define a strict
failure policy and avoid making ordinary local planning network-dependent.
This is a focused release-tooling change, not a publishing-process rewrite.

**Estimated effort:** M

**Expected impact:** High confidence in automated alpha publishing and clearer
failure recovery.

### 3. Split storage and retrieval by lifecycle, one vertical slice at a time

**Observation:** Two modules now own several distinct concerns. `storage.ts`
combines connection/cache lifecycle, worker-pool setup, scan/index orchestration,
artifact persistence, dependency rebuilding, public engine operations, and
watch integration. `retrieval.ts` combines query normalization, FTS, ranking,
dependency traversal, context assembly, and result shaping.

**Evidence:** `storage.ts` is 2,575 lines and imports the worker pool, scan,
indexing, cache, diagnostics, storage, and retrieval layers
([storage imports](../../src/storage.ts#L1-L130)); worker/cache lifecycle is in
the same module as indexing and persistence
([storage lifecycle](../../src/storage.ts#L201-L350)). `retrieval.ts` is 1,393
lines, with ranking/FTS helpers early and public retrieval/assembly operations
later ([retrieval helpers](../../src/retrieval.ts#L62-L293),
[public operations](../../src/retrieval.ts#L955-L1393)). The corresponding
behavior suite is also a 3,102-line cross-domain test file.

**Why it matters:** These modules are still coherent enough to ship, but each
new indexing or retrieval feature must navigate unrelated lifecycle concerns.
That increases review cost and raises the chance that a local change disturbs a
neighboring invariant.

**Recommended action:** Do not rewrite either module. Establish narrow internal
facades and extract one cohesive slice per change: start with retrieval ranking
and result shaping, then separate storage connection/worker lifecycle from
index orchestration. Move the matching behavior tests with each slice. Preserve
the public `src/index.ts` surface and existing deterministic fixtures.

**Trade-offs:** This is a multi-PR refactor with short-term file movement and
test churn. Avoid abstraction layers that merely rename calls; extraction earns
its cost only when the new boundary has independent inputs, invariants, and
tests.

**Estimated effort:** L

**Expected impact:** High long-term maintainability; lower cognitive load for
future index, cache, and retrieval changes.

### 4. Make the supported Node range a single public fact

**Observation:** The README tells users two different runtime requirements.

**Evidence:** Its badge advertises Node `>=24`
([README](../../README.md#L15-L20)), while the install details specify
`>=22.12.0` ([README](../../README.md#L212-L215)) and `package.json` declares
the same `>=22.12.0` engine ([package metadata](../../package.json#L27-L29)).

**Why it matters:** Runtime requirements are an adoption gate. A contributor
who sees the badge may unnecessarily reject a supported Node 22 environment,
which undermines the recent compatibility work.

**Recommended action:** Correct the badge now and add a small contract check
that the user-facing runtime claim matches `package.json#engines.node`. Keep the
test intentionally narrow; this does not justify a documentation generator.

**Trade-offs:** The check couples one user-facing string to package metadata.
That is appropriate here because the value is a compatibility promise, not
editorial copy.

**Estimated effort:** S

**Expected impact:** Immediate onboarding clarity and fewer false support
questions.

## Architectural assessment

### Strengths

Astrograph has a good product-shaped architecture. The package exports a
focused library surface from `src/index.ts`, while CLI and MCP route through a
shared command registry rather than duplicating business operations
([registry](../../src/command-registry.ts#L55-L260)). MCP tools are registered
from explicit definitions and route failures into structured envelopes
([MCP server](../../src/mcp.ts#L540-L555)).

The core correctness posture is stronger than its early-stage label suggests:
deterministic scan, cache, dependency, freshness, watch, CLI, MCP, and package
behaviors have focused coverage. The recent branch-aware design intentionally
keeps Git observations out of artifact identity, which is the right boundary
for safe reuse. The opt-in release label and the three-minute release-only job
also show good cost discipline.

### Architectural risks

The primary risk is not a wrong abstraction; it is concentration of ownership
in storage/retrieval modules and their large integration tests. This will make
future changes harder to isolate if left unaddressed. The second risk is the
release state machine being distributed across policy, script, CI, tags, and
npm without a final cross-source conflict check.

### Simplification opportunities

Prefer extracting cohesive ownership over inventing a framework. The command
registry is already a useful source of truth; preserve it. The storage and
retrieval split should remove responsibility from their current modules, not
add an indirection layer above them. For public runtime support, one corrected
badge plus one narrow contract test is simpler than additional onboarding prose.

### Long-term maintainability

The repository can evolve well if it keeps changes vertical: isolate one
behavior boundary, move its tests, retain deterministic fixtures, and leave the
public surface stable. Avoid a broad “architecture cleanup” milestone; the
evidence supports a staged extraction sequence instead.

## Confidence assessment

**Safe with caveats.** The local full suite, type check, package-bin smoke, and
release plan passed in this review. The project has meaningful runtime boundary
tests, deterministic fixtures, structured MCP errors, a package smoke path,
and an opt-in publication gate.

The caveats are concrete: full behavioral tests are currently post-tag rather
than pre-merge, and release version decisions have not yet gained the planned
`main`/npm conflict checks. Neither requires slowing alpha delivery; both are
small-to-medium improvements to the confidence loop.

## Roadmap

## Now

- Correct the README Node badge and add the narrow runtime-claim contract test.
- Run the existing full Vitest suite in the fast required CI job and observe its
  duration/cost for several PRs.

## Next

- Implement Remaining Delivery Epic Story 8: shared, idempotent version plan/
  apply with `main`/npm conflict checks and focused release-policy tests.
- Begin the first retrieval ownership extraction only when it is coupled to a
  real ranking or result-shaping change; move its tests with it.

## Later

- Continue the storage/retrieval extraction one vertical slice at a time when
  upcoming work crosses those boundaries.
- If the public command surface grows materially, use the existing command
  registry to generate or verify a compact CLI/MCP capability matrix. The
  current surface is small enough that manual reference documentation remains
  appropriate.
- Execute the planned Windows compatibility stories before claiming Windows
  support; do not pre-empt that evidence with speculative portability work.
