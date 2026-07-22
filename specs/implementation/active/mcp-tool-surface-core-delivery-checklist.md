# MCP Tool-Surface Core Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](./high-impact-followups-epic.md), Story 11; routes to [Precision Retrieval and Agent Experience Epic, Story 5](./precision-retrieval-agent-experience-epic.md#story-5--small-mcp-core-and-guided-routing)
>
> **Status:** Active — the audit selected a generated-client visibility fix;
> no removal, router, or hidden tier is authorized.

**Goal:** Establish a small, explainable Astrograph MCP core and an
evidence-led advanced-tool policy that makes the preferred discovery-to-task
context flow easy to choose.

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
- Created: `docs/reviews/mcp-tool-surface-audit-2026-07-22.md`
- Modified: this checklist and the linked API/retrieval docs

- [x] Record every current MCP/CLI tool, its distinct task intent, required
  inputs, response/schema bytes and tokens, core/advanced candidate status,
  active callers, and the workflow it enables.
- [x] Compare the documented jCodeMunch surface only for patterns that improve
  discoverability or composition; record the source/version and reject any
  count-based target or unverified feature claim.
- [x] Reproduce an actual confusion: generated client policy referenced four
  tools excluded by its generated global allowlist.
- [x] Select the smallest action: retain every tool, expose the contract-derived
  list in generated clients, and document core versus specialized use. Do not
  select a generic router.

## Task 2: Apply the Selected Policy

**Files:** `src/scripts/install.ts`, `tests/engine-contract.test.ts`,
`specs/api-design/mcp-tools.md`, `docs/guides/retrieval-workflows.md`, and the
audit above.

- [x] State the core and specialized-tool policy in the audit before changing a
  public contract. Every retained tool has one distinct workflow intent.
- [x] Make the smallest direct pre-v1 contract change: derive generated client
  tool lists from `MCP_TOOL_DEFINITIONS`; do not remove tools or add shims.
- [x] Keep specialized tools directly callable and provide concise workflow
  guidance rather than a second tool catalog.
- [ ] Prove MCP/CLI parity, schema-token impact, core workflow usability, and
  specialized-tool discoverability with focused tests.
- [ ] Run `pnpm type-lint`, focused interface/contract/CLI tests,
  `pnpm test:package-bin`, `pnpm check:version-bump`, `pnpm release:plan`, and
  `git diff --check`; record the release decision before commit.
