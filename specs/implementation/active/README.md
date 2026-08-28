# Current Implementation Focuses

This directory contains implementation work currently in focus. Its checklists
are the authoritative detail for their own scope and verification, but this is
not an exclusive authorization queue: multiple focuses may proceed at once,
and a clear user request may concern another roadmap item.

Completed evidence belongs in `../closed/`; deferred candidates belong in
`../planned/`. Check the [Delivery Roadmap](../roadmap.md) and
[`pointer.md`](../../../pointer.md) before starting unspecified work so that
new work complements rather than duplicates existing plans.

## Current focuses

1. [WASM Parser Runtime Migration](./11_wasm-parser-runtime-migration.md)
   — remove the native Tree-sitter install boundary and prove packed global
   installs on Node 20, 22, and 24. Current-main Node 24 Linux package proof
   is recorded; Node 20 hosted proof remains separately pending.
2. [Tree-Sitter Polyglot Support Contract](./12_tree-sitter-polyglot-support-contract.md)
   — reconcile the released 20-language WASM parser set with one public,
   measured registry contract and explicit exclusions.
The [2026-07-29 open-epic reconciliation](../closed/open-epic-reconciliation-2026-07-29.md)
records why the former active plans are closed, superseded, or ready rather than
active.

Use the [Delivery Roadmap](../roadmap.md) to understand planned, parked,
descoped, idea, and completed work. Update the roadmap, this index, and the
pointer when a work item's status or the current-focus summary materially
changes; do not make a mechanical pointer update a prerequisite for a valid
user-requested change.
