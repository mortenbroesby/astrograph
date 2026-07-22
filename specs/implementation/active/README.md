# Active Implementation Work

This directory contains selected delivery work. A selected checklist is the
only authorized implementation queue; completed evidence belongs in
`../closed/` and deferred candidates belong in `../planned/`.

## Current Queue

1. [Global Astrograph Cleanup and Delivery Preparation](./global-astrograph-cleanup-preparation-checklist.md)
   — selected documentation and codebase-hygiene preparation. It must produce
   a bounded cleanup decision and point to the next evidence-gated delivery
   story; it does not authorize global-cache behavior changes by itself.

- [High-Impact Product Follow-Ups Epic](./high-impact-followups-epic.md) —
  Stories 1, 2, and 6 are deferred; Stories 3, 4, 5, 7, 8, 9, 10, and 11 are
  closed. Compact transport remains deferred pending a separately measured need.
- [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md)
  — Stories 1–3 are closed; later candidate stories require their own evidence
  gates before selection.

The completed [Global Install and Cache Epic](../closed/global-install-and-cache-epic.md) is
historical evidence, including its successful package release.

Deferred global-reuse and install-health checklists live in `../planned/`; do
not implement either without its documented selection gate.

Do not start planned work from `../planned/` until it is explicitly selected.
Closed records in `../closed/` are historical evidence, not execution queues.
