# Planned Implementation Work

This directory contains approved but unstarted work. A planned epic is not an
active delivery commitment: select it explicitly, create its delivery
checklist, and then move it to `../active/` before implementation begins.

## Backlog

- [Delivery Roadmap](../roadmap.md) — the canonical status dashboard; this
  directory holds only the detailed records behind its ready, parked, and idea
  categories.
- [Reduce Astrograph Boilerplate with Proven npm Modules](./npm-module-adoption-epic.md)
  — approved, dependency-ordered adoption of generic process, semver, registry,
  package-quality, dependency-drift, and boundary tooling; it preserves
  Astrograph-specific product behavior.
- [High-Impact Product Follow-Ups Epic](./high-impact-followups-epic.md) —
  completed results plus deferred global/release candidates; no story is
  currently selected.
- [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md)
  — later retrieval candidates; Stories 1–3 and 5 are closed. Compact MCP
  output and MessagePack internal serialization are separately parked there.
- [Remaining Delivery Epic](./remaining-delivery-epic.md) — Windows support
  and release-publication evidence remain planned; its Staff Engineer review
  is closed.
- [Release Publication Evidence Delivery Checklist](./release-publication-evidence-delivery-checklist.md)
  — deferred final proof for automatic release-labelled-PR publication.
- Windows delivery checklists — deferred until explicitly selected:
  [audit](./windows-compatibility-audit-delivery-checklist.md),
  [filesystem/storage](./windows-filesystem-storage-portability-delivery-checklist.md),
  [Git fallback](./windows-git-discovery-fallback-delivery-checklist.md),
  [CLI/MCP/package](./windows-cli-mcp-package-invocation-delivery-checklist.md),
  [watch/refresh](./windows-watch-refresh-delivery-checklist.md), and
  [CI/docs/release](./windows-ci-documentation-release-gate-delivery-checklist.md).
- [README and Docs Diagram Design](./2026-05-06-readme-diagrams-design.md) —
  the checked-in diagrams are embedded; the design pass still needs its
  verification criteria recorded as complete before it can be closed.
- [Spec System Backlog](./spec-system-backlog.md) — outstanding architecture,
  API-contract, and implementation-plan documentation coverage.
- [Global Install and Cache Deferred Story Handoffs](./global-install-and-cache-deferred-stories.md)
  — only Story 6's optional shared immutable artifact store remains deferred;
  it is not authorized for implementation.
- [Reversible User-Data Cleanup Delivery Checklist](./reversible-user-data-cleanup-delivery-checklist.md)
  — archive-first safety contract for cache cleanup and recovery; ready but not
  selected.
- Deferred high-impact checklist — [global/branch immutable artifact
  reuse](./global-branch-artifact-reuse-delivery-checklist.md) has recorded
  negative evidence and must not be revived without its selection gate.
