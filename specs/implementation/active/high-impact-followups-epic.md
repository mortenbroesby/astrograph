# High-Impact Product Follow-Ups Epic

> **Status:** Active — Stories 1 and 2 are deferred after their evidence gates;
> Story 3 is complete locally and Story 4 is next for selection. Stories 4–6 may begin only with their own
> active checklist.
>
> **Builds on:** the completed [Global Install and Cache Epic](../closed/global-install-and-cache-epic.md),
> [Branch-Aware Incremental Index Epic](../closed/branch-aware-incremental-index-epic.md),
> and [Astrograph Feedback Consolidation Epic](../closed/astro-feedback-epic.md).
> It complements—rather than replaces—the [Remaining Delivery Epic](./remaining-delivery-epic.md)
> and [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md).

**Goal:** Turn the largest completed platform investments into the next
meaningful user outcomes: faster safe work across repositories and checkouts,
reliable global setup, and more trustworthy retrieval. Order work by expected
user impact, then by the evidence needed to justify its cost and complexity.

**Architecture:** Preserve the current local-first model: repository-specific
mutable state, optional Git enrichment, explicit `repoRoot`, and no hidden
network synchronization or background service. Cross-checkout or
cross-repository reuse may share only immutable, complete-fingerprint
artifacts; each checkout retains independent path mappings, dependency edges,
freshness state, and access boundaries. New user-facing behavior remains
inspectable, dry-run-safe where it writes configuration, and compatible with
the current JSON-first CLI and MCP contracts.

**Tech Stack:** TypeScript, Node.js 22 LTS, SQLite WAL, tree-sitter, pnpm,
Vitest, GitHub Actions, npm trusted publishing, and existing CLI/MCP contracts.

---

## Priority and Selection Rules

Stories are ordered by impact, not by implementation convenience. A story may
begin only when its selection gate is satisfied and a dedicated checklist names
exact files, baseline results, focused tests, final checks, version decision,
review evidence, and commit checkpoint. Source changes use an isolated
worktree and run `pnpm check:version-bump` before commit.

Do not use a candidate story to expand scope opportunistically. If discovery
shows that a story requires a shared mutable index, network sync, source upload,
an always-on daemon, or destructive MCP cache controls, stop and write an ADR
before implementation.

| Order | Story | Why it is early | Depends on | Selection evidence |
| --- | --- | --- | --- | --- |
| 1 | Global + branch-aware immutable artifact reuse | The highest potential reduction in repeat indexing after global install and branch/worktree switching. | Completed global and branch-aware epics | Measured duplicate analysis/storage cost and an ADR proving immutable-only sharing preserves isolation. |
| 2 | Global installation health and recovery | Improves the first-use and recovery path for every globally installed user. | Story 1 is not required | Real setup/repair failure cases or a reproducible multi-client configuration matrix. |
| 3 | Checkout and cache transparency | Makes reuse, fallback, and freshness understandable before users trust faster indexing. | Existing branch-aware mappings; may follow Story 1 | A support/debugging gap that current JSON status and diagnostics cannot answer. |
| 4 | Provenance-first retrieval and deterministic lexical ranking | Raises answer quality and trust for both agents and humans without network dependence. | Precision epic Stories 1–2 | A pinned judged corpus, baseline relevance/latency, and public-contract review. |
| 5 | Token-budgeted context and compact transport | Converts better retrieval into lower-context, higher-signal agent handoffs. | Story 4 | Measured payload and relevance baselines proving an additive contract is warranted. |
| 6 | Cross-platform confidence and release automation evidence | Broadens reliable adoption without diluting the user-value work above. | Existing Remaining Delivery Epic | Select and update the existing Windows/release checklist; do not duplicate it here. |

## Story 1: Global + Branch-Aware Immutable Artifact Reuse

**Status:** Deferred — the representative two-file global fixture duplicated
four artifacts but took only 2.044 seconds for both indexes. That does not
justify new cross-repository storage complexity. See the
[delivery checklist](./global-branch-artifact-reuse-delivery-checklist.md).

**Outcome:** A user who indexes related checkouts or repositories avoids
repeating validated immutable analysis, while each repository and checkout
continues to own all mutable state.

**Scope:** Re-evaluate the deferred global shared-artifact-store opportunity
using the complete fingerprint, storage migration, and checkout mapping
contracts already delivered. Reuse must be limited to parse output, symbols,
summaries, and import facts whose full identity matches. It must never share
SQLite indexes, event logs, locks, diagnostics, path mappings, dependency edges,
or freshness records.

**Selection gate:**

- Record a representative local corpus and compare cold index, branch switch,
  linked worktree, and repeated-content runs.
- Quantify duplicate parsing time and storage; stop if the expected benefit is
  not material relative to migration and complexity cost.
- Add an ADR describing owner boundaries, fingerprint inputs, retention,
  eviction, migration/rebuild behavior, and privacy properties.
- Demonstrate fixture-level isolation for two unrelated repositories, same
  content under different roots, renamed files, changed config/parser versions,
  and concurrent cleanup/index activity.

**Acceptance evidence:** A benchmark and focused tests prove a validated hit
reduces repeat analysis without allowing cross-repository mutable-state leakage
or stale checkout dependency edges. Diagnostics expose reuse/fallback reasons
without source content.

## Story 2: Global Installation Health and Recovery

