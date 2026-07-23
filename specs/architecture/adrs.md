# Architecture Decision Records

This file records significant Astrograph architecture decisions. New ADRs should
be appended in chronological order and use [the ADR template](../templates/adr.md).

---

## ADR-001: Use SQLite WAL For Local Index Storage

**Date:** 2026-05-01
**Status:** Superseded by the token-budgeted task-context contract (2026-07-22)

**Context:** Astrograph needs a local, inspectable, zero-service index for files,
symbols, imports, freshness metadata, and search tables.

**Decision:** Use SQLite as the local index backend, with WAL mode as the
configured storage mode.

**Rationale:**

- SQLite keeps the operational model local and simple.
- WAL supports concurrent reads during normal agent retrieval.
- The index remains easy to inspect, delete, and rebuild.

**Consequences:**

- Good fit for single-repo local agent workflows.
- Horizontal/distributed indexing is out of scope for the current package.
- Schema changes require careful migration tests.

---

## ADR-002: Keep MCP, CLI, And Library Surfaces Aligned

**Date:** 2026-05-01
**Status:** Accepted

**Context:** Astrograph exposes the same retrieval capabilities through stdio
MCP, JSON CLI commands, and TypeScript exports.

**Decision:** Public behavior should be implemented through shared core
functions and contract-tested across all three surfaces.

**Rationale:**

- Agents may use whichever surface is available in their runtime.
- Shared behavior prevents MCP-only or CLI-only drift.
- Contract tests make package releases safer.

**Consequences:**

- New public capabilities require API-design docs and interface tests.
- Result-shape changes must be treated as compatibility-sensitive.

---

## ADR-003: Hard-Switch MCP V1 Contract and Cache Deletion Policy

**Date:** 2026-05-02
**Status:** Accepted

**Context:** Astrograph needs explicit, workflow-oriented MCP tools for retrieval
while moving to a cleaner versioned contract. Maintaining the existing
`query_code` umbrella during this transition adds ambiguity and slows migration.

**Decision:**

- Remove `query_code` from the MCP surface in this hard-switch.
- This decision originally added strict v1 retrieval tools. Its two bounded
  context tools were later replaced without compatibility aliases by the
  single `get_task_context` contract.
- Use a single strict v1 response envelope for success and failure.
- Carry versioning in both registration metadata (`toolVersion: "1"`) and response
  metadata (`meta.toolVersion`).
- Keep plain tool names (no `_v1` suffix).
- Remove query/result/session caching from MCP v1 until 1.0; no cache tables,
  cache-hit metadata, or cache invalidation behaviors are introduced in this slice.

**Rationale:**

- A hard switch reduces long-term complexity from dual paradigms.
- Unified schemas simplify validation and future test gates.
- Dual version signaling improves traceability without polluting call sites.
- Cache deletion avoids locking migration to unstable invalidation and identity
  assumptions and matches the v1 hard-switch migration profile.

**Consequences:**

- Breaking MCP change requires client migration in this release path.
- Library `queryCode` remains available internally and for direct consumers.
- Stable symbol identity changes must align with these tool transitions.
- Cache strategy will be reintroduced in a post-1.0 ADR with migration guidance.

---

## ADR-004: Use Tree-Sitter-Only Parsing For MCP V1 Hard-Switch

**Date:** 2026-05-03
**Status:** Accepted

## Context

The MCP v1 hard-switch needs a stable parser contract while the tool surface,
strict response envelopes, and cache deletion policy are changing. The current
parser architecture allows OXC execution with tree-sitter fallback, which keeps
speed as an optimization but makes parser metadata, symbol drift review, and
language expansion harder to reason about during the v1 cutover.

## Decision

For the MCP v1 hard-switch, active parser execution is tree-sitter-only.

- OXC is removed from active parser execution in this slice.
- `oxc-parser` is removed from parser dependencies when the cutover lands.
- `oxc-resolver` may remain only if source search confirms import resolution
  still uses it outside parser execution.
- Language coverage and parser contract stability take priority over parser
  speed until v1 stabilizes.
- OXC can be reconsidered only through a later ADR after the MCP v1 contract is
  stable.

## Rationale

- Tree-sitter gives one parser execution model for the hard-switch.
- The v1 MCP contract needs deterministic parser metadata more than parser
  backend optionality.
- Removing hybrid parser execution reduces migration risk while tests are
  rewritten around explicit retrieval tools and strict envelopes.
- Future OXC reintroduction should be evaluated against a stable MCP contract,
  not mixed into the contract migration itself.

## Consequences

- Parser speed may regress for some JavaScript and TypeScript indexing paths.
- Symbol output may drift and must be reviewed explicitly in parser regression
  tests.
