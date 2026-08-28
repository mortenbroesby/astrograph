# Current Focus

This tracked file is a quick orientation point for work in the Astrograph
repository. Read it before choosing unspecified work, then use the user's
request and the [Delivery Roadmap](./specs/implementation/roadmap.md) to set
scope. It is not an exclusive queue or authorization gate: multiple focuses
can progress at once, and a clear request can legitimately concern other work.

Do not revive a closed or deferred story merely because it appears in history;
use its recorded evidence or selection gate instead.

## Current focuses

- [WASM Parser Runtime Migration](./specs/implementation/active/11_wasm-parser-runtime-migration.md)
  — remove the native Tree-sitter install boundary and prove packed global
  installs on Node 20, 22, and 24. Current-main Node 24 proof is recorded;
  Node 20 hosted proof remains the deliberately deferred compatibility follow-up.

The [open-epic reconciliation record](./specs/implementation/closed/open-epic-reconciliation-2026-07-29.md)
lists the ready follow-ups and their selection gates.

## Keeping this useful

Update this summary when the current focus materially changes. Update the
roadmap and implementation indexes when a work item's status changes, but do
not require a pointer update for every implementation change or force a
successor before completing unrelated work.
