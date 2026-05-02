# MCP v1 Hard-Switch Plan: Explicit Tools, Strict Schemas, and Cache Deletion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MCP v1 from `query_code`-first workflows to explicit retrieval tools, enforce a strict response envelope across all MCP calls, and remove MCP cache behavior. The resulting tool surface must preserve function without implicit orchestration.

**Architecture:** Keep MCP as a thin dispatcher around the existing engine in `src/index.ts` and schema/validator layers in `src/mcp-contract.ts` + `src/validation.ts`. MCP remains a transport boundary only: tool registrations, strict argument schemas, and standardized dispatch responses are enforced here while engine internals retain business logic.

**Tech Stack:** TypeScript, Node 24, `@modelcontextprotocol/sdk`, Zod, Vitest.

## Phase A: Parser strategy and package decision (preflight before hard-cut)

**Files:**
- Read: `package.json`
- Create: `scripts/bench/parser-parity-check.mjs`
- Modify: `package.json` (temporary test scripts only)
- Modify: `src/parser.ts` (to complete tree-sitter-only execution path)
- Update: `specs/raw/astrograph_jcodemunch_agent_spec.md` (parser mode decision log)

- [ ] **Step 1: Baseline dependency posture**

Run:

```bash
pnpm type-lint
pnpm exec node -e "const p=require('./package.json'); console.log({parserDeps:Object.fromEntries(Object.entries(p.dependencies ?? {}).filter(([k])=>['oxc-parser','oxc-resolver','tree-sitter','tree-sitter-javascript','tree-sitter-typescript'].includes(k)))})"
```

Expected:
- Existing baseline remains a hybrid parser stack with `oxc` first + tree-sitter fallback.
- No behavior change yet.

- [ ] **Step 2: Run parser parity benchmark before implementation**

Add and run a temporary one-off benchmark script:

```bash
pnpm exec node scripts/bench/parser-parity-check.mjs <repoRoot>
```

The script should produce:
- parse success rate by parser (`oxc` vs `tree-sitter`)
- fallback frequency (if hybrid stays)
- symbol extraction parity for a representative corpus (`symbolId`, symbol count, missing/extra symbols)
- latency summary p50/p95/p99

Expected:
- A decision memo is captured in `specs/raw/astrograph_jcodemunch_agent_spec.md` under Hard-switch notes.
- If the benchmark shows high parity risk, defer any parser changes and keep hybrid.

- [ ] **Step 3: Decide parser mode for v1 hard-switch**

Record one of these options as explicit implementation decision:

- **Option 1 (Default): Keep OXC-first + tree-sitter fallback**
  - Minimal behavior churn; parser failure signal already implemented.
- **Option 2: Tree-sitter-first with OXC fallback**
  - Requires schema/behavior checks for `symbol.kind`, positions, and confidence deltas.
- **Option 3: Hybrid removal + single parser**
  - Requires full symbol-fidelity and cache-impact assessment plus migration note.
- **Decision (Adopted): Option 4: Tree-sitter-only execution**
  - Remove OXC execution from MCP hard-switch path.
  - Keep OXC as a re-introduction target after hard-switch stability pass.
- **Decision lock:** this decision is accepted even if symbol-count/perf shifts occur, unless a regression blocks release.

Decision acceptance gate:
- If parser decision is not `Option 4`, require explicit ADR and migration constraints in `specs/architecture/adrs.md` before touching MCP tool contracts.
- If `Option 4` is chosen, still require one ADR entry in `specs/architecture/adrs.md`:
  - tree-sitter-only switch rationale,
  - temporary rollback path to OXC,
  - symbol-level acceptance criteria.

Expected:
- The hard-switch implementation path is locked to tree-sitter-only for parser execution.
- OXC may only be reintroduced in a follow-up ADR milestone after `v1` stabilization.

## Task 1: Lock v1 contract and baseline behavior (docs first)

**Files:**
- Modify: `specs/raw/astrograph_jcodemunch_agent_spec.md`
- Modify: `specs/api-design/mcp-tools.md`
- Modify: `specs/architecture/adrs.md`
- Modify: `specs/implementation/README.md`
- Modify: `specs/README.md`

