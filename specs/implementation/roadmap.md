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

1. [Tree-Sitter Polyglot Language Support](./active/1_tree-sitter-polyglot-language-support-delivery-checklist.md)
   - Goal: expand from JavaScript-family parsing to the bounded set of parsers
     listed by Tree-sitter's upstream organization.
   - First action: freeze the package/ABI/extension/licence inventory and the
     current four-language baseline before adding a grammar dependency.
   - Architecture: adapters and explicit `structured`/`graph` support tiers;
     do not claim the open-ended community grammar ecosystem.
2. [MCP Runtime Hygiene Delivery Checklist](./active/mcp-runtime-hygiene-delivery-checklist.md)
   - Goal: make abandoned stdio MCP processes visible and release
     process-lifetime resources during normal shutdown.
3. [Comforting Install Experience](./active/2_comforting-global-install-experience.md)
   - Goal: make global and repository-local setup understandable without
     hidden configuration writes.
4. [Git Ref Watch Reconciliation](./active/3_git-ref-watch-reconciliation-delivery-checklist.md)
   - Goal: reconcile an active watch session when its Git checkout identity
     advances or changes without dependable filesystem events.
   - Architecture: a session-bound 30-second checkout probe queues existing
     folder reconciliation; no daemon, Git-diff planner, or cache migration.
5. [Local Daemon Runtime Ownership](./active/5_local-daemon-runtime-ownership-delivery-checklist.md)
   - Goal: one user-local daemon owns independent repository runtimes, watches,
     SQLite connections, and workers for concurrent stdio MCP clients.
   - Architecture: on-demand local IPC proxying with authenticated singleton
     ownership and a five-minute idle exit; no network listener, source upload,
     or shared mutable repository index.
6. [Session-Aware Repeat-Read Trace Delivery](./active/session-aware-repeat-read-trace-delivery-checklist.md)
   - Goal: establish the deterministic repeat-read baseline before selecting
     any session-aware response behavior.
   - Architecture: extend the existing compact-output fixture corpus and
     source-free JSON report; no serving contract, session state, daemon, or
     output-format change.
7. [Session Content-Reference Contract Delivery](./active/session-content-reference-contract-delivery-checklist.md)
   - Goal: add a bounded, capability-gated reference for full JSON responses.
   - Architecture: process-local opaque IDs and SHA-256 metadata only; no
     source persistence, delta transport, new MCP tool, or daemon migration.

## Ready — detailed, but not selected

2. [npm-module adoption](./planned/2_npm-module-adoption-epic.md) has Stories
   1–3 complete; Stories 4–6 remain parked behind their CI-cost and
   third-party-command evidence gates. Preserve product-specific behavior;
   package-quality gates require an explicit renewed selection.
3. [Windows delivery](./planned/3_remaining-delivery-epic.md) is parked while
   hosted Windows CI is disabled for cost. Its retained child checklists are
   available in [planned work](./planned/README.md) when a concrete platform
   gap, local/container proof, and re-enable budget exist.
4. [Session-Aware Agent Efficiency Epic](./planned/8_session-aware-agent-efficiency-epic.md)
   has Story 1 active. Session state, deltas, dossiers, privacy reporting, and
   bookmarks remain independently gated by measured benefit and local-first
   safety boundaries.

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

## Maintaining this roadmap

When a work item's status changes, update this roadmap and the relevant
implementation index; update `pointer.md` when its focus summary also changes.
When closing work, move its detailed record to `closed/` and update this page.
Do not duplicate task checklists here; this page links to their single
authoritative record.
