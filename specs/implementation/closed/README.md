# Closed Implementation Records

This directory preserves completed, superseded, and historical implementation
records. These documents are evidence and design context; they are not active
work queues. Any remaining follow-up is linked to an active or planned epic.

## Completed Delivery Records

- [Astrograph Feedback Consolidation Epic](./astro-feedback-epic.md) and its
  [delivery checklist](./astro-feedback-delivery-checklist.md)
- [Branch-Aware Incremental Index Epic](./branch-aware-incremental-index-epic.md),
  [mapping plan](./branch-aware-incremental-index-plan.md), and
  [delivery checklist](./branch-aware-incremental-index-delivery-checklist.md)
- [Node 22 Compatibility Epic](./node-22-compatibility-epic.md) and its
  [delivery checklist](./node-22-compatibility-delivery-checklist.md)
- [Windows Platform Support Epic](./windows-platform-support-epic.md) — its
  unstarted stories were consolidated into the active delivery epic.
- [Staff Engineer Review Delivery Checklist](./staff-engineering-review-delivery-checklist.md)
  — completed and merged as PR #3.
- [MCP v1 Hard-Switch Plan](./mcp-v1-hard-switch-plan.md)
- [Source Architecture Refactor Plan](./src-architecture-refactor-plan.md)
- [Global Install and Cache Epic](./global-install-and-cache-epic.md) —
  implemented, CI-verified, and published as `astrograph@0.4.4-alpha.133`.
- [Global Storage Contract Delivery Checklist](./global-storage-contract-delivery-checklist.md)
  — implemented in the Global Install and Cache Epic.
- [Pain-Free Global Install Delivery Checklist](./pain-free-global-install-delivery-checklist.md)
  — merged as PR #28 after exact-head Fast and Windows/package smoke evidence.
- [Checkout and Cache Transparency Delivery Checklist](./global-checkout-cache-transparency-delivery-checklist.md)
  — merged as PR #24 after exact-head Fast and Windows compatibility evidence.
- [Provenance-First Symbol Contract Delivery Checklist](./provenance-first-symbol-contract-delivery-checklist.md)
  and [Deterministic Lexical Ranking Delivery Checklist](./deterministic-lexical-ranking-delivery-checklist.md)
  — delivered together in PR #26 with exact-head Fast and Windows evidence.
- [Global Copilot CLI Delivery Checklist](./global-copilot-cli-delivery-checklist.md)
  — merged as PR #29 after exact-head Fast and Windows/package smoke evidence.
- [Pre-v1 Cache and Codebase Cleanup Delivery Checklist](./pre-v1-cache-codebase-cleanup-delivery-checklist.md)
  — merged as PR #30 after exact-head Fast and Windows/package smoke evidence.
- [Token-Budgeted Task Context Delivery Checklist](./token-budgeted-task-context-delivery-checklist.md)
  — merged as PR #34 after exact-head Fast and Windows/package smoke evidence.
- [Tokenizer and Token-Estimator Research Delivery Checklist](./tokenizer-estimator-research-delivery-checklist.md)
  — merged as PR #36 after exact-head Fast and Windows/package smoke evidence;
  retained the existing exact tokenizer and labelled estimate.
- [MCP Tool-Surface Core Delivery Checklist](./mcp-tool-surface-core-delivery-checklist.md)
  — merged as PR #39 after exact-head Fast and Windows/package smoke evidence;
  documented the core/specialized policy and corrected generated client-tool
  visibility.
- [Global Astrograph Cleanup and Delivery Preparation Checklist](./global-astrograph-cleanup-preparation-checklist.md)
  — merged as PR #43 after exact-head Fast and Windows/package-smoke evidence;
  removed stale tracked Codex MCP configuration drift and selected the next
  file-type coverage goal.
- [File-Type Support Coverage and Discovery Delivery Checklist](./filetype-support-coverage-delivery-checklist.md)
  — closed with no additional runtime change after confirming the requested
  JavaScript-module and discovery-only extension matrix in PR #46.
- [README and Docs Diagram Design](./readme-docs-diagram-design.md) — closed
  after verifying the tracked Excalidraw/SVG assets and Markdown embeds.
- [Global Installation Health and Recovery Delivery Checklist](./global-install-health-recovery-delivery-checklist.md)
  — closed with no source change after verifying the published `.153` package,
  diagnostics, dry-run, and focused Copilot CLI recovery contracts.
- [Reversible User-Data Cleanup Delivery Checklist](./reversible-user-data-cleanup-delivery-checklist.md)
  — merged as PR #60 after archive-first cleanup, deterministic failure-injection
  coverage, and exact-head Fast/package/MCP smoke evidence.
- [Release on Main Merge Delivery Checklist](./release-on-main-merge-delivery-checklist.md)
  — closed after merge SHA `af943739` published as `astrograph@0.5.1-alpha.157`,
  with the publish-only retry and existing-tag rerun proving the guarded path.
- [Human and Agent Onboarding Packs Delivery Checklist](./human-agent-onboarding-packs-delivery-checklist.md)
  — closed after PR #70 added packed-package diagnostics coverage and
  `astrograph@0.5.1-alpha.160` published from its immutable merge tag.
- [Process Execution Seam with `execa` Delivery Checklist](./npm-module-process-execution-delivery-checklist.md)
  — closed after PR #72 passed exact-head package/CI evidence and
  `astrograph@0.5.1-alpha.161` published from its immutable merge tag.
- [Generic Version Handling with `semver` Delivery Checklist](./npm-module-semver-delivery-checklist.md)
  — closed after PR #74 passed exact-head Fast/package evidence and
  `astrograph@0.5.1-alpha.162` published from its immutable merge tag.
- [Registry Lookup with Native `fetch` Delivery Checklist](./npm-module-registry-lookup-delivery-checklist.md)
  — closed after PR #75 passed exact-head Fast/package evidence and
  `astrograph@0.5.1-alpha.163` published from its immutable merge tag.
- [Incremental Freshness Lifecycle Delivery Checklist](./incremental-freshness-lifecycle-delivery-checklist.md)
  — closed after PR #77, exact-head/post-merge Fast and package/MCP evidence,
  and publication of `astrograph@0.6.0-alpha.164`.
- [Token-Efficient Agent Output Delivery Checklist](./token-efficient-agent-output-delivery-checklist.md)
  — closed after PR #79 merged `agc1` compact MCP output with exact-head and
  merged-main Fast evidence. Its `v0.7.0-alpha.165` tag exists; npm publication
  is separately recorded as a registry-permission recovery item.
- [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md)
  — closed after its required Story 4 end-cap merged in PR #79.
