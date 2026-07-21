# High-Impact Product Follow-Ups Epic

> **Status:** Active — Stories 1, 2, and 6 are evidence-backed deferrals;
> Stories 3, 4, 7, 8, and 9 are complete and CI-verified. Story 5 is the only
> remaining candidate and requires its own payload/relevance selection evidence
> before it becomes active work.
>
> **Builds on:** the completed [Global Install and Cache Epic](../closed/global-install-and-cache-epic.md),
> [Branch-Aware Incremental Index Epic](../closed/branch-aware-incremental-index-epic.md),
> and [Astrograph Feedback Consolidation Epic](../closed/astro-feedback-epic.md).
> It complements—rather than replaces—the [Remaining Delivery Epic](../planned/remaining-delivery-epic.md)
> and [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md).

**Goal:** Turn the largest completed platform investments into the next
meaningful user outcomes: faster safe work across repositories and checkouts,
reliable global setup, and more trustworthy retrieval. Order work by expected
user impact, then by the evidence needed to justify its cost and complexity.

**Architecture:** Preserve the current local-first model: repository-specific
mutable state, optional Git enrichment, explicit `repoRoot`, and no hidden
network synchronization or background service. Cross-checkout or
cross-repository reuse may share only immutable, complete-fingerprint
artifacts; each checkout retains independent path mappings, dependency edges,
freshness state, and access boundaries. New user-facing behavior remains
inspectable, dry-run-safe where it writes configuration, and compatible with
the current JSON-first CLI and MCP contracts.

**Tech Stack:** TypeScript, Node.js 22 LTS, SQLite WAL, tree-sitter, pnpm,
Vitest, GitHub Actions, npm trusted publishing, and existing CLI/MCP contracts.

---

## Priority and Selection Rules

Stories are ordered by impact, not by implementation convenience. A story may
begin only when its selection gate is satisfied and a dedicated checklist names
exact files, baseline results, focused tests, final checks, version decision,
review evidence, and commit checkpoint. Source changes use an isolated
worktree and run `pnpm check:version-bump` before commit.

Do not use a candidate story to expand scope opportunistically. If discovery
shows that a story requires a shared mutable index, network sync, source upload,
an always-on daemon, or destructive MCP cache controls, stop and write an ADR
before implementation.

| Order | Story | Why it is early | Depends on | Selection evidence |
| --- | --- | --- | --- | --- |
| 1 | Global + branch-aware immutable artifact reuse | The highest potential reduction in repeat indexing after global install and branch/worktree switching. | Completed global and branch-aware epics | Measured duplicate analysis/storage cost and an ADR proving immutable-only sharing preserves isolation. |
| 2 | Global installation health and recovery | Improves the first-use and recovery path for every globally installed user. | Story 1 is not required | Real setup/repair failure cases or a reproducible multi-client configuration matrix. |
| 3 | Checkout and cache transparency | Makes reuse, fallback, and freshness understandable before users trust faster indexing. | Existing branch-aware mappings; may follow Story 1 | A support/debugging gap that current JSON status and diagnostics cannot answer. |
| 4 | Provenance-first retrieval and deterministic lexical ranking | Raises answer quality and trust for both agents and humans without network dependence. | Precision epic Stories 1–2 | A pinned judged corpus, baseline relevance/latency, and public-contract review. |
| 5 | Token-budgeted context and compact transport | Converts better retrieval into lower-context, higher-signal agent handoffs. | Story 4 | Measured payload and relevance baselines proving an additive contract is warranted. |
| 6 | Cross-platform confidence and release automation evidence | Broadens reliable adoption without diluting the user-value work above. | Existing Remaining Delivery Epic | Select and update the existing Windows/release checklist; do not duplicate it here. |
| 7 | Pain-free global installation and repository usage | Makes the global install the normal one-time setup, with every repository using the global cache automatically. | Story 3 transparency | A clean-machine and multi-repository setup matrix proving no repo-local bootstrap is needed. |
| 8 | Copilot CLI first-party global installation | Makes Copilot CLI a supported peer of Codex for global Astrograph-server installation and use. | Story 7 global workflow | A packed-package Copilot CLI matrix proving install, repair, and normal global use. |
| 9 | Pre-v1 cache and codebase cleanup | Removes obsolete cache and compatibility debt once the intended global workflow is settled. | Stories 4–8 evidence gates | A bounded cache-lifecycle and code-smell inventory tied to exact files and tests. |