- Parser metadata should report tree-sitter-only behavior for v1.
- OXC parser execution is not an available implementation path for this plan.

## Verification

- `specs/implementation/closed/mcp-v1-hard-switch-plan.md` Phase A tracks the cutover.
- Parser regression tests must assert tree-sitter-only metadata and
  deterministic symbols for representative JS/TS/JSX/TSX fixtures.
- Targeted verification remains:
  `pnpm type-lint` and
  `pnpm exec vitest run tests/engine-contract.test.ts tests/engine-behavior.test.ts`.

---

## ADR-005: Archive Managed Cache Data Before Cleanup

**Date:** 2026-07-22
**Status:** Accepted

## Context

Global cache remove/prune and incompatible-storage recovery previously used
recursive deletion. Although their targets were scoped and lock-aware, a bad
path-resolution or implementation bug could irreversibly remove user data.

## Decision

All mutable-cache cleanup moves a validated inactive cache directory into a
timestamped archive under Astrograph's managed root, records a JSON receipt,
and returns that receipt in the JSON result. Dry-run remains the default;
archive mutation requires the existing exact CLI scope plus `--yes`. Permanent
deletion is not added and destructive cleanup remains unavailable to MCP.

The move rejects symlinks, non-canonical/out-of-root paths, active SQLite
databases, and archive collisions. Failed moves leave the original target in
place. Automatic incompatible-cache recovery follows the same archive path.

## Rationale

- A same-filesystem rename is fast, atomic at the directory boundary, and
  recoverable without copying untrusted paths.
- Receipts make every mutation inspectable and provide an exact restore target.
- One shared primitive prevents explicit cleanup and automatic recovery from
  drifting into different safety models.

## Consequences

- Archive retention is intentionally manual until measured user data warrants a
  separate, explicit retention policy.
- An archive move can fail across filesystems; Astrograph reports the failure
  and preserves the original cache rather than falling back to deletion.
- Public CLI and library result shapes gain archive metadata; MCP does not gain
  cache mutation tools.

## Verification

- `tests/engine-contract.test.ts` proves dry-run, archive/restore metadata,
  symlink/out-of-root rejection, lock rejection, collision, and failed moves.
- `tests/engine-behavior.test.ts` proves incompatible local/global cache
  recovery archives stale contents without touching symlink targets.

---

## ADR-006: Publish From the Verified Merge Candidate

**Date:** 2026-07-22
**Status:** Accepted

## Context

The previous release loop required a `release` label, created a second
release-only pull request after a product PR merged, then triggered a separate
tag-publisher workflow. This made a normal release hard to understand and
introduced failure states between the verified product merge and npm.

## Decision

- A release-worthy pull request owns its valid version bump before merge.
- The post-merge release job receives the already-verified merge SHA, validates
  the version, tag, npm registry, and optional `no-release` decision, then tags
  and publishes that exact commit in one guarded transaction.
- `no-release` is the explicit exception for a runtime-looking change that must
  not publish; docs/spec/workflow-only changes naturally resolve to no release.
- The release job never writes or pushes a commit to `main`, creates no
  release-only PR, and does not dispatch another publishing workflow.
- JSON decision output and a guarded manual plan/retry remain available, but
  both use the same policy and transaction code.

## Rationale

- The version that passed PR CI is the version published to npm.
- One job summary can show candidate SHA, version, tag, registry state, and
  publish result without following a release branch or downstream run.
- Keeping the release job after existing Fast CI preserves the current cost
  boundary: no new broad trigger, runner, matrix, or scheduled work.

## Consequences

- PR authors must include a policy-valid bump for release-worthy source or
  package changes before merge.
- A failed post-merge registry or publish check leaves `main` unchanged and
  fails visibly for recovery; it never creates a compensating version commit.
- The tag remains the immutable release marker, while npm provenance comes from
  the workflow that tagged it.

## Verification

- `tests/release-policy.test.ts` and release-agent fixtures cover eligible,
  `no-release`, duplicate, stale, malformed, unavailable, and rerun states.
- CI reports the PR decision without writing and publishes only after Fast CI
  succeeds on `main`.
- `docs/reference/release.md` and
  `specs/implementation/planned/0_release-on-main-merge-delivery-checklist.md`
  describe the same contract.
- `tests/cli-boundary.test.ts` proves exact scope and `--yes` requirements.

---

## ADR-007: Offer Versioned Compact JSON for Repetitive MCP Results

**Date:** 2026-07-23
**Status:** Accepted

## Context

MCP clients receive the serialized v1 envelope as text. The normal JSON shape
is intentionally explicit and remains the safest default, but repeated object
keys in `search_symbols`, `get_file_tree`, and `get_file_outline` consume a
material share of an agent's context window. A deterministic two-file fixture
measured the complete agent-visible success envelopes at 414, 105, and 322
`cl100k_base` tokens respectively.

