# Current Codex Goal

This tracked file is the single entry point for a bare `/goal` request in the
Astrograph repository. Read it before choosing work; do not revive a closed or
deferred story merely because it appears earlier in repository history.
For the full active/ready/parked/descoped/idea/done map, read the
[Delivery Roadmap](./specs/implementation/roadmap.md).

## Current goal

Execute the active [Registry Lookup with `latest-version` Delivery
Checklist](./specs/implementation/active/3_npm-module-registry-lookup-delivery-checklist.md),
starting with its lookup and failure-policy baseline.

## Required outcome

Replace only generic npm registry-version lookup when the baseline proves
`latest-version` can preserve Astrograph's explicit unavailable-registry
refusal, installer update wording, timeout behavior, and release-safety
transaction. Leave exactly one next goal ready only after this checklist closes.

## Hard boundaries

- Do not implement compact transport, semantic retrieval, Windows work, shared
  artifact reuse, release publication changes, or another npm-module story
  merely because it is listed in an epic.
- Preserve Astrograph's custom alpha-increment, legacy-baseline,
  release-decision, registry-unavailable, and installer-recovery behavior. Do
  not replace release policy with a dependency or turn lookup helpers into a
  public API.
- Do not add a shared mutable index, daemon, network synchronization, hidden
  routing, compatibility shim, destructive MCP cache operation, registry
  selection change, or broad release-policy redesign.
- Use an isolated worktree for source changes. Require exact-head Fast and
  package-smoke evidence before merging source changes to `main`; hosted
  Windows remains disabled under the cost rule until its explicit re-enable
  condition is met.

## Completion and update rule

When the selected checklist completes, update this file in the same change to
name the next selected checklist. If no next story passes its selection gate,
point to the evidence-gathering checklist rather than guessing.