## Story 1: Global + Branch-Aware Immutable Artifact Reuse

**Status:** Deferred — the representative two-file global fixture duplicated
four artifacts but took only 2.044 seconds for both indexes. That does not
justify new cross-repository storage complexity. See the
[delivery checklist](./global-branch-artifact-reuse-delivery-checklist.md).

**Outcome:** A user who indexes related checkouts or repositories avoids
repeating validated immutable analysis, while each repository and checkout
continues to own all mutable state.

**Scope:** Re-evaluate the deferred global shared-artifact-store opportunity
using the complete fingerprint, storage migration, and checkout mapping
contracts already delivered. Reuse must be limited to parse output, symbols,
summaries, and import facts whose full identity matches. It must never share
SQLite indexes, event logs, locks, diagnostics, path mappings, dependency edges,
or freshness records.

**Selection gate:**

- Record a representative local corpus and compare cold index, branch switch,
  linked worktree, and repeated-content runs.
- Quantify duplicate parsing time and storage; stop if the expected benefit is
  not material relative to migration and complexity cost.
- Add an ADR describing owner boundaries, fingerprint inputs, retention,
  eviction, migration/rebuild behavior, and privacy properties.
- Demonstrate fixture-level isolation for two unrelated repositories, same
  content under different roots, renamed files, changed config/parser versions,
  and concurrent cleanup/index activity.

**Acceptance evidence:** A benchmark and focused tests prove a validated hit
reduces repeat analysis without allowing cross-repository mutable-state leakage
or stale checkout dependency edges. Diagnostics expose reuse/fallback reasons
without source content.

## Story 2: Global Installation Health and Recovery

**Status:** Deferred — the supported global Codex path already has
preflight, dry-run, marker-owned idempotent writes, permission remediation,
cache status, and packed-package proof. No distinct recovery contract is
justified without a reproducible support gap. See the
[delivery checklist](./global-install-health-recovery-delivery-checklist.md).

**Outcome:** A user can diagnose and safely repair a global Astrograph setup
without knowing config-file locations or risking unrelated MCP configuration.

**Scope:** Build on `astrograph install --global --ide codex` and existing
cache controls with an inspectable health/repair contract. Candidate coverage
includes missing or moved executable paths, unsupported runtime, marker-block
drift, permissions, stale generated config, and selected client/terminal
matrices. Prefer `--dry-run` and JSON evidence; write only Astrograph-owned
configuration.

**Selection gate:** Capture real or reproducible failure modes across supported
clients/terminals and inventory which existing `status`, `doctor`, and install
output already answers. Publish a small compatibility matrix before adding a
new command or option.

**Acceptance evidence:** Every supported failure reports a remediation that is
specific, non-destructive, and idempotent. Repeated repair preserves unrelated
configuration byte-for-byte and packed-package tests cover the chosen clients.

## Story 3: Checkout and Cache Transparency

**Status:** Complete — `cache status.checkout` now provides the
persisted checkout identity that populated the selected cache. It is `null`
before indexing and otherwise reports Git mode, repository/head/branch/worktree
identity, diagnostic, and indexed time. See the
[delivery checklist](../closed/global-checkout-cache-transparency-delivery-checklist.md).
PR #24's Fast and Windows CI checks passed for the exact completed head.

**Outcome:** Users and agents can tell which repository/checkout is being used,
whether results are fresh, and why a cache/artifact was reused or bypassed.

**Scope:** Add only the minimal additive JSON/diagnostic fields needed to
surface canonical repository identity, checkout state, storage mode, freshness,
reuse counters, and safe fallback reasons. Keep `repoRoot` required; do not
infer a workspace from the globally installed process.

**Selection gate:** Collect support/debugging examples that cannot be resolved
from current cache status, diagnostics, and branch-aware freshness output. Map
every proposed field to one operator decision and one focused fixture.

**Acceptance evidence:** Fixtures for named branch, detached HEAD, linked
worktree, unavailable Git, local/global storage, migration state, and a stale
artifact show deterministic, privacy-safe diagnostics. Existing JSON consumers
remain compatible through additive fields only.

