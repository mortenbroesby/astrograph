# Current Codex Goal

This tracked file is the single entry point for a bare `/goal` request in the
Astrograph repository. Read it before choosing work; do not revive a closed or
deferred story merely because it appears earlier in repository history.
For the full active/ready/parked/descoped/idea/done map, read the
[Delivery Roadmap](./specs/implementation/roadmap.md).

## Current goal

Execute the active [Token-Efficient Agent Output Delivery
Checklist](./specs/implementation/active/4_token-efficient-agent-output-delivery-checklist.md),
starting with deterministic agent-visible MCP envelope and tokenizer baselines.

## Required outcome

Deliver a measured, lossless, agent-visible response-token reduction for the
selected MCP result shapes while ordinary JSON remains the safe default.

## Hard boundaries

- Do not implement binary transport, semantic retrieval, Windows work, shared
  artifact reuse, a daemon, remote synchronization, hidden routing, or a
  shared mutable index.
- Preserve ordinary JSON as default, strict MCP v1 errors, inspectable
  lossless decoding, explicit format fallback, and existing source-token
  accounting.
- Do not claim token savings without measuring the actual agent-visible
  envelope, declared tokenizer count, and encode/decode latency.

## Completion and update rule

When the selected checklist completes, update this file in the same change to
name the next selected checklist. If no next story passes its selection gate,
point to the evidence-gathering checklist rather than guessing.
