# Current Codex Goal

This tracked file is the single entry point for a bare `/goal` request in the
Astrograph repository. Read it before choosing work; do not revive a closed or
deferred story merely because it appears earlier in repository history.
For the full active/ready/parked/descoped/idea/done map, read the
[Delivery Roadmap](./specs/implementation/roadmap.md).

## Current goal

Execute the active [Global Astrograph Cleanup and Delivery Preparation
Checklist](./specs/implementation/active/global-astrograph-cleanup-preparation-checklist.md),
starting at the first unchecked task.

## Required outcome

Produce an evidence-backed, bounded cleanup decision and leave exactly one
next goal ready to execute. Prefer a small proven cleanup; if none is safe,
record that result and select the smallest missing evidence-gathering task.

## Hard boundaries

- Do not implement deferred global artifact reuse, global-install recovery,
  compact transport, semantic retrieval, Windows work, or release publication
  merely because they are listed in an epic.
- Preserve canonical repository isolation, per-call `repoRoot`, local-first
  storage, and current user privacy.
- Do not add a shared mutable index, daemon, network synchronization, hidden
  routing, compatibility shim, or destructive MCP cache operation.
- Use an isolated worktree for source changes. Require exact-head Fast and
  Windows/package-smoke CI before merging source changes to `main`.

## Completion and update rule

When the selected checklist completes, update this file in the same change to
name the next selected checklist. If no next story passes its selection gate,
point to the evidence-gathering checklist rather than guessing.