## Story 4: Provenance-First Retrieval and Deterministic Lexical Ranking

**Status:** Complete — provenance-first source retrieval and deterministic
weighted BM25 ranking merged together as PR #26 after exact-head Fast and
Windows compatibility CI passed. See the
[provenance checklist](../closed/provenance-first-symbol-contract-delivery-checklist.md)
and [ranking checklist](../closed/deterministic-lexical-ranking-delivery-checklist.md).

**Outcome:** Queries return smaller, verifiable, locally ranked source results
before any optional semantic system is considered.

**Scope:** Select and execute Stories 1–2 of the
  [Precision Retrieval and Agent Experience Epic](./precision-retrieval-agent-experience-epic.md):
stable source/symbol provenance followed by deterministic lexical ranking.
Do not begin semantic retrieval, remote embeddings, or a vector service in
this story.

**Selection gate:** Pin a representative corpus/task manifest, record current
source identity/range behavior, and establish relevance, latency, and index
size baselines. Review CLI/MCP compatibility before adding public fields.

**Acceptance evidence:** Returned slices verify against their recorded source
hash and range; the same corpus/query produces the same ranking with recorded
precision@k, MRR, zero-result rate, warm latency, and storage delta.

## Story 5: Token-Budgeted Context and Compact Transport

**Status:** Unselected — Story 4's prerequisite is complete, but Story 5 has
not yet established its required payload, relevance, and latency baseline.

**Outcome:** Agents receive coherent, source-attributed task context inside a
declared budget rather than broad file dumps.

**Scope:** Select Precision Epic Stories 3–4 only after Story 4 establishes
provenance and lexical evidence. Consolidate existing context behavior into one
additive, deterministic assembler; JSON remains default and any compact format
must be lossless and versioned.

**Selection gate:** Compare representative current payloads by bytes/tokens,
relevance, exclusions, and latency. Prove that an existing tool composition
cannot provide the same bounded outcome before adding a new surface.

**Acceptance evidence:** Exploration, debugging, refactor, and audit fixtures
meet stated token budgets, retain provenance, explain exclusions/truncation,
and round-trip any compact response losslessly.

## Story 6: Cross-Platform Confidence and Release Automation Evidence

**Status:** Deferred — the next unchecked requirement in the
[Remaining Delivery Epic](../planned/remaining-delivery-epic.md) is release
publication evidence. Its dedicated checklist is blocked until a
release-labelled PR is merged to `main`; Windows work must be selected in that
epic if its tracker becomes executable again.

**Outcome:** High-impact product work remains usable from supported Windows
terminals and is released through a fully evidenced guarded path.

**Scope:** This is a routing story, not a replacement plan. Select the
appropriate unchecked item in the [Remaining Delivery Epic](../planned/remaining-delivery-epic.md):
Windows audit through release gate, or automatic release-publication evidence.
Do not recreate those checklists here.

**Selection gate:** Identify the next unchecked requirement in that epic and
update its dedicated delivery checklist with the exact affected platform and
release evidence.

**Acceptance evidence:** The selected existing checklist—not this epic—records
the native Windows and/or release CI proof for the exact merged commit.

## Story 7: Pain-Free Global Installation and Repository Usage

**Status:** Complete — merged as PR #28 after exact-head Fast required checks
and Windows compatibility/package smoke passed. See the
[delivery checklist](../closed/pain-free-global-install-delivery-checklist.md).

**Outcome:** A user installs Astrograph once globally and can index, query, and
use it from any repository without repo-local initialization, copied config, or
a manually chosen cache directory. The global root cache is the ordinary
default; repository-local storage is an explicit advanced override only.

**Scope:** Map the first-use path from package install through client setup,
global cache-root creation, repository discovery, indexing, and diagnostics.
Remove any required repo-local bootstrap from the default path. Make repeated
global install/repair idempotent and ensure a repository is selected only from
the command's working directory or explicit argument. Update the README,
global-install guide, CLI reference, and troubleshooting docs so the supported
workflow is clear, copyable, and consistent.

**Selection gate:** Test a clean user home and at least two unrelated
repositories, including a repository with no Astrograph files. Record every
write location and confirm normal use creates only Astrograph-owned global
state plus the existing repository index/cache mapping.

