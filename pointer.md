# Current Codex Goal

This tracked file is the single entry point for a bare `/goal` request in the
Astrograph repository. Read it before choosing work; do not revive a closed or
deferred story merely because it appears earlier in repository history.
For the full active/ready/parked/descoped/idea/done map, read the
[Delivery Roadmap](./specs/implementation/roadmap.md).

## Current goal

Execute the active [Process Execution Seam with `execa` Delivery
Checklist](./specs/implementation/active/1_npm-module-process-execution-delivery-checklist.md),
starting with its process-contract baseline.

## Required outcome

Replace generic child-process plumbing in the selected scripts only when the
baseline proves `execa` preserves every Astrograph-relevant behavior. Leave
exactly one next goal ready only after this checklist closes.

## Hard boundaries

- Do not implement compact transport, semantic retrieval, Windows work, shared
  artifact reuse, release publication changes, or another npm-module story
  merely because it is listed in an epic.
- Preserve product-specific command, MCP, installer-managed-block, and
  release-decision behavior. Do not turn the process helper into a public API.
- Do not add a shared mutable index, daemon, network synchronization, hidden
  routing, compatibility shim, destructive MCP cache operation, or broad async
  script rewrite.
- Use an isolated worktree for source changes. Require exact-head Fast and
  package-smoke evidence before merging source changes to `main`; hosted
  Windows remains disabled under the cost rule until its explicit re-enable
  condition is met.

## Completion and update rule

When the selected checklist completes, update this file in the same change to
name the next selected checklist. If no next story passes its selection gate,
point to the evidence-gathering checklist rather than guessing.
