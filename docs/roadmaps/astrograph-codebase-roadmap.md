# Astrograph Codebase Roadmap

## Decision

Astrograph's published runtime and basic Copilot/Codex availability are now
reliable enough to stop treating the daemon as the default suspect. The next
highest-value work is retrieval correctness, followed by retrieval selection
quality and smaller evidence. Architecture expansion comes only after those
contracts are trustworthy.

`BACKLOG.md` owns priority. This document owns rationale, sequencing, and
acceptance evidence. Only the first selected implementation has an active
OpenSpec change.

## Reconciled Baseline

The source audit was taken at Astrograph `5d1c7c5`, jCodeMunch
`fd4d5bf`, and CodeGraph `b9ca4b7`; this roadmap reconciles those findings with
Astrograph `e009ac5` (`origin/main`, 2026-09-06).

Keep:

- one CLI/MCP implementation over SQLite, FTS5, indexed source, shared global
  storage, and worktree-isolated identities;
- WASM parsers with explicit support tiers;
- outline, symbol, source, and bounded task-context retrieval;
- exact tokenizer-backed accounting, `agc1`, opt-in content references,
  benchmarks, and immutable published runtimes;
- one managed runtime usable by both Codex and Copilot across repositories and
  worktrees.

Completed or superseded since the audit:

- PRs #141-#143 and `0.14.1-alpha.239` removed JS/TS implementation bodies and
  variable initializers from structural signatures, minified MCP JSON, made
  routine status concise, loosened optional cache hints, advanced persisted
  compatibility, and kept native runtimes ABI-compatible.
- The bounded Copilot proof completed with zero retrieval failures, timeouts,
  or overflows; its controlled candidate used 23.6% fewer model input tokens.
- Longer client timeouts are not the solution. Same-repository work stays
  sequential and failures remain bounded and observable.

Still proven on current main:

- task-context and context-bundle code slices UTF-8 byte offsets as JavaScript
  string indexes, so multibyte source can be shifted or truncated;
- FTS BM25 weights target the wrong columns because two `UNINDEXED` columns
  precede the searchable fields;
- the 400-row FTS cutoff precedes `filePattern` filtering and can exclude valid
  scoped matches, and FTS candidates can exclude lexical fallback matches;
- representative importer symbols are reported as `references_match` even
  though the evidence proves only a file-level import;
- JSON object/array symbols can still expose complete values as signatures and
  pollute discovery; a live search in this worktree returned a 3 KB fixture
  initializer and reported zero token savings.

## Priority Plan

### P2.1 - Correct source and provenance

**Selected now. Effort: S.** Active OpenSpec:
`fix-context-source-byte-ranges`.

Use one UTF-8-aware exact-range extraction path. Prove Unicode, emoji, CRLF,
same-line symbols, and agreement among returned source, source hash, byte/line
ranges, and token counts across exact source, context bundles, and task context.
No schema, dependency, or daemon change is justified.

Exit: focused regression is green; build/type checks and strict OpenSpec pass;
the patch release is verified through the packed artifact and exact-head CI.

### P2.2 - Correct search selection and ranking

**Next. Effort: M. Depends on P2.1 only for sequencing.** Correct BM25 column
weights, apply scope before bounded candidate selection, retain a deterministic
lexical fallback when FTS narrows too aggressively, and order exact/heuristic
matches ahead of weaker BM25 evidence.

Exit: exact symbol searches remain first; a match beyond the unscoped 400-row
prefix is found when scoped; FTS-only and fallback cases are deterministic;
ranking fixtures report first-relevant rank and token cost.

### P2.3 - Make relation claims honest

**Effort: S-M. Depends on P2.2 measurement fixtures.** Do not label an arbitrary
representative symbol as a call/reference. Either return file-level import
evidence with explicit confidence, or return a symbol relation only when
specifier/reference evidence identifies it.

Exit: every relation result states evidence and confidence; ambiguous imports
are not promoted to symbol references; fixtures cover aliases, re-exports, and
multiple symbols in one importer.