**Acceptance evidence:** A packed-package end-to-end test installs/configures
the supported client once, then indexes and queries both repositories without
repository-local setup. `cache status` identifies the global root and selected
checkout. Documentation contains one concise quick-start plus recovery steps;
it does not instruct normal users to create repo-local configuration or cache
directories.

## Story 8: Copilot CLI First-Party Global Installation

**Status:** Complete — merged as PR #29 after exact-head Fast and Windows
compatibility/package-smoke CI passed. See the
[delivery checklist](../closed/global-copilot-cli-delivery-checklist.md).

**Outcome:** Copilot CLI is a first-party supported installation target at the
same level as Codex. A user can install or repair the Copilot CLI integration
once and use the global Astrograph server and cache from any repository without
repo-local configuration.

**Scope:** Add or complete the Copilot CLI client adapter, global-install,
status, doctor, and repair paths with the same ownership markers, dry-run,
idempotence, and diagnostics expected for Codex. Verify that normal Copilot
CLI invocations discover the current repository while using the shared global
Astrograph cache root. Keep client-specific configuration narrowly scoped;
never overwrite unrelated Copilot configuration. Document Copilot CLI in the
same quick-start, supported-client matrix, troubleshooting, and reference
paths as Codex.

**Selection gate:** Establish the current Copilot CLI configuration contract
from its supported client format and create a disposable-home fixture that
proves the integration can be installed, inspected, repaired, and removed
without affecting unrelated client settings.

**Acceptance evidence:** Packed-package tests exercise Codex and Copilot CLI
through equivalent global-install, status/doctor, repair, and repository-use
flows. Both clients use the same global cache-root semantics, each client shows
its own actionable diagnostics, and the user-facing documentation presents
both as supported first-party installations.

## Story 9: Pre-v1 Cache and Codebase Cleanup

**Status:** Complete — merged as PR #30 after exact-head Fast and Windows
compatibility/package-smoke CI passed. See the
[delivery checklist](../closed/pre-v1-cache-codebase-cleanup-delivery-checklist.md).

**Outcome:** Before v1, Astrograph keeps no compatibility burden for obsolete
cache formats or superseded internal paths, and has a concise evidence-backed
list of remaining cleanup work.

**Scope:** Inventory all cache/version/migration compatibility behavior and
make the direct pre-v1 decision for each: delete an old cache, or soft-delete
it by moving it to a timestamped, clearly disposable location. Do not migrate
or read an obsolete cache merely to preserve compatibility. Inventory code
smells, dead code, duplicate contracts, stale docs/specs, and unnecessary
fallbacks; select only the highest-impact removals with focused tests.

**Selection gate:** First map every storage version check, migration path,
cache-root lifecycle, and cleanup safety boundary. Then produce a ranked,
evidence-backed smell inventory tied to exact files and tests. Do not turn the
inventory into a broad refactor campaign.

**Acceptance evidence:** Fixtures prove an obsolete cache is either removed or
moved aside without being read, indexed, or migrated; active caches and paths
outside Astrograph-owned storage are never deleted. The selected cleanup list
records each removal, its verification, and every intentionally deferred item.

## Non-Goals

- A shared mutable index, global source search across repositories, background
  daemon, network synchronization, or hidden source upload.
- Marking a candidate story complete from a plan or benchmark alone.
- Replacing existing Windows, release, or precision checklists with duplicate
  trackers.
- Treating optional semantic retrieval as a prerequisite for local lexical
  value.
- Preserving obsolete cache data or public/internal compatibility solely for a
  pre-v1 migration path.

## Definition of Done

- [ ] Each selected story has an active checklist with exact scope and passing
  evidence before it is closed.
- [ ] Global/cache and branch-aware improvements preserve canonical repository
  isolation, checkout-local mutable state, and privacy boundaries.
- [ ] Any new CLI/MCP surface has linked contract documentation and compatible
  JSON behavior.
- [ ] Measured user benefit, not a feature count, determines whether each
  candidate continues.
- [x] Story 9 removes or soft-deletes obsolete Astrograph caches and records a
  bounded, evidence-backed cleanup inventory before v1.
