# Astrograph Delivery Roadmap

This is the one-page source of truth for delivery status. It answers “what do
we do now?” before an agent opens a detailed epic, checklist, or closed record.
The root [`pointer.md`](../../pointer.md) names the one executable goal; this
roadmap explains everything else.

| Status | Meaning | Agent action |
| --- | --- | --- |
| **Active** | Explicitly selected and executable. | Follow the linked checklist from its first unchecked task. |
| **Ready** | Has a detailed checklist but is not selected. | Do not start until it is moved into `active/` and named by `pointer.md`. |
| **Parked** | Evidence says the benefit or problem is not yet sufficient. | Reconsider only when the stated selection gate has new evidence. |
| **Blocked** | Requires an external event or authority. | Record/perform the prerequisite; do not substitute unrelated code work. |
| **Ideas** | Useful direction without an implementation commitment. | Keep out of the execution queue until scoped and selected. |
| **Descoped** | Explicitly outside the current product direction. | Do not reintroduce without an ADR and explicit selection. |
| **Done** | Merged evidence, retained for history. | Read only for context or verification pointers. |

## Active — do this now

1. [Incremental Freshness Lifecycle](./active/7_incremental-freshness-lifecycle-delivery-checklist.md)
   - Goal: make local retrieval freshness explicit and safely incremental after
     edits, checkout changes, and watcher fallback.
   - First action: measure current cold/no-op/delta behavior and map the
     freshness/diagnostic contract before selecting a source change.
   - The broader [Precision Retrieval and Agent Experience epic](./planned/1_precision-retrieval-agent-experience-epic.md)
     remains open; its closure rule requires every selected story and this
     roadmap/pointer transition to be merged to `main` with recorded evidence.

## Ready — detailed, but not selected

2. [npm-module adoption](./planned/2_npm-module-adoption-epic.md) has Stories
   1–3 complete; Stories 4–6 remain parked behind their CI-cost and
   third-party-command evidence gates. Preserve product-specific behavior;
   package-quality gates require an explicit renewed selection.
3. [Windows delivery](./planned/3_remaining-delivery-epic.md) is parked while
   hosted Windows CI is disabled for cost. Its retained child checklists are
   available in [planned work](./planned/README.md) when a concrete platform
   gap, local/container proof, and re-enable budget exist.

## Parked — revisit only with new evidence

- [Global + branch-aware immutable artifact reuse](./planned/5_global-branch-artifact-reuse-delivery-checklist.md):
  a representative run took 2.044 seconds for both indexes, so the measured
  duplication did not justify cross-repository storage complexity.
