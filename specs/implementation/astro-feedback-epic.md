# Astrograph Feedback Consolidation Epic

> **Source note:** `.memory/astro-feedback.md`
>
> **Document purpose:** Turn the current raw Astrograph feedback note into one
> consolidated implementation epic with milestone sequencing, acceptance
> criteria, and execution guidance for future agent-driven work.

**Goal:** Convert the current feedback themes into one dependency-ordered epic
that improves retrieval quality, result discipline, explainability, and public
surface clarity without losing traceability to the source feedback.

**Architecture:** Treat this as an umbrella implementation spec. It does not
ship behavior directly. It organizes future execution into milestone-sized
follow-on plans that can be implemented and verified independently while still
rolling up into one coherent roadmap.

**Tech Stack:** TypeScript, Node 24, Vitest, MCP stdio server, Astrograph CLI
and spec system.

---

## Problem Statement

Astrograph is already useful, but the feedback in `.memory/astro-feedback.md`
points to a consistent set of gaps:

- broad natural-language queries can rank the wrong code too highly
- broad queries can return payloads that are too large by default
- agents cannot easily tell how much token savings Astrograph provided
- degraded freshness or unresolved imports are reported too broadly
- broad-result fallback guidance is not yet explicit enough
- ranking does not yet leverage repo-specific path intent
- MCP and CLI documentation can feel misaligned from the agent point of view

These are related issues, not separate one-off fixes. Query discipline,
ranking, explainability, and docs parity should be treated as one roadmap so
that each improvement builds on the previous one instead of creating overlapping
partially-finished behaviors.

## Scope and Non-Goals

This epic covers:

- default handling of broad natural-language retrieval
- ranking improvements for intent-heavy queries
- repo-aware ranking presets
- token-savings and degraded-mode explainability
- MCP and CLI documentation parity for the affected workflows

This epic does not cover:

- unrelated parser or storage refactors
- new language support
- semantic search
- edit-safety tools
- unrelated MCP surface expansion beyond what is needed for parity and guidance

## Feedback Traceability

| Feedback item from `.memory/astro-feedback.md` | Epic handling |
| --- | --- |
| Better query ranking for intent | Milestone 2 |
| Result-size controls by default | Milestone 1 |
| Token-savings telemetry | Milestone 4 |
| Guided fallback suggestions | Milestone 1 and Milestone 4 |
| Query planner / next-step hints | Milestone 1 |
| Path-aware presets | Milestone 3 |
| MCP tool parity with CLI docs | Milestone 5 |

## Milestone Roadmap

The milestone order is foundation-first. Later milestones assume the behaviors
defined by earlier ones.

### Milestone 1: Query Narrowing and Result Discipline

**Purpose:** Make broad queries safe and teach agents how to narrow before large
payloads are returned.

**Themes covered:**

- result-size controls by default
- query planner and next-step hints
- first-pass guided fallback behavior

**Target behavior:**

- Broad retrieval requests should prefer bounded summaries, grouped results, or
  refine-first responses before returning oversized symbol or source payloads.
- When Astrograph detects that a query is too broad for a high-signal response,
  it should suggest the most likely narrowing levers such as `filePattern`,
  `kind`, likely directories, or likely next queries.
- Guidance should be concrete enough for an agent to take the next step without
  re-reading large result dumps.

**Acceptance criteria:**

- Broad queries no longer default to unbounded symbol payloads when Astrograph
  has strong evidence the result set is too large to be useful.
- Responses can group or summarize broad results instead of dumping the entire
  result body.
- Refine-first responses include specific narrowing suggestions rather than
  generic "query too broad" messaging.
- The resulting behavior remains deterministic and testable.

**Follow-on implementation expectations:**

- Add bounded broad-query test cases to the retrieval contract suite.
- Verify that agent-facing hints remain stable enough to document.

### Milestone 2: Intent-Aware Ranking

**Purpose:** Improve ranking quality for natural-language queries that imply
generation or code ownership intent.

**Themes covered:**

- better query ranking for intent

**Target behavior:**

- Queries such as "generated API hooks" or "how is X generated" should favor
  likely generator code, generation entrypoints, and generation-oriented symbol
  names over downstream usage sites and tests.
- Ranking should incorporate filename, path, and symbol-shape evidence before
  repo-specific presets are introduced.
- Ranking changes should remain explainable enough to benchmark and regress.

**Acceptance criteria:**

- Representative generator-oriented queries rank likely generator code above
  app-level false positives in fixture repos or benchmarked scenarios.
- Ranking heuristics are explicit enough to support regression tests and future
  tuning.
- Ranking improvements do not depend on hidden repo-specific hardcoding.

**Follow-on implementation expectations:**

- Add ranking regression fixtures and benchmark prompts for the representative
  natural-language cases called out in the source feedback.

### Milestone 3: Repo-Aware Ranking Presets

