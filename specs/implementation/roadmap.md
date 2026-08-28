# Astrograph Delivery Roadmap

This is the one-page source of truth for delivery status. It provides context
before an agent opens a detailed epic, checklist, or closed record. The root
[`pointer.md`](../../pointer.md) summarizes current focuses; neither document
turns those focuses into an exclusive execution gate.

| Status | Meaning | Agent action |
| --- | --- | --- |
| **Active** | Currently in focus, with an executable checklist. | Use its checklist for scope and verification; it may progress alongside other work. |
| **Ready** | Has a detailed checklist but is not a current focus. | A clear user request may start it; update its status when it becomes sustained work. |
| **Parked** | Evidence says the benefit or problem is not yet sufficient. | Reconsider only when the stated selection gate has new evidence. |
| **Blocked** | Requires an external event or authority. | Record/perform the prerequisite; do not substitute unrelated code work. |
| **Ideas** | Useful direction without an implementation commitment. | Keep out of the execution queue until scoped and selected. |
| **Descoped** | Explicitly outside the current product direction. | Do not reintroduce without an ADR and explicit selection. |
| **Done** | Merged evidence, retained for history. | Read only for context or verification pointers. |

## Active — current focuses

1. [WASM Parser Runtime Migration](./active/11_wasm-parser-runtime-migration.md)
   - Goal: replace native Tree-sitter installation with a packaged WASM parser
     and grammar assets, then prove Linux packaged installs on Node 20 and 24.
2. [Tree-Sitter Polyglot Support Contract](./active/12_tree-sitter-polyglot-support-contract.md)
   - Goal: maintain one explicit, measured 20-language WASM grammar contract
     for the JavaScript/.NET/Java-oriented monorepo set.
## Ready — detailed, but not selected

1. [Node 20–24 Runtime Compatibility](./planned/1_node-20-to-24-runtime-compatibility-epic.md)
   retains non-parser evidence; the active WASM migration owns the proven
   native Tree-sitter Linux installation failure.
2. [npm-module adoption](./planned/2_npm-module-adoption-epic.md) has Stories
   1–3 complete; Stories 4–6 remain parked behind their CI-cost and
   third-party-command evidence gates. Preserve product-specific behavior;
   package-quality gates require an explicit renewed selection.
3. [Windows delivery](./planned/3_remaining-delivery-epic.md) is parked while
   hosted Windows CI is disabled for cost. Its retained child checklists are
   available in [planned work](./planned/README.md) when a concrete platform
   gap, local/container proof, and re-enable budget exist.
4. [Local Daemon Runtime Ownership](./planned/local-daemon-runtime-ownership-delivery-checklist.md)
   is ready only for a reproduced lifecycle, multi-client, isolation, or
   platform gap beyond the delivered runtime-reuse path.
5. [Repository Structure Cleanup](./planned/repository-structure-cleanup-epic.md)
   is ready one behavior-preserving story at a time; workflow changes require
   their existing cost guardrail.
6. [Publishable Workflow Benchmark](./planned/publishable-workflow-benchmark.md)
   is ready after a deliberately selected corpus is clean, snapshot-locked,
   fully successful, and has generated JSON evidence ready to check in.

## Parked — revisit only with new evidence

- [Global + branch-aware immutable artifact reuse](./planned/5_global-branch-artifact-reuse-delivery-checklist.md):
  a representative run took 2.044 seconds for both indexes, so the measured
  duplication did not justify cross-repository storage complexity.