- [Compact versioned transport](./planned/1_precision-retrieval-agent-experience-epic.md#story-4--compact-versioned-transport):
  measure complete agent-visible MCP envelopes before selecting an opt-in,
  versioned compact JSON format for repetitive result shapes.
- [Internal artifact serialization efficiency](./planned/1_precision-retrieval-agent-experience-epic.md#story-10--internal-artifact-serialization-efficiency):
  MessagePack is only a selective internal candidate after measurements compare
  `analysis_artifacts` JSON, deduplicated layout, size, latency, and debuggability.
- [Optional shared immutable artifact store](./planned/6_global-install-and-cache-deferred-stories.md#story-6-shared-immutable-artifact-store--optional-and-deferred):
  never shares mutable repository indexes and remains optional.
- [Package-confidence CI cost review](./planned/4_npm-module-package-confidence-cost-review-checklist.md):
  baseline evidence is recorded, but product priority moved to Incremental
  Freshness Lifecycle before the temporary candidate-CLI evaluation. Resume
  only with explicit approval and a renewed product-priority decision.

## Blocked — external prerequisite only

No selected item is blocked. The release-on-main path is now verified and
recorded as completed evidence.

## Ideas — not a commitment

- [Later precision retrieval candidates](./planned/1_precision-retrieval-agent-experience-epic.md):
  onboarding packs, incremental freshness, optional semantic/hybrid retrieval,
  and honest benchmark/reporting. Each needs its own evidence gate.
- [Spec-system backlog](./planned/7_spec-system-backlog.md): architecture/API
  coverage and authoring consistency.
- [High-impact follow-up history](./planned/4_high-impact-followups-epic.md):
  completed results and deferred candidates; its selection gates remain the
  only route for reopening them.
- [Compact output versus internal serialization assessment](../../docs/reviews/compact-output-vs-internal-serialization-2026-07-22.md):
  ingested roadmap input; it does not select either parked story.
- [`specs/raw/`](../raw/): research inputs only; not a delivery queue.

## Descoped — do not quietly add

- One shared mutable SQLite index or cross-repository source search.
- A background daemon, network synchronization, or hidden source upload.
- Hidden tool routing, generic MCP router, compatibility aliases, or destructive
  MCP cache controls.
- Backward compatibility solely to preserve obsolete pre-v1 cache data.

These boundaries come from the [high-impact follow-up epic](./planned/4_high-impact-followups-epic.md),
the [global-cache handoff](./planned/6_global-install-and-cache-deferred-stories.md),
and the [MCP contract](../api-design/mcp-tools.md).

## Done — evidence, not queue

- [Closed records](./closed/README.md) contain the completed global install and
  cache, global Codex/Copilot setup, cache cleanup, branch-aware indexing,
  provenance/ranking, task context, tokenizer research, and MCP tool-surface
  deliveries.
- The [completed global-install epic](./closed/global-install-and-cache-epic.md)
  is historical evidence, including its package release.
- [Global Astrograph cleanup preparation](./closed/global-astrograph-cleanup-preparation-checklist.md)
  closed in PR #43 after removing stale tracked Codex MCP configuration drift
  with exact-head Fast and Windows/package-smoke evidence.
- [File-Type Support Coverage and Discovery](./closed/filetype-support-coverage-delivery-checklist.md)
  closed with no additional runtime change: PR #46 already proved the requested
  JavaScript-module and fallback-file matrix with exact-head Fast and Windows
  compatibility/package-smoke evidence.
- [README and Docs Diagram Design](./closed/readme-docs-diagram-design.md) is
  closed evidence: both checked-in SVGs and their Excalidraw sources are
  embedded in the public documentation.
- [Global Installation Health and Recovery](./closed/global-install-health-recovery-delivery-checklist.md)
  closed with no source change: the stale published package was superseded by
  `.153`, whose installed artifact and focused recovery contracts prove the
  existing diagnostics and dry-run installer are sufficient.
- [Reversible User-Data Cleanup](./closed/reversible-user-data-cleanup-delivery-checklist.md)
  closed in PR #60 after exact-head Fast CI and local package evidence proved
  archive-first, auditable cache recovery.
- [Release on Main Merge](./closed/release-on-main-merge-delivery-checklist.md)
  closed after `astrograph@0.5.1-alpha.157` published from its immutable merge
  tag; a publish-only retry and existing-tag rerun proved recovery and
  idempotence without expanding the Windows CI cost boundary.
- [Human and Agent Onboarding Packs](./closed/human-agent-onboarding-packs-delivery-checklist.md)
  closed after PR #70 added packed diagnostics coverage, Fast CI passed, and
  `astrograph@0.5.1-alpha.160` was verified as npm `latest`.
- [Process Execution Seam with `execa`](./closed/npm-module-process-execution-delivery-checklist.md)
  closed after PR #72 passed exact-head Fast/package evidence and
  `astrograph@0.5.1-alpha.161` was verified as npm `latest`.
- [Generic Version Handling with `semver`](./closed/npm-module-semver-delivery-checklist.md)
  closed after PR #74 passed exact-head Fast/package evidence and
  `astrograph@0.5.1-alpha.162` was verified as npm `latest`.
- [Registry Lookup with Native `fetch`](./closed/npm-module-registry-lookup-delivery-checklist.md)
  closed after PR #75 passed exact-head Fast/package evidence and
  `astrograph@0.5.1-alpha.163` was verified as npm `latest`.

## Maintaining this roadmap

When selecting work, update this roadmap, `active/README.md`, and `pointer.md`
in the same change. When closing work, move its detailed record to `closed/`
and update this page before selecting the next goal. Do not duplicate task
checklists here; this page links to their single authoritative record.
