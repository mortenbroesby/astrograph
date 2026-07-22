# MCP Tool-Surface Core Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](../active/high-impact-followups-epic.md), Story 11; routes to [Precision Retrieval and Agent Experience Epic, Story 5](../active/precision-retrieval-agent-experience-epic.md#story-5--small-mcp-core-and-guided-routing)
>
> **Status:** Complete — merged as PR #39 (`54971f6`) after Fast required
> checks and Windows compatibility/package smoke passed for the exact PR head
> `d432b6a`.

**Goal:** Establish a small, explainable Astrograph MCP core and an
evidence-led advanced-tool policy that makes the preferred discovery-to-task
context flow easy to choose.

## Delivered Selection

- [x] Audited all 14 MCP tools and five CLI-only commands, including distinct
  workflow intent, inputs, and live serialized schema cost.
- [x] Recorded the 14-tool `tools/list` baseline (7,516 bytes / 1,520
  `cl100k_base` tokens) and the former generated-client subset (5,476 bytes /
  1,101 tokens) in the [audit](../../../docs/reviews/mcp-tool-surface-audit-2026-07-22.md).
- [x] Compared jCodeMunch only for documented discoverability patterns. Its
  60+-tool tier/router design was explicitly rejected: no count target, hidden
  selection, router, aliases, or new service was introduced.
- [x] Reproduced and fixed the real global-workflow contradiction: generated
  policy named `get_project_status`, `find_files`, `search_text`, and
  `get_file_summary` while generated Codex/Copilot configuration excluded them.
- [x] Derived generated-client tool lists from `MCP_TOOL_DEFINITIONS`, keeping
  every MCP v1 tool directly callable; the preferred core is documented
  guidance and the three raw fallbacks remain specialized direct tools.
- [x] Updated the MCP contract, retrieval workflow guide, review index, and
  implementation status indexes.

## Verification Evidence

- [x] Focused `tests/interface.test.ts` MCP contract and global Codex/Copilot
  installer regression tests passed locally.
- [x] `pnpm type-lint`, `pnpm check:version-bump`, and `git diff --check`
  passed before commit.
- [x] PR #39 exact-head Fast required checks and Windows compatibility,
  including package smoke, passed before merge.

**Release decision:** Runtime-compatible pre-v1 installer correction; version
advanced to `0.5.0-alpha.143`. The local release planner could not query npm,
so publishing remained the guarded main-only CI flow.
