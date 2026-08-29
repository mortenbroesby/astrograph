# Remaining Delivery Epic

> **Status:** Parked — Story 1 is closed. Stories 2–7 remain planned and must
> not begin until explicitly selected.
>
> **Consolidates remaining delivery work from:**
> [Astrograph Feedback Consolidation](../closed/astro-feedback-epic.md),
> [Branch-Aware Incremental Index](../closed/branch-aware-incremental-index-epic.md),
> [Node 22 Compatibility](../closed/node-22-compatibility-epic.md), and
> [Windows Platform Support](../closed/windows-platform-support-epic.md).

**Goal:** Keep the remaining delivery obligations from the completed feedback,
branch-aware-index, Node 22, and Windows roadmaps in one ordered epic while
preserving completed work and evidence in their closed records.

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

Release delivery is intentionally outside this parked Windows epic. It is the
separate, higher-priority [Release on Main Merge checklist](./0_release-on-main-merge-delivery-checklist.md)
and must not prevent Windows work from progressing.

## Story 1: Staff Engineer Design and Engineering Review — Complete

**Closed delivery checklist:**
[Staff Engineer Review Delivery Checklist](../closed/staff-engineering-review-delivery-checklist.md)

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

**Delivery checklist:**
[Windows Compatibility Audit Delivery Checklist](./3_1_windows-compatibility-audit-delivery-checklist.md)

**Goal:** Turn every Windows-sensitive path, process, storage, and shell
assumption into an explicit, testable requirement before behavior changes.

**Acceptance criteria:**

- Each finding names its target files and a focused fixture or Windows-runner
  assertion.
- POSIX separator, shell interpolation, executable-name, and case assumptions
  are identified.

## Story 3: Windows Filesystem and Storage Portability

**Delivery checklist:**
[Windows Filesystem and Storage Portability Delivery Checklist](./3_2_windows-filesystem-storage-portability-delivery-checklist.md)

**Goal:** Preserve repository identity and `.astrograph` storage lifecycle for
Windows paths, drive letters, spaces, and supported case behavior.

**Acceptance criteria:**

- Path comparisons use Node path APIs and normalized canonical data.
- SQLite, metadata, integrity, and cleanup do not rely on shell deletion.

## Story 4: Windows Git Discovery and Fallback

**Delivery checklist:**
[Windows Git Discovery and Fallback Delivery Checklist](./3_3_windows-git-discovery-fallback-delivery-checklist.md)

**Goal:** Support Windows Git and Git Bash enrichment without making Git a
requirement for ordinary indexing.

**Acceptance criteria:**

- Git uses bounded argument-array execution with `shell: false`.
- Named branch, detached HEAD, linked worktree, unavailable Git, and non-Git
  fallback are proved on a Windows runner.

## Story 5: Windows CLI, MCP, and Package Invocation

**Delivery checklist:**
[Windows CLI, MCP, and Package Invocation Delivery Checklist](./3_4_windows-cli-mcp-package-invocation-delivery-checklist.md)

**Goal:** Make CLI, MCP stdio, and the packed npm artifact usable from
PowerShell, `cmd`, and Git Bash.

**Acceptance criteria:**

- Built CLI and MCP smoke paths work without POSIX wrapper assumptions.
- A packed tarball installs, indexes, and queries successfully on Windows.

## Story 6: Windows Watch and Refresh Reliability

**Delivery checklist:**
[Windows Watch and Refresh Reliability Delivery Checklist](./3_5_windows-watch-refresh-delivery-checklist.md)

**Goal:** Keep indexing and freshness correct after Windows create, edit,
rename, delete, and failed-probe events.

**Acceptance criteria:**

- Watch debouncing and diagnostics retain freshness guarantees.
- Failed watch or Git probes safely fall back to ordinary refresh.

## Story 7: Windows CI, Documentation, and Release Gate

**Delivery checklist:**
[Windows CI, Documentation, and Release Gate Delivery Checklist](./3_6_windows-ci-documentation-release-gate-delivery-checklist.md)

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

## Definition of Done

- [x] Story 1 has an evidence-based Staff Engineer review and a proportionate
  Now/Next/Later roadmap.
- [x] Stories 2–7 have complete child-task checklists and historical Windows
  CI evidence; the hosted job is currently disabled under the cost policy.
- [ ] The original epics remain closed historical records and this document is
  the only active tracker for their remaining delivery obligations.
