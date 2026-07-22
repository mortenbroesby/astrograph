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

1. [Global Astrograph Cleanup and Delivery Preparation](./active/global-astrograph-cleanup-preparation-checklist.md)
   - Goal: make one evidence-backed cleanup decision and select exactly one
     next goal, if a selection gate is met.
   - First unchecked task: build the bounded cleanup inventory and baseline.

## Ready — detailed, but not selected

- [Windows/release delivery roadmap](./planned/remaining-delivery-epic.md)
  and its [release-publication checklist](./planned/release-publication-evidence-delivery-checklist.md).
  The release path is built; the last proof requires a release-labelled PR
  merged to `main`.
- Windows audit, filesystem/storage, Git fallback, CLI/package, watch, and
  CI/documentation checklists are available in [planned work](./planned/README.md).
  Select one only for a concrete platform gap or release requirement.
- [File-type support coverage and discovery](./planned/filetype-support-coverage-delivery-checklist.md)
  is ready to verify and document current support, then add only evidenced
  gaps. The present registry already covers `.js`/`.cjs`/`.mjs` with graph
  support and `.md`/`.txt`/`.yaml`/`.yml` with deterministic discovery
  summaries.

## Parked — revisit only with new evidence

- [Global + branch-aware immutable artifact reuse](./planned/global-branch-artifact-reuse-delivery-checklist.md):
  a representative run took 2.044 seconds for both indexes, so the measured
  duplication did not justify cross-repository storage complexity.
- [Global installation health and recovery](./planned/global-install-health-recovery-delivery-checklist.md):
  current preflight, dry-run, idempotent writes, remediation, status, and
  packed-package evidence leave no distinct recovery gap.
- [Compact versioned transport](./planned/precision-retrieval-agent-experience-epic.md#story-4--compact-versioned-transport):
  require a measured need beyond the delivered bounded JSON task context.
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

## Maintaining this roadmap

When selecting work, update this roadmap, `active/README.md`, and `pointer.md`
in the same change. When closing work, move its detailed record to `closed/`
and update this page before selecting the next goal. Do not duplicate task
checklists here; this page links to their single authoritative record.
