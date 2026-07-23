# Current Codex Goal

This tracked file is the single entry point for a bare `/goal` request in the
Astrograph repository. Read it before choosing work; do not revive a closed or
deferred story merely because it appears earlier in repository history.
For the full active/ready/parked/descoped/idea/done map, read the
[Delivery Roadmap](./specs/implementation/roadmap.md).

## Current goal

Execute the active [Incremental Freshness Lifecycle Delivery
Checklist](./specs/implementation/active/7_incremental-freshness-lifecycle-delivery-checklist.md),
starting with the current refresh, checkout, watch, and diagnostics baseline.

## Required outcome

Make Astrograph's local retrieval freshness correct and observable after real
repository changes. Establish the measured contract before selecting the
smallest incremental invalidation and diagnostics slice.

## Hard boundaries

- Do not implement compact transport, semantic retrieval, Windows work, shared
  artifact reuse, a daemon, remote synchronization, hidden routing, or a
  shared mutable index.
- Preserve canonical paths, content hashes, checkout mappings, explicit
  freshness states, single-writer SQLite transactions, and full refresh as a
  safe fallback.
- Do not claim an index is fresh after a failed Git, filesystem, or watcher
  probe. Expose the fallback reason through the existing diagnostics surface.

## Completion and update rule

When the selected checklist completes, update this file in the same change to
name the next selected checklist. If no next story passes its selection gate,
point to the evidence-gathering checklist rather than guessing.
