# Remaining Delivery Epic

> **Status:** In progress — Story 6 is active on its own epic branch.
> Stories 7–8 remain planned and must not begin until explicitly selected.
>
> **Supersedes open delivery work in:**
> [Astrograph Feedback Consolidation](./astro-feedback-epic.md),
> [Branch-Aware Incremental Index](./branch-aware-incremental-index-epic.md),
> [Node 22 Compatibility](./node-22-compatibility-epic.md), and
> [Windows Platform Support](./windows-platform-support-epic.md).

**Goal:** Keep every unfinished delivery obligation in one ordered epic while
preserving the completed work and evidence in its original closed tracker.

**Architecture:** The completed branch-aware-index and Node 22 changes share
one remaining release-publication obligation. Windows compatibility remains a
separate sequence of small, dependency-ordered stories. No story may begin
until its child tasks name exact files, commands, and acceptance evidence.

**Tech Stack:** TypeScript, Node.js 22 LTS, pnpm, Vitest, SQLite, GitHub
Actions, npm trusted publishing, and Windows Git/Node terminals.

---

## Consolidated Remaining Work

| Order | Story | Source | Depends on | Outcome |
| --- | --- | --- | --- | --- |
| 1 | Staff Engineer design and engineering review | New | None | A small, evidence-based set of improvements strengthens long-term quality without slowing alpha delivery. |
| 2 | Windows compatibility audit | Windows Story 1 | None | Every platform-sensitive assumption has a target file and Windows assertion. |
| 3 | Windows filesystem and storage portability | Windows Story 2 | Story 2 | Paths, storage lifecycle, and cleanup work across supported Windows layouts. |
| 4 | Windows Git discovery and fallback | Windows Story 3 | Stories 2–3 | Windows Git/Git Bash enriches state safely; unavailable Git remains non-fatal. |
| 5 | Windows CLI, MCP, and package invocation | Windows Story 4 | Stories 2–4 | The built package works from PowerShell, `cmd`, and Git Bash. |
| 6 | Windows watch and refresh reliability | Windows Story 5 | Stories 3–5 | Filesystem events preserve correct indexing and safe fallback. |
| 7 | Windows CI, documentation, and release gate | Windows Story 6 | Stories 3–6 | Scoped Windows CI provides release-quality proof and documented support. |
| 8 | Release publication evidence | Branch-aware index and Node 22 epics | A release-labelled PR merged to `main` | Cloud release commits a newer version, tags it, and publishes it to npm with recorded evidence. |

## Story Start Protocol

Before starting any story, add a checked child-task breakdown to a dedicated
delivery checklist or follow-on implementation plan. It must include the exact
files, baseline commands and expected results, smallest implementation steps,
focused tests, final verification, version decision, and commit checkpoint.

For this epic, work must use the repository's epic-delivery gate: create an
epic branch, open a pull request, run the configured automated review or
`/review` workflow, resolve blocking findings, and merge only after review and
required CI pass.

## Blocked Work Policy

Do not let an external dependency halt the epic. When a story is blocked,
record the blocker, its owner, the required evidence to unblock it, and the
next retry condition in the active delivery checklist. Then defer that story to
the end of the executable queue and continue every independent, unblocked
story. Only stop when no unblocked work remains.

Release publication is intentionally Story 8 because it depends on an external
merged, `release`-labelled PR; it must never prevent the review or Windows
stories from progressing.

## Story 1: Staff Engineer Design and Engineering Review

**Active delivery checklist:**
[Staff Engineer Review Delivery Checklist](./staff-engineering-review-delivery-checklist.md)

**Goal:** Review Astrograph as a Staff Engineer and identify only the few
evidence-supported improvements with the highest payoff for long-term quality,
maintainability, confidence, and evolution.

**Constraints:** Astrograph is early-stage and intentionally ships continuous
alpha releases. Preserve that pace, prefer incremental improvements, and do
not recommend rewrites or added process unless repository evidence shows a
clear need.

**Review lenses:** architecture, engineering confidence, simplicity, public
surface, and evolution. Distinguish architectural issues from implementation
details, future considerations, and personal preference. Reject hypotheses
that cannot be supported by repository evidence.

**Required report:**

1. **Executive summary** with the three to five highest-leverage
   improvements.
2. **Key findings**. Each finding states the observation, repository evidence,
   why it matters, recommended action, trade-offs, estimated effort (S/M/L),
   and expected impact.
3. **Architectural assessment** covering strengths, risks, simplification
   opportunities, and long-term maintainability.
4. **Confidence assessment** classifying the repository as safe to continue
   shipping alpha, safe with caveats, or risky, with evidence-based reasoning.
5. **Roadmap** grouped into Now, Next, and Later, with Later items deferred
   until project growth justifies them.

**Acceptance criteria:**

- Recommendations are few, direct, proportionate, and specific to Astrograph;
  none are generic best-practice filler or unsupported speculation.
- Every proposed test, CI, release, validation, API, or documentation change
  identifies the exact confidence or maintainability gap it closes.
- The review protects the existing release cadence and calls out concrete
  strengths to preserve.
- The report is written for experienced engineers and does not begin
  implementation work.

## Story 2: Windows Compatibility Audit

