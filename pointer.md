# Current Codex Goal

This tracked file is the single entry point for a bare `/goal` request in the
Astrograph repository. Read it before choosing work; do not revive a closed or
deferred story merely because it appears earlier in repository history.
For the full active/ready/parked/descoped/idea/done map, read the
[Delivery Roadmap](./specs/implementation/roadmap.md).

## Current goal

Execute the active [Human and Agent Onboarding Packs Delivery
Checklist](./specs/implementation/active/0_human-agent-onboarding-packs-delivery-checklist.md),
starting with the audited setup baseline.

## Required outcome

Produce evidence-backed, safe first-time setup and recovery guidance for human
and agent users. Measure the existing behavior before changing it; leave
exactly one next goal ready only after this checklist closes.

## Hard boundaries

- Do not implement compact transport, semantic retrieval, Windows work, shared
  artifact reuse, or unrelated release publication merely because they are
  listed in an epic.
- Preserve canonical repository isolation, per-call `repoRoot`, local-first
  storage, and current user privacy.
- Do not add a shared mutable index, daemon, network synchronization, hidden
  routing, compatibility shim, or destructive MCP cache operation.
- Use an isolated worktree for source changes. Require exact-head Fast and
  package-smoke evidence before merging source changes to `main`; hosted
  Windows remains disabled under the cost rule until its explicit re-enable
  condition is met.

## Completion and update rule

When the selected checklist completes, update this file in the same change to
name the next selected checklist. If no next story passes its selection gate,
point to the evidence-gathering checklist rather than guessing.