### P2.4 - Finish minimal discovery records

**Effort: S. Independent after P2.1.** Bound JSON/config signatures and keep
search/outline discovery structural. Preserve full content only for explicit
source retrieval. Do not add another encoding until field selection is proven.

Exit: large JSON/config fixtures cannot dominate a five-result discovery
response; exact retrieval remains lossless; output-size and token regressions
are measured.

### P3 - Retrieval foundations

**Effort: M-L, one change at a time.** Selectively recover, do not merge, the
old `feat/retrieval-quality-roadmap` branch:

1. identifier segmentation, common abbreviation expansion, and ranking debug
   evidence from commit `96162bf`;
2. stable symbol identities and alias migration from `dcd9bdb` only after its
   collision and compatibility rules are reviewed against current storage v3;
3. TypeScript path aliases and workspace/package resolution;
4. overlap deduplication, budget reconciliation, smaller startup profiles, and
   actual client use of content references;
5. extend `agc1` only where a measured repetitive response still benefits.

Exit: each recovered slice has a fresh OpenSpec, current-main tests, a measured
before/after result, and no wholesale merge of the stale 4,000-line branch.

### P4 - Trustworthy TypeScript symbol graph

**Epic; effort: L. Depends on stable identity and honest relation evidence.**
Resolve imports through aliases/workspaces, index declarations and references
with explicit confidence, and provide bounded dependency/reference queries.

Exit: graph answers cite source evidence, distinguish file and symbol edges,
survive ordinary edits, and refuse unsupported certainty.

### P5 - Change-aware context and impact

**Epic; effort: L. Depends on P4.** Add changed-symbol, blast-radius,
rename-safety, and impact-preview workflows over trusted identities and graph
edges. Keep semantic search optional and later.

Exit: a Git diff maps to stable changed symbols, impact output is budgeted and
confidence-labelled, and unsafe/ambiguous rename cases fail closed.

## Measurement Contract

Every retrieval change records correctness first, then cost:

| Layer | Required evidence |
| --- | --- |
| Selection | target found, first-relevant rank, false positives, scoped recall |
| Fields | response fields and exact source completeness |
| Encoding | bytes and tokenizer-counted tokens for JSON, minified JSON, and `agc1` where supported |
| Dedupe | repeated bytes/tokens avoided without losing evidence |
| Workflow | calls, repeated reads, failures, timeouts, task success |
| Runtime | cold index, warm index, refresh, memory, retrieval latency |

Use the same repository commit, task outcome, tokenizer, privacy boundary, and
accepted-run rules. Report deterministic payload results separately from fresh
agent results; never use either product's self-reported savings as cross-product
evidence.

## Comparison Branch Decision

`codex/jcodemunch-benchmark` is active and must remain isolated until its own
verification and merge. At inspected commit `15e931d`, its source-free draft
reported 3/3 success for both products. jCodeMunch used 181 median retrieval
tokens versus Astrograph's 1,129 and indexed faster; Astrograph used 64,871
median fresh-agent input tokens versus 96,349, with two calls versus four.

These are bounded single-task results, not a winner declaration. The reusable
lesson is to separate payload compactness from agent behavior: jCodeMunch's
compact aliases reduced payloads but were not accepted by its source tool,
causing resolution retries. Any MUNCH-inspired experiment must isolate record
selection, field minimization, encoding, deduplication, and combined effects.
Its license does not authorize copied or translated implementation in a public
Astrograph package.

The older `feat/publishable-workflow-benchmark` branch is also selective source
material only. Recover its external-corpus isolation and strict CLI fixes if
the active comparison harness does not already supersede them.

## Operating Rules

- Work from a fresh isolated worktree based on current `origin/main`.
- Keep exactly one selected implementation represented by an active OpenSpec.
- Add the smallest failing public-boundary test before production code.
- Commit and push complete slices; do not stash session state or merge stale
  feature branches wholesale.
- Archive a change and retire its worktree only after exact-head CI and remote
  state are verified.
