# Current Codex Goal

This tracked file is the single entry point for a bare `/goal` request in the
Astrograph repository. Read it before choosing work; do not revive a closed or
deferred story merely because it appears earlier in repository history.
For the full active/ready/parked/descoped/idea/done map, read the
[Delivery Roadmap](./specs/implementation/roadmap.md).

## Current goal

No executable implementation checklist is selected. The Token-Efficient Agent
Output checklist and its Precision/Munch epic are closed records.

Before starting another delivery change, choose a ready story through the
[Delivery Roadmap](./specs/implementation/roadmap.md) and move only its
qualified checklist into `specs/implementation/active/`. The remaining
package-confidence evidence checklist is parked behind explicit CI-cost and
third-party-command approval, so it must not be selected automatically.

## Completion and update rule

When a selected checklist completes, update this file in the same change to
name the next selected checklist. If no next story passes its selection gate,
state that no goal is selected and point to the roadmap rather than guessing.