**Active delivery checklist:**
[Windows Compatibility Audit Delivery Checklist](./windows-compatibility-audit-delivery-checklist.md)

**Goal:** Turn every Windows-sensitive path, process, storage, and shell
assumption into an explicit, testable requirement before behavior changes.

**Acceptance criteria:**

- Each finding names its target files and a focused fixture or Windows-runner
  assertion.
- POSIX separator, shell interpolation, executable-name, and case assumptions
  are identified.

## Story 3: Windows Filesystem and Storage Portability

**Goal:** Preserve repository identity and `.astrograph` storage lifecycle for
Windows paths, drive letters, spaces, and supported case behavior.

**Acceptance criteria:**

- Path comparisons use Node path APIs and normalized canonical data.
- SQLite, metadata, integrity, and cleanup do not rely on shell deletion.

## Story 4: Windows Git Discovery and Fallback

**Goal:** Support Windows Git and Git Bash enrichment without making Git a
requirement for ordinary indexing.

**Acceptance criteria:**

- Git uses bounded argument-array execution with `shell: false`.
- Named branch, detached HEAD, linked worktree, unavailable Git, and non-Git
  fallback are proved on a Windows runner.

## Story 5: Windows CLI, MCP, and Package Invocation

**Goal:** Make CLI, MCP stdio, and the packed npm artifact usable from
PowerShell, `cmd`, and Git Bash.

**Acceptance criteria:**

- Built CLI and MCP smoke paths work without POSIX wrapper assumptions.
- A packed tarball installs, indexes, and queries successfully on Windows.

## Story 6: Windows Watch and Refresh Reliability

**Goal:** Keep indexing and freshness correct after Windows create, edit,
rename, delete, and failed-probe events.

**Acceptance criteria:**

- Watch debouncing and diagnostics retain freshness guarantees.
- Failed watch or Git probes safely fall back to ordinary refresh.

## Story 7: Windows CI, Documentation, and Release Gate

**Goal:** Make the supported Windows experience continuously verifiable and
visible to users before any release claims Windows support.

**Acceptance criteria:**

- A scoped Windows job preserves the existing Actions cost guardrails.
- Windows type checks, platform tests, and packed-package smoke pass for the
  exact merged commit.
- The Windows job runs `pnpm exec vitest run tests/filesystem-scan.test.ts
  tests/engine-behavior.test.ts`, preserving Story 3's spaced-root and SQLite
  sidecar-reset assertions on the native filesystem.
- The Windows job runs `pnpm exec vitest run tests/git-checkout.test.ts`,
  covering Windows Git/Git Bash named-branch, detached-HEAD, linked-worktree,
  unavailable-Git, and non-Git fallback behavior.
- README and release docs state supported terminals, prerequisites, and the
  Git-optional fallback.

## Story 8: Release Publication Evidence

**Goal:** Exercise and prove the opt-in cloud release path for the completed
branch-aware index and Node 22 work.

**Scope:** Use a release-labelled PR merged into `main`; wait for its required
CI; verify the release-only job creates the version commit and tag; then verify
the tag-triggered trusted npm publication.

**Version automation requirement:** Establish one idempotent version
plan/apply mechanism for local use, merged-PR release CI, and manual release
CI. It must make the same decision in every environment, update every
version-coupled test or fixture deliberately, and expose its proposed change
before it writes.

**Required version sanity checks:**

- Detect whether the merged commit already contains a valid version increment;
  do not create a conflicting second increment.
- Compare the candidate against the current `main` version and the latest
  published npm version using an explicit, documented source-of-truth and
  failure policy for unavailable registry data.
- Reject duplicate, stale, non-monotonic, or conflicting versions before any
  commit, tag, or publication.
- Run `pnpm check:version-bump` after every prospective or applied update, and
  add focused release-policy tests for already-bumped, conflicting-main,
  conflicting-npm, and ordinary-increment paths.
- Keep `pnpm release:plan` side-effect free and make `pnpm release:apply` the
  only local command that writes the version and its required coupled updates.

**Delivery shape:** A release-labelled PR merge invokes the shared check and
apply flow after required CI succeeds; it commits any necessary version update
to `main`, verifies it, pushes the matching tag, and relies on the existing
tag-triggered trusted publisher. Manual release uses that same flow rather than
a second implementation.

**Acceptance criteria:**

- The release runs only for a merged `main` PR carrying the `release` label.
- The cloud release increments the version and pushes its version commit and
  matching tag without rerunning a test suite in the release-only job.
- Local, merged-PR, and manual-release paths share the same version decision,
  update, and sanity-check implementation.
- A version already validly bumped on `main` is accepted without a duplicate
  increment; any version that conflicts with `main` or npm is rejected with an
  actionable diagnostic.
- Release-policy tests prove the version decision and coupled-update behavior
  before the workflow is relied on for publication.
- The npm registry, Git tag, release commit, and GitHub Actions URLs are
  recorded in the active delivery evidence before this story is closed.

## Definition of Done

- [ ] Story 1 has an evidence-based Staff Engineer review and a proportionate
  Now/Next/Later roadmap.
- [ ] Stories 2–7 have complete child-task checklists and passing Windows CI
  evidence.
- [ ] Story 8 has recorded release publication evidence.
- [ ] The original epics remain closed historical records and this document is
  the only open epic-level tracker.
