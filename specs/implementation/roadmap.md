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

1. [File-Type Support Coverage and Discovery](./active/filetype-support-coverage-delivery-checklist.md)
   - Goal: verify/document current JavaScript-module and fallback-file support,
     then add only evidence-backed missing extensions.
   - First unchecked task: reproduce and classify the requested support.

## Ready — detailed, but not selected

- [Windows/release delivery roadmap](./planned/remaining-delivery-epic.md)
  and its [release-publication checklist](./planned/release-publication-evidence-delivery-checklist.md).
  The release path is built; the last proof requires a release-labelled PR
  merged to `main`.
- Windows audit, filesystem/storage, Git fallback, CLI/package, watch, and
  CI/documentation checklists are available in [planned work](./planned/README.md).
  Select one only for a concrete platform gap or release requirement.

## Parked — revisit only with new evidence

- [Global + branch-aware immutable artifact reuse](./planned/global-branch-artifact-reuse-delivery-checklist.md):
  a representative run took 2.044 seconds for both indexes, so the measured
  duplication did not justify cross-repository storage complexity.
- [Global installation health and recovery](./planned/global-install-health-recovery-delivery-checklist.md):
  current preflight, dry-run, idempotent writes, remediation, status, and
  packed-package evidence leave no distinct recovery gap.
- [Compact versioned transport](./planned/precision-retrieval-agent-experience-epic.md#story-4--compact-versioned-transport):
  measure complete agent-visible MCP envelopes before selecting an opt-in,
  versioned compact JSON format for repetitive result shapes.
- [Internal artifact serialization efficiency](./planned/precision-retrieval-agent-experience-epic.md#story-10--internal-artifact-serialization-efficiency):
  MessagePack is only a selective internal candidate after measurements compare
  `analysis_artifacts` JSON, deduplicated layout, size, latency, and debuggability.
- [Optional shared immutable artifact store](./planned/global-install-and-cache-deferred-stories.md#story-6-shared-immutable-artifact-store--optional-and-deferred):
  never shares mutable repository indexes and remains optional.

## Blocked — external prerequisite only

- [Automatic release-publication evidence](./planned/release-publication-evidence-delivery-checklist.md):
  requires a release-labelled PR merged to `main`, then recorded version commit,
  tag, CI, and trusted npm publication evidence.

## Ideas — not a commitment

- [Later precision retrieval candidates](./planned/precision-retrieval-agent-experience-epic.md):
  onboarding packs, incremental freshness, optional semantic/hybrid retrieval,
  and honest benchmark/reporting. Each needs its own evidence gate.
- [Spec-system backlog](./planned/spec-system-backlog.md): architecture/API
  coverage and authoring consistency.
- [README/document diagram design](./planned/2026-05-06-readme-diagrams-design.md):
  visual-documentation completion, not product delivery.
- [Compact output versus internal serialization assessment](../../docs/reviews/compact-output-vs-internal-serialization-2026-07-22.md):
  ingested roadmap input; it does not select either parked story.
- [`specs/raw/`](../raw/): research inputs only; not a delivery queue.

## Descoped — do not quietly add

- One shared mutable SQLite index or cross-repository source search.
- A background daemon, network synchronization, or hidden source upload.
- Hidden tool routing, generic MCP router, compatibility aliases, or destructive
  MCP cache controls.
- Backward compatibility solely to preserve obsolete pre-v1 cache data.

These boundaries come from the [high-impact follow-up epic](./planned/high-impact-followups-epic.md),
the [global-cache handoff](./planned/global-install-and-cache-deferred-stories.md),
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

## Maintaining this roadmap

When selecting work, update this roadmap, `active/README.md`, and `pointer.md`
in the same change. When closing work, move its detailed record to `closed/`
and update this page before selecting the next goal. Do not duplicate task
checklists here; this page links to their single authoritative record.