- [ ] **Step 1: Baseline current behavior in tests and docs**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts
pnpm exec vitest run tests/engine-contract.test.ts
```

Expected:
- All commands pass.
- Baseline includes current behavior of `query_code`, readiness output, and current tool registry shape.

- [ ] **Step 2: Lock explicit v1 contract in docs**

Make and record all decisions:
- MCP v1 removes `query_code` from tool surface.
- New MCP v1 tools: `search_symbols`, `get_symbol_source`, `get_context_bundle`, `get_ranked_context`.
- Envelope is mandatory for all MCP tool calls: `ok`, `data`, `meta`, and optional `error` on failure.
- Registration metadata must include tool contract metadata (`toolVersion: "1"`).
- MCP cache behavior is **deferred/remove from v1 scope**.

Expected:
- `specs/architecture/adrs.md` includes ADR-003 with parser decision gate linked to Task A.
- `specs/api-design/mcp-tools.md` has exact request/response envelopes for each new tool.
- `specs/raw/astrograph_jcodemunch_agent_spec.md` states that package choice impacts are allowed only if parity gates pass.

## Task 2: Remove `query_code` and add explicit MCP tool registrations

**Files:**
- Modify: `src/mcp-contract.ts`
- Modify: `src/validation.ts` (remove/retire MCP-only `query_code` branches)
- Modify: `src/language-registry.ts` (if tool-list snapshots used)
- Modify: `src/config.ts` (tool-list defaults/profile mapping)
- Modify: `src/types.ts` (MCP tool union/types)

- [ ] **Step 1: Update MCP tool definitions**

In `MCP_TOOL_DEFINITIONS`:
- Remove `query_code` tool definition.
- Add strict definitions with explicit per-tool schemas for:
  - `search_symbols`
  - `get_symbol_source`
  - `get_context_bundle`
  - `get_ranked_context`
- Each tool must map to direct engine methods already present in `src/index.ts`.
- Each definition is tagged with version metadata consumed by contract tests.

Expected:
- `MCP_TOOL_NAMES` no longer includes `query_code`.
- New tool names are discoverable and typed.

- [ ] **Step 2: Preserve non-MCP `queryCode` API where required**

If CLI or SDK still depends on non-MCP `queryCode`, keep it exported from `src/index.ts` but do not expose MCP path.

Expected:
- Non-MCP callers keep behavior.
- MCP no longer routes through `query_code`.

- [ ] **Step 3: Align tool profile and install UX**

Update install/tool selection docs and defaults:
- `src/scripts/install.ts` profile modes and help text no longer treat `query_code` as default required path for MCP.
- If needed, document recommended tool profiles: full/bare/explicit.

Expected:
- User-facing installation docs and defaults mirror tool cutover.
- No MCP-facing guidance uses `query_code` as mandatory first step.

## Task 3: Enforce strict v1 envelopes and normalized errors

**Files:**
- Modify: `src/mcp.ts`
- Modify: `src/mcp-contract.ts`
- Add/Modify: tests in `tests/interface.test.ts`, `tests/engine-contract.test.ts`

- [ ] **Step 1: Introduce strict response envelopes**

Define and use:

- `McpResponseEnvelope<T> = { ok: true; data: T; meta: { toolVersion: "1"; tokenBudgetUsed: number | null; dataFreshness: "fresh" | "stale" | "unknown"; warnings?: string[] } }`
- `McpErrorEnvelope = { ok: false; data: null; error: { code: string; message: string; details?: Record<string, unknown> }; meta: { toolVersion: "1"; tokenBudgetUsed: null; dataFreshness: "unknown" } }`

Update `dispatchTool` and MCP tool registration to always return one of the two envelopes.

Expected:
- On success, every call returns `ok: true` and metadata.
- On throw, callers receive `ok: false` with normalized error code/message.

- [ ] **Step 2: Add `dataFreshness` and token budget semantics**

Set freshness from existing metadata or explicit defaults.
Preserve current estimate values but move them into envelope metadata so callers can budget token use.

Expected:
- All successful responses include non-null `dataFreshness` and `tokenBudgetUsed` when available.
- Failures set `dataFreshness: "unknown"`, `tokenBudgetUsed: null`.

- [ ] **Step 3: Add strict schema guards and parser mode tags**

For `search_symbols`/`get_context_bundle`/`get_ranked_context`, assert:
- required arguments are present and typed
- engine outputs are runtime-validated for version contract
- response metadata includes `toolVersion: "1"`

Expected:
- No untyped `any` escape path remains in MCP dispatch.

## Task 4: Tests and interface lock-in

**Files:**
- Modify: `tests/interface.test.ts`
- Modify: `tests/engine-contract.test.ts`
- Modify: `tests/engine-behavior.test.ts`

- [ ] **Step 1: Replace MCP interface assertions**

Update interface tests to assert:
- registry does not include `query_code`
- new tools are present
- new envelope shape for both success and error paths
- token budget + freshness metadata exists
- `query_code` references are removed from MCP contract assertions

Expected:
- Explicit coverage for the four v1 tools in happy-path and argument-validation paths.

- [ ] **Step 2: Add parser strategy regression tests**

- Add/extend tests to confirm parser mode choice does not change symbol IDs unexpectedly for selected fixtures.
- If parser choice changed from baseline in Task A, add compatibility tests in a temporary fixture scope.

Expected:
- Parser behavior remains deterministic under selected mode.

- [ ] **Step 3: Run targeted behavioral verification**

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "readiness|diagnostics|project status|deepening"
```