**Purpose:** Layer repo-specific path intent on top of the generic ranking
foundation.

**Themes covered:**

- path-aware presets

**Target behavior:**

- Repos can define high-level ranking categories such as generation code, app
  code, shared runtime, or similar intent-bearing path groups.
- Ranking can use those categories when queries imply the corresponding intent.
- The feature should be opt-in and explicit in config, not a hidden behavior
  inferred from ad hoc hardcoded paths.

**Acceptance criteria:**

- Repo configuration can express a bounded preset vocabulary or equivalent
  category mapping that ranking logic can consume.
- Queries with matching intent can prefer the configured category while still
  allowing fallback to general ranking behavior.
- The config behavior is documented and verified by tests.

**Follow-on implementation expectations:**

- Extend config validation and ranking tests together.
- Keep the preset system small enough to document clearly in CLI and MCP setup
  guidance.

### Milestone 4: Retrieval Explainability and Health Guidance

**Purpose:** Make Astrograph's savings and degraded-mode safety legible to
agents.

**Themes covered:**

- token-savings telemetry
- guided fallback suggestions for stale or degraded states

**Target behavior:**

- Retrieval responses should communicate meaningful token-savings information in
  a measurable way rather than requiring users to infer value indirectly.
- Diagnostics and retrieval workflows should distinguish between fully unsafe,
  partially degraded, and still-safe retrieval modes when freshness or imports
  are unresolved.
- Guidance should clarify which operations remain trustworthy and what features
  are degraded.

**Acceptance criteria:**

- Affected outputs can report returned payload size and a comparable baseline or
  savings estimate in a stable metadata form.
- Stale or unresolved-import messaging distinguishes safety from degradation
  instead of using a single coarse warning.
- Guidance identifies what an agent can still do safely and which follow-up
  action is recommended.

**Follow-on implementation expectations:**

- Add assertions for token-related metadata and degraded-mode messaging.
- Keep metadata consistent with the existing MCP response envelope style.

### Milestone 5: MCP and Documentation Parity

**Purpose:** Close the gap between the public docs and the actual MCP/CLI
experience around the affected retrieval workflows.

**Themes covered:**

- MCP tool parity with CLI docs

**Target behavior:**

- The docs should clearly distinguish CLI and MCP workflows where they differ.
- Public naming, examples, or compatibility notes should not leave agents
  guessing which commands or tools exist in which surface.
- Unless a future approved plan explicitly changes public contracts, this
  milestone should bias toward documentation clarification before renaming
  public surfaces.

**Acceptance criteria:**

- `specs/api-design/mcp-tools.md`, `specs/api-design/cli-api.md`, and the
  relevant README-facing guidance reflect the real MCP and CLI workflows for the
  affected features.
- Any intentional divergence between CLI and MCP is documented explicitly.
- If parity requires a public-surface change, that change is split into its own
  contract-aware implementation plan before shipping.

**Follow-on implementation expectations:**

- Keep docs, tests, and public examples moving together when contract-adjacent
  behavior changes.

## Cross-Milestone Dependencies

- Milestone 1 should land before large ranking work so broad-query handling
  becomes safer immediately.
- Milestone 2 should land before Milestone 3 so repo-specific presets extend a
  strong default ranking model rather than compensating for a weak one.
- Milestone 4 depends on the shape of Milestone 1 responses and any metadata
  conventions already used by the MCP surface.
- Milestone 5 can begin earlier for audit work, but final parity updates should
  happen after the preceding milestones settle.

## Definition of Done

This epic is done when Astrograph can honestly claim:

1. broad natural-language queries are bounded and teach the agent how to narrow
   instead of dumping oversized results by default
2. intent-heavy queries rank likely implementation targets above common false
   positives
3. repo-aware presets can refine ranking without replacing the generic model
4. Astrograph reports token-savings and degraded-mode safety in a way agents can
   act on
5. MCP and CLI docs match the real user-facing workflows for the affected
   retrieval features

## Execution Guidance for Follow-On Plans

When implementing this epic:

1. Split milestone delivery into smaller implementation plans under
   `specs/implementation/` instead of attempting one large source change.
2. Treat `src/index.ts`, MCP tool names, CLI JSON output, config parsing, and
   docs examples as compatibility-sensitive.
3. Add benchmark or fixture coverage for each ranking or broad-query behavior
   change.
4. Keep public-doc updates coupled to contract-adjacent behavior changes.
5. Run `pnpm check:version-bump` in any follow-on source-changing work that
   touches `src/`, `tests/`, `scripts/`, `bench/`, or package metadata.

## Verification Pointers

- Retrieval behavior: `tests/interface.test.ts`, `tests/engine-behavior.test.ts`
- MCP contract wording: `specs/api-design/mcp-tools.md`
- CLI workflow wording: `specs/api-design/cli-api.md`
- User-facing setup guidance: `README.md`