## Decision

Add an opt-in `format` request property to only those three tools:

- Omitted or `"json"` returns the existing strict v1 JSON envelope unchanged.
- `"compact"` returns a lossless JSON array beginning with `"agc1"`; the tool
  name, positional field tables, and v1 metadata are encoded in a documented,
  versioned order.
- `"auto"` returns compact only when it saves at least 20 tokens *and* 25% of
  the ordinary serialized JSON response. Otherwise it returns ordinary JSON.

Compact encoding is used only for successful selected-tool results. Invalid
arguments, tool failures, unsupported tools, and any compact-encoding failure
return the ordinary strict v1 error or JSON envelope. A public reference decoder
reconstructs the normal envelope; compact output does not introduce a binary
transport, a hidden routing layer, cache, daemon, or shared state.

## Rationale

- The same fixture's lossless implementation saved 230/414 tokens (55.6%) for
  successful `search_symbols`, 78/136 (57.4%) for an empty search, 70/105
  (66.7%) for `get_file_tree`, and 190/322 (59.0%) for `get_file_outline`.
- The smallest measured selected response saved 70 tokens and 55.6%; the
  20-token / 25% `auto` gate is therefore evidence-based and conservative.
- Keeping JSON default and publishing a decoder preserves v1 compatibility and
  makes the compact contract inspectable by agents and human clients.
- `get_task_context` is deliberately excluded: its value is bounded source and
  provenance content, not repeated response keys. Its existing payload-budget
  accounting remains unchanged for every requested format.

## Consequences

- Clients that want the smaller shape must opt in and either use the reference
  decoder or implement the published `agc1` table mapping.
- `auto` may return either documented shape, so clients that require one shape
  must request `json` or `compact` explicitly.
- Compact response metrics are emitted in local MCP observability data, while
  the compact payload stays focused on the lossless result.

## Verification

- `pnpm bench:mcp-envelopes` captures the real envelopes, byte/token counts,
  and the lossless compact comparison on a deterministic fixture.
- Focused interface tests prove JSON-default compatibility, selected compact
  round trips (including Unicode and empty results), `auto` fallback, and
  strict JSON errors.
- `specs/api-design/mcp-tools.md` documents the request, envelope, decoder,
  failure fallback, and unchanged `get_task_context` budget contract.

---

## ADR-008: Use Evidence-Gated Tree-Sitter Language Adapters

**Date:** 2026-07-23
**Status:** Accepted

## Context

Astrograph currently installs two Tree-sitter grammar packages and exposes four
JavaScript-family languages. Its extraction code is coupled to JavaScript and
TypeScript node names, while Tree-sitter provides each other language as a
separate generated grammar. Installing a long dependency list alone would make
the registry overstate symbol, import, and graph support.

## Decision

Astrograph will support the parsers currently listed in Tree-sitter's upstream
organization through explicit static language adapters. Every adapter owns its
grammar loading, extensions, node-shape extraction, and declared support tier.
The registry exposes a language only after fixture-backed parser loading and
deterministic symbol/range evidence.

PowerShell is a separately selected community grammar for the initial
value-first batch. It is an explicit exception to the upstream-list scope, not
a broad commitment to community grammars, and is subject to the same evidence
gate.

`graph` support requires language-specific import/relation tests. An adapter
without that evidence is `structured` only; it may produce symbols and
outlines but does not claim dependency expansion. Astrograph will pin verified
native grammar packages compatible with its Node Tree-sitter binding and will
not dynamically download grammars or claim all community grammars are covered.

## Rationale

- Tree-sitter's official parser list is a bounded, auditable initial target;
  its community grammar catalog is intentionally open-ended.
- Adapters prevent the JavaScript AST switch from becoming an opaque, brittle
  multi-language branch and make node-shape differences testable.
- Tiered disclosure preserves the local-first, inspectable retrieval contract:
  a parsed outline is useful, but it is not evidence for a dependency graph.

## Consequences

- This is a multi-batch feature with native dependency and package-size cost;
  each grammar needs ABI, licence, platform-load, and fixture evidence.
- New public `SupportedLanguage` values and diagnostics entries are additive,
  but parser behavior remains compatibility-sensitive and release-worthy.
- Future community grammars require the same adapter and evidence gate rather
  than being included by a broad “Tree-sitter support” claim.

## Verification

- The active [polyglot delivery checklist](../implementation/active/1_tree-sitter-polyglot-language-support-delivery-checklist.md)
  records the inventory, adapter migration, fixtures, package measurements,
  public contract tests, and release evidence.