Expected:
- All target tests pass.
- No MCP path invokes `query_code`.
- Parser fallback/primary mode assertions pass if modified.

## Task 5: Release hardening and final rollout checks

**Files:**
- `specs/implementation/mcp-v1-hard-switch-plan.md`
- `specs/raw/astrograph_jcodemunch_agent_spec.md`
- `specs/architecture/adrs.md`
- `src/mcp.ts`, `src/mcp-contract.ts`, `src/validation.ts`, `src/index.ts`, `src/types.ts`, `src/config.ts`, `src/language-registry.ts`
- `tests/interface.test.ts`, `tests/engine-contract.test.ts`, `tests/engine-behavior.test.ts`

- [ ] **Step 1: Run required final checks**

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "readiness|project status|diagnostics|deepening"
```

Expected:
- All checks pass.
- Parser/contract decision from Task A is implemented exactly.

- [ ] **Step 2: Version policy + commit checkpoint**

Run:

```bash
git add src/mcp.ts src/mcp-contract.ts src/validation.ts src/index.ts src/types.ts src/config.ts src/language-registry.ts src/scripts/install.ts tests/interface.test.ts tests/engine-contract.test.ts tests/engine-behavior.test.ts specs/implementation/mcp-v1-hard-switch-plan.md specs/raw/astrograph_jcodemunch_agent_spec.md specs/architecture/adrs.md specs/api-design/mcp-tools.md specs/implementation/README.md specs/README.md
pnpm check:version-bump
git commit -m "feat: hard-switch mcp to strict v1 retrieval tools"
```

Expected:
- `pnpm check:version-bump` passes.
- Commit message reflects hard-switch milestone.

## Rollout Checks (post-merge verification)

- `query_code` absent from MCP tool registration and runtime call-path assertions.
- All MCP calls return envelope response shape (`ok`, `meta`, optional `error`).
- Parser decision is documented and not silently changed:
  - if Option 1 chosen, existing fallback semantics are preserved
  - if Option 2/3 chosen, ADR and migration constraints are in ADR-003 and tests are updated
- MCP v1 does not include cache behavior.
- No broadening of MCP intent surface beyond explicit tools.
- No silent behavior drift in install guidance and docs.

## Reviewer Checklist

- [ ] `query_code` removed from all MCP-facing docs and `MCP_TOOL_DEFINITIONS`.
- [ ] New tool schemas use strict input validation and include version metadata.
- [ ] Dispatch always returns a strict envelope.
- [ ] Error responses are normalized and never raw thrown strings.
- [ ] Token metadata and freshness metadata are present in all successful responses.
- [ ] Parser strategy decision is explicitly recorded and tested.
- [ ] Targeted and contract tests pass before merge.
- [ ] Version policy check passed before commit.
