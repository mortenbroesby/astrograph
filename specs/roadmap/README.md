# Astrograph Roadmap

This directory turns the raw jCodeMunch comparison into current, actionable
Astrograph work. It is the planning layer between long-lived specs and concrete
implementation plans.

## Source Material

- [Raw Astrograph/jCodeMunch Agent Spec](../raw/astrograph_jcodemunch_agent_spec.md) - Broad analysis and original workstream catalog.
- [MCP Tools API Spec](../api-design/mcp-tools.md) - Current MCP v1 public contract.
- [Completed MCP v1 Hard-Switch Plan](../implementation/done/mcp-v1-hard-switch-plan.md) - What has already shipped from the raw spec.

## Roadmap Documents

- [Agent Parity Roadmap](./agent-parity-roadmap.md) - Current next chunks for retrieval quality, stable identity, graph tools, compact output, runtime profiles, language adapters, and agent lifecycle work.

## Roadmap Rules

- Roadmap docs describe sequencing and acceptance criteria, not step-by-step code edits.
- Once a roadmap chunk is selected, create an executable plan under `specs/implementation/`.
- Completed implementation plans move to `specs/implementation/done/`; completed roadmap chunks stay checked off here until the roadmap is rewritten.
- Keep `specs/raw/` as source material, not the active queue.
