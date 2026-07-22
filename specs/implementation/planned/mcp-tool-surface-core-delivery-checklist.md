# MCP Tool-Surface Core Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](../active/high-impact-followups-epic.md), Story 11; routes to [Precision Retrieval and Agent Experience Epic, Story 5](../active/precision-retrieval-agent-experience-epic.md#story-5--small-mcp-core-and-guided-routing)
>
> **Status:** Planned — do not remove, hide, or add tools until the audit shows
> a concrete workflow benefit. Tool-count parity with jCodeMunch is not a goal.

**Goal:** Establish a small, explainable Astrograph MCP core and an evidence-led
advanced-tool policy that makes the preferred discovery-to-task-context flow
easy to choose.

**Architecture:** Retain explicit local-first commands and JSON contracts. A
tool belongs in the core only when a supported workflow needs it early and it
has a distinct intent. Advanced tools stay directly callable and discoverable;
this work must not introduce a generic router, hidden state, automatic tool
selection, remote service, or compatibility aliases for a removed pre-v1 tool.

**Tech Stack:** TypeScript, Node.js 22+, MCP stdio, CLI JSON, Vitest, pnpm, and
the existing command registry/contract tests.

## Task 1: Audit and Select the Smallest Change

**Files:**
- Inspect: `src/command-registry.ts`, `src/mcp-contract.ts`, `src/mcp.ts`,
  `src/cli.ts`, installer guidance, API docs, interface/contract tests
- Create: `docs/reviews/mcp-tool-surface-audit-<date>.md`
- Modify: this checklist only until the gate is met

- [ ] Record every current MCP/CLI tool, its distinct task intent, required
  inputs, response/schema bytes and tokens, core/advanced candidate status,
  active callers, and the workflow it enables.
- [ ] Compare the documented jCodeMunch surface only for patterns that improve
  discoverability or composition; record the source/version and reject any
  count-based target or unverified feature claim.
- [ ] Reproduce at least one tool-selection confusion, redundant composition,
  or schema-overhead problem in Astrograph's supported global workflow.
- [ ] Select the smallest action: retain/document, reclassify, remove a
  redundant pre-v1 tool, or add one concise discovery aid. Do not select a
  generic router without an ADR.

## Task 2: Apply Only the Selected Policy

**Likely files:** `src/command-registry.ts`, `src/mcp-contract.ts`, `src/mcp.ts`,
`src/cli.ts`, `src/scripts/install.ts`, `specs/api-design/mcp-tools.md`,
`specs/api-design/cli-api.md`, retrieval guidance, and focused contract tests.

- [ ] State the core and advanced-tool policy in the audit before changing a
  public contract. Every retained tool needs one distinct workflow intent.
- [ ] Make the smallest direct pre-v1 contract change; remove redundant tools
  rather than adding aliases or compatibility shims.
- [ ] Keep advanced tools directly callable and provide one concise discovery
  path through descriptions or help—not a second tool catalog.
- [ ] Prove MCP/CLI parity, schema-token change, core workflow usability, and
  advanced-tool discoverability with focused tests.
- [ ] Run `pnpm type-lint`, focused interface/contract/CLI tests,
  `pnpm test:package-bin`, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`; record the release decision before commit.