- [Internal artifact serialization efficiency](./closed/precision-retrieval-agent-experience-epic.md#story-10--internal-artifact-serialization-efficiency):
  MessagePack is only a selective internal candidate after measurements compare
  `analysis_artifacts` JSON, deduplicated layout, size, latency, and debuggability.
- [Optional shared immutable artifact store](./planned/6_global-install-and-cache-deferred-stories.md#story-6-shared-immutable-artifact-store--optional-and-deferred):
  never shares mutable repository indexes and remains optional.
- [Package-confidence CI cost review](./planned/4_npm-module-package-confidence-cost-review-checklist.md):
  baseline evidence is recorded, but product priority moved to Incremental
  Freshness Lifecycle before the temporary candidate-CLI evaluation. Resume
  only with explicit approval and a renewed product-priority decision.

## Blocked — external prerequisite only

- `astrograph@0.7.0-alpha.165` has tag `v0.7.0-alpha.165` but is not published:
  post-merge release job `89280716957` received npm `E404`/permission denied.
  Restore npm registry access, then use the existing tagged-release retry; do
  not create another source release or reopen the Munch implementation.

## Ideas — not a commitment

- [Later precision retrieval candidates](./closed/precision-retrieval-agent-experience-epic.md):
  onboarding packs, incremental freshness, optional semantic/hybrid retrieval,
  and honest benchmark/reporting. Each needs its own evidence gate.
- [Spec-system backlog](./planned/7_spec-system-backlog.md): architecture/API
  coverage and authoring consistency.
- [High-impact follow-up history](./planned/4_high-impact-followups-epic.md):
  completed results and deferred candidates; its selection gates remain the
  only route for reopening them.
- [Compact output versus internal serialization assessment](../../docs/reviews/compact-output-vs-internal-serialization-2026-07-22.md):
  ingested roadmap input; it does not select either parked story.
- [`specs/raw/`](../raw/): research inputs only; not a delivery queue.

## Descoped — do not quietly add

- One shared mutable SQLite index or cross-repository source search.
- Network synchronization or hidden source upload.
- Hidden tool routing, generic MCP router, compatibility aliases, or destructive
  MCP cache controls.
- Backward compatibility solely to preserve obsolete pre-v1 cache data.
- Installation/configuration migrations or compatibility paths for obsolete
  pre-v1 Astrograph formats.

These boundaries come from the [high-impact follow-up epic](./planned/4_high-impact-followups-epic.md),
the [global-cache handoff](./planned/6_global-install-and-cache-deferred-stories.md),
and the [MCP contract](../api-design/mcp-tools.md).

## Done — evidence, not queue

- [Closed records](./closed/README.md) contain the completed global install and
  cache, global Codex/Copilot setup, cache cleanup, branch-aware indexing,
  provenance/ranking, task context, tokenizer research, and MCP tool-surface
  deliveries.
- The [completed global-install epic](./closed/global-install-and-cache-epic.md)
  is historical evidence, including its package release.
- [Global Astrograph cleanup preparation](./closed/global-astrograph-cleanup-preparation-checklist.md)
  closed in PR #43 after removing stale tracked Codex MCP configuration drift
  with exact-head Fast and Windows/package-smoke evidence.
- [File-Type Support Coverage and Discovery](./closed/filetype-support-coverage-delivery-checklist.md)
  closed with no additional runtime change: PR #46 already proved the requested
  JavaScript-module and fallback-file matrix with exact-head Fast and Windows
  compatibility/package-smoke evidence.
- [README and Docs Diagram Design](./closed/readme-docs-diagram-design.md) is
  closed evidence: both checked-in SVGs and their Excalidraw sources are
  embedded in the public documentation.
- [Global Installation Health and Recovery](./closed/global-install-health-recovery-delivery-checklist.md)
  closed with no source change: the stale published package was superseded by
  `.153`, whose installed artifact and focused recovery contracts prove the
  existing diagnostics and dry-run installer are sufficient.
- [Reversible User-Data Cleanup](./closed/reversible-user-data-cleanup-delivery-checklist.md)
  closed in PR #60 after exact-head Fast CI and local package evidence proved
  archive-first, auditable cache recovery.
- [Release on Main Merge](./closed/release-on-main-merge-delivery-checklist.md)
  closed after `astrograph@0.5.1-alpha.157` published from its immutable merge
  tag; a publish-only retry and existing-tag rerun proved recovery and
  idempotence without expanding the Windows CI cost boundary.
- [Human and Agent Onboarding Packs](./closed/human-agent-onboarding-packs-delivery-checklist.md)
  closed after PR #70 added packed diagnostics coverage, Fast CI passed, and
  `astrograph@0.5.1-alpha.160` was verified as npm `latest`.
- [Process Execution Seam with `execa`](./closed/npm-module-process-execution-delivery-checklist.md)
  closed after PR #72 passed exact-head Fast/package evidence and
  `astrograph@0.5.1-alpha.161` was verified as npm `latest`.
- [Generic Version Handling with `semver`](./closed/npm-module-semver-delivery-checklist.md)
  closed after PR #74 passed exact-head Fast/package evidence and
  `astrograph@0.5.1-alpha.162` was verified as npm `latest`.
- [Registry Lookup with Native `fetch`](./closed/npm-module-registry-lookup-delivery-checklist.md)
  closed after PR #75 passed exact-head Fast/package evidence and
  `astrograph@0.5.1-alpha.163` was verified as npm `latest`.
- [Incremental Freshness Lifecycle](./closed/incremental-freshness-lifecycle-delivery-checklist.md)
  closed after PR #77 merged with exact-head and post-merge Fast/package/MCP
  evidence; `astrograph@0.6.0-alpha.164` published from `v0.6.0-alpha.164`.
- [Token-Efficient Agent Output](./closed/token-efficient-agent-output-delivery-checklist.md)
  closed after PR #79 merged `3a8fa04`, passing exact-head and merged-main Fast
  checks. The public `agc1` contract and benchmark show 55.6–66.7% savings for
  measured selected MCP envelopes; npm publication is recorded above as blocked.
- [Precision Retrieval and Agent Experience Epic](./closed/precision-retrieval-agent-experience-epic.md)
  — closed after Story 4 completed the measured agent-visible token-efficiency
  end-cap in PR #79.
- [Session-Aware Agent Efficiency Epic](./closed/session-aware-agent-efficiency-epic.md)
  — closed after PR #99 merged exact references and local Astrograph reporting,
  explicit bookmarks, and optional marked output redaction.
- [Comforting Install Experience](./closed/comforting-global-install-experience.md)
  — closed after PR #82 made package, global, and repository setup legible
  without automatic configuration writes.
- [Guided Install and Refresh Hooks](./closed/guided-install-and-refresh-hooks.md)
  — closed after PR #92 delivered unified onboarding, opt-in guidance/hooks,
  and harness readiness checks.
- [MCP Runtime Hygiene](./closed/mcp-runtime-hygiene-delivery-checklist.md)
  — closed after PR #90 added source-free process presence and idempotent
  resource cleanup.
- [Git Ref Watch Reconciliation](./closed/git-ref-watch-reconciliation-delivery-checklist.md)
  — closed after PR #94 added session-bound checkout-change reconciliation.
- [Local Token-Savings Analytics](./closed/local-token-savings-analytics-delivery-checklist.md)
  — closed after PR #101 exposed exact local savings without request-path
  tracking overhead.
- [VoidZero Toolchain](./closed/voidzero-toolchain-epic.md)
  — closed after PR #105 migrated the package build to tsdown and completed
  the scoped runtime, alias, and Oxlint evidence gates.
- [Runtime Acceleration](./closed/runtime-acceleration-epic.md) — closed with
  direct daemon indexing, serialized repository work, and measured warm-run
  evidence.
- [Interactive Install Lifecycle](./closed/interactive-install-lifecycle-epic.md)
  — superseded by the completed Pre-v1 clean-install contract.
- [Pre-v1 Clean Install Contract](./closed/pre-v1-clean-install-contract-epic.md)
  — closed after PR #127 merged as `1bed0cb`, required and guarded release
  workflows passed, and `astrograph@0.11.4-alpha.214` was verified from npm.

## Maintaining this roadmap

When a work item's status changes, update this roadmap and the relevant
implementation index; update `pointer.md` when its focus summary also changes.
When closing work, move its detailed record to `closed/` and update this page.
Do not duplicate task checklists here; this page links to their single
authoritative record.
