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

1. [Release on main merge](./planned/0_release-on-main-merge-delivery-checklist.md)
   - Goal: replace the label-gated release loop with one verified,
     idempotent merge-to-npm transaction.
   - First unchecked task: read the release decision skill and Actions cost
     rule, then record the current workflow baseline.

## Ready — detailed, but not selected

0. [Precision retrieval and agent experience](./planned/1_precision-retrieval-agent-experience-epic.md)
   is the first ready product epic. Select only a specifically scoped next
   story with its own delivery checklist.
2. [npm-module adoption](./planned/2_npm-module-adoption-epic.md) is ready for
   a bounded Slice A evaluation of `execa`, `semver`, and `latest-version`.
   It must preserve product-specific behavior; package-quality gates require a
   CI cost review before selection.
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

## Blocked — external prerequisite only

No planned item is blocked. The release path is a ready design-and-delivery
change, not a reason to wait for a specially labelled PR.

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

## Maintaining this roadmap

When selecting work, update this roadmap, `active/README.md`, and `pointer.md`
in the same change. When closing work, move its detailed record to `closed/`
and update this page before selecting the next goal. Do not duplicate task
checklists here; this page links to their single authoritative record.