**Status:** Deferred — the supported global Codex path already has
preflight, dry-run, marker-owned idempotent writes, permission remediation,
cache status, and packed-package proof. No distinct recovery contract is
justified without a reproducible support gap. See the
[delivery checklist](./global-install-health-recovery-delivery-checklist.md).

**Outcome:** A user can diagnose and safely repair a global Astrograph setup
without knowing config-file locations or risking unrelated MCP configuration.

**Scope:** Build on `astrograph install --global --ide codex` and existing
cache controls with an inspectable health/repair contract. Candidate coverage
includes missing or moved executable paths, unsupported runtime, marker-block
drift, permissions, stale generated config, and selected client/terminal
matrices. Prefer `--dry-run` and JSON evidence; write only Astrograph-owned
configuration.

**Selection gate:** Capture real or reproducible failure modes across supported
clients/terminals and inventory which existing `status`, `doctor`, and install
output already answers. Publish a small compatibility matrix before adding a
new command or option.

**Acceptance evidence:** Every supported failure reports a remediation that is
specific, non-destructive, and idempotent. Repeated repair preserves unrelated
configuration byte-for-byte and packed-package tests cover the chosen clients.

## Story 3: Checkout and Cache Transparency

**Status:** Complete locally — `cache status.checkout` now provides the
persisted checkout identity that populated the selected cache. It is `null`
before indexing and otherwise reports Git mode, repository/head/branch/worktree
identity, diagnostic, and indexed time. See the
[delivery checklist](./global-checkout-cache-transparency-delivery-checklist.md).

**Outcome:** Users and agents can tell which repository/checkout is being used,
whether results are fresh, and why a cache/artifact was reused or bypassed.

**Scope:** Add only the minimal additive JSON/diagnostic fields needed to
surface canonical repository identity, checkout state, storage mode, freshness,
reuse counters, and safe fallback reasons. Keep `repoRoot` required; do not
infer a workspace from the globally installed process.

**Selection gate:** Collect support/debugging examples that cannot be resolved
from current cache status, diagnostics, and branch-aware freshness output. Map
every proposed field to one operator decision and one focused fixture.

**Acceptance evidence:** Fixtures for named branch, detached HEAD, linked
worktree, unavailable Git, local/global storage, migration state, and a stale
artifact show deterministic, privacy-safe diagnostics. Existing JSON consumers
remain compatible through additive fields only.

## Story 4: Provenance-First Retrieval and Deterministic Lexical Ranking

**Outcome:** Queries return smaller, verifiable, locally ranked source results
before any optional semantic system is considered.

**Scope:** Select and execute Stories 1–2 of the
[Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md):
stable source/symbol provenance followed by deterministic lexical ranking.
Do not begin semantic retrieval, remote embeddings, or a vector service in
this story.

**Selection gate:** Pin a representative corpus/task manifest, record current
source identity/range behavior, and establish relevance, latency, and index
size baselines. Review CLI/MCP compatibility before adding public fields.

**Acceptance evidence:** Returned slices verify against their recorded source
hash and range; the same corpus/query produces the same ranking with recorded
precision@k, MRR, zero-result rate, warm latency, and storage delta.

## Story 5: Token-Budgeted Context and Compact Transport

**Outcome:** Agents receive coherent, source-attributed task context inside a
declared budget rather than broad file dumps.

**Scope:** Select Precision Epic Stories 3–4 only after Story 4 establishes
provenance and lexical evidence. Consolidate existing context behavior into one
additive, deterministic assembler; JSON remains default and any compact format
must be lossless and versioned.

**Selection gate:** Compare representative current payloads by bytes/tokens,
relevance, exclusions, and latency. Prove that an existing tool composition
cannot provide the same bounded outcome before adding a new surface.

**Acceptance evidence:** Exploration, debugging, refactor, and audit fixtures
meet stated token budgets, retain provenance, explain exclusions/truncation,
and round-trip any compact response losslessly.

## Story 6: Cross-Platform Confidence and Release Automation Evidence

**Outcome:** High-impact product work remains usable from supported Windows
terminals and is released through a fully evidenced guarded path.

**Scope:** This is a routing story, not a replacement plan. Select the
appropriate unchecked item in the [Remaining Delivery Epic](./remaining-delivery-epic.md):
Windows audit through release gate, or automatic release-publication evidence.
Do not recreate those checklists here.

**Selection gate:** Identify the next unchecked requirement in that epic and
update its dedicated delivery checklist with the exact affected platform and
release evidence.

**Acceptance evidence:** The selected existing checklist—not this epic—records
the native Windows and/or release CI proof for the exact merged commit.

## Non-Goals

- A shared mutable index, global source search across repositories, background
  daemon, network synchronization, or hidden source upload.
- Marking a candidate story complete from a plan or benchmark alone.
- Replacing existing Windows, release, or precision checklists with duplicate
  trackers.
- Treating optional semantic retrieval as a prerequisite for local lexical
  value.

## Definition of Done

- [ ] Each selected story has an active checklist with exact scope and passing
  evidence before it is closed.
- [ ] Global/cache and branch-aware improvements preserve canonical repository
  isolation, checkout-local mutable state, and privacy boundaries.
- [ ] Any new CLI/MCP surface has linked contract documentation and compatible
  JSON behavior.
- [ ] Measured user benefit, not a feature count, determines whether each
  candidate continues.
