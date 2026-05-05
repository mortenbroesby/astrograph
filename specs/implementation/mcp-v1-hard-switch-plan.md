# MCP v1 Hard-Switch Plan: Explicit Tools, Strict Schemas, and Cache Deletion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MCP v1 from `query_code`-first workflows to explicit retrieval tools, enforce a strict response envelope across all MCP calls, and remove MCP cache behavior. The resulting tool surface must preserve function without implicit orchestration.

**Architecture:** Keep MCP as a thin dispatcher around the existing engine in `src/index.ts` and schema/validator layers in `src/mcp-contract.ts` + `src/validation.ts`. MCP remains a transport boundary only: tool registrations, strict argument schemas, and standardized dispatch responses are enforced here while engine internals retain business logic.

**Tech Stack:** TypeScript, Node 24, `@modelcontextprotocol/sdk`, Zod, Vitest.

## Phase A: Tree-sitter-only parser cutover

## Execution sequencing (requested)

- [x] **0) Clarify and checkpoint inventory**

  Documented here and in the run log: complete the in-progress planning updates first.

- [x] **1) Checkpoint commit (MCPV1-2)**

  Check in the current plan state and task-priority update first, then commit and push that PR state.

- [x] **2) Implement MCPV1-3 strict v1 envelopes**

  Start from `src/mcp.ts` and `src/mcp-contract.ts`, then expand/update tests.

- [x] **3) Check in MCPV1-3**

  After step 2 is complete, commit and check in MCPV1-3 before parser/task cleanup resumes.

- [x] **4) Consider `oxc-resolver`/parser cleanup**

  `oxc-parser`/`oxc-resolver` cleanup is complete for this slice.
  Remaining parser work is now limited to deterministic regression coverage in Step 5.

**Files:**
- Modify: `src/parser.ts`
- Modify: `src/types.ts` (if parser backend literal types are exposed)
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `specs/raw/astrograph_jcodemunch_agent_spec.md`
- Modify: `specs/architecture/adrs.md`

- [x] **Step 1: Record the tree-sitter-only decision**

Update `specs/raw/astrograph_jcodemunch_agent_spec.md` and
`specs/architecture/adrs.md` with:
- parser execution is tree-sitter-only for this hard-switch;
- OXC is removed from active execution and dependencies in this slice;
- language coverage is prioritized over parser speed until v1 stabilizes;
- OXC can be reconsidered only in a later ADR after the MCP v1 contract is stable.

Expected:
- There is one documented parser decision.
- No spec text presents hybrid parsing as an available implementation path for this plan.

- [x] **Step 2: Establish current parser baseline before removal**

Run:

```bash
pnpm type-lint
pnpm exec node -e "const p=require('./package.json'); console.log({parserDeps:Object.fromEntries(Object.entries(p.dependencies ?? {}).filter(([k])=>['oxc-parser','oxc-resolver','tree-sitter','tree-sitter-javascript','tree-sitter-typescript'].includes(k)))})"
```

Expected:
- Current dependencies are visible before removal.
- Baseline command exits `0`.

- [x] **Step 3: Remove OXC parser execution**

In `src/parser.ts`:
- remove OXC imports and OXC parsing code;
- make `parseSourceFile` call the tree-sitter parser path directly;
- remove recovery fields that only describe OXC fallback, or normalize them to
  tree-sitter-only values if public types/tests still require them;
- keep chunked tree-sitter recovery for large or recoverable parse failures.

Expected:
- There is no active OXC parser execution path.
- Tree-sitter remains the only parser backend used by indexing.

> Done in PR #1 refactor. `src/parser.ts` is now 8 lines — a direct delegate to
> `parseWithTreeSitter`. No OXC imports remain anywhere in `src/`.

- [x] **Step 4: Remove OXC parser dependency**

Update dependency metadata:
- remove `oxc-parser` from `package.json` if unused after parser cutover;
- keep `oxc-resolver` only if import resolution still uses it outside parser code;
- update `pnpm-lock.yaml`.

Expected:
- No unused parser package remains.
- Import resolution dependencies are not removed unless source search confirms they are unused.

> `oxc-parser` and `oxc-resolver` are both removed from direct dependencies for
> this hard-switch slice, and no source files import `oxc-resolver`.

- [x] **Step 5: Add tree-sitter regression coverage**

Add or update tests to assert:
- parser backend metadata reports tree-sitter-only behavior;
- representative TS/JS/TSX/JSX fixtures still produce deterministic symbols;
- symbol drift caused by the parser cutover is reviewed and accepted in test snapshots or fixture assertions.

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/engine-contract.test.ts tests/engine-behavior.test.ts
```

Expected:
- Tests pass with tree-sitter as the only parser backend.
- Any accepted fixture changes are explicit in the test diff.

## Task 1: Lock v1 contract and baseline behavior (docs first)

**Files:**
- Modify: `specs/raw/astrograph_jcodemunch_agent_spec.md`
- Modify: `specs/api-design/mcp-tools.md`
- Modify: `specs/architecture/adrs.md`
- Modify: `specs/implementation/README.md`
- Modify: `specs/README.md`

- [x] **Step 1: Baseline current behavior in tests and docs**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts
pnpm exec vitest run tests/engine-contract.test.ts
```

Expected:
- All commands pass.
- Baseline includes current behavior of `query_code`, readiness output, and current tool registry shape.

- [x] **Step 2: Lock explicit v1 contract in docs**

Make and record all decisions:
- MCP v1 removes `query_code` from tool surface.
- New MCP v1 tools: `search_symbols`, `get_symbol_source`, `get_context_bundle`, `get_ranked_context`.
- Envelope is mandatory for all MCP tool calls: `ok`, `data`, `meta`, and optional `error` on failure.
- Registration metadata must include tool contract metadata (`toolVersion: "1"`).
- MCP cache behavior is removed from MCP v1; any future cache design requires a separate plan.

Expected:
- `specs/architecture/adrs.md` includes ADR-004 with the tree-sitter-only parser decision linked to Phase A.
- `specs/api-design/mcp-tools.md` has exact request/response envelopes for each new tool.
- `specs/raw/astrograph_jcodemunch_agent_spec.md` states that OXC is removed from active parser execution for the v1 hard-switch.

## Task 2: Remove `query_code` and add explicit MCP tool registrations

**Files:**
- Modify: `src/mcp-contract.ts`
- Modify: `src/validation.ts` (remove/retire MCP-only `query_code` branches)
- Modify: `src/language-registry.ts` (if tool-list snapshots used)
- Modify: `src/config.ts` (tool-list defaults/profile mapping)
- Modify: `src/types.ts` (MCP tool union/types)

- [x] **Step 1: Update MCP tool definitions**

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

- [x] **Step 2: Preserve non-MCP `queryCode` API where required**

If CLI or SDK still depends on non-MCP `queryCode`, keep it exported from `src/index.ts` but do not expose MCP path.

Expected:
- Non-MCP callers keep behavior.
- MCP no longer routes through `query_code`.

- [x] **Step 3: Align tool profile and install UX**

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

- [x] **Step 1: Introduce strict response envelopes**

Define and use:

- `McpResponseEnvelope<T> = { ok: true; data: T; meta: { toolVersion: "1"; tokenBudgetUsed: number | null; dataFreshness: "fresh" | "stale" | "unknown"; warnings?: string[] } }`
- `McpErrorEnvelope = { ok: false; data: null; error: { code: string; message: string; details?: Record<string, unknown> }; meta: { toolVersion: "1"; tokenBudgetUsed: null; dataFreshness: "unknown" } }`

Update `dispatchTool` and MCP tool registration to always return one of the two envelopes.

Expected:
- On success, every call returns `ok: true` and metadata.
- On throw, callers receive `ok: false` with normalized error code/message.

- [x] **Step 2: Add `dataFreshness` and token budget semantics**

Set freshness from existing metadata or explicit defaults.
Preserve current estimate values but move them into envelope metadata so callers can budget token use.

Expected:
- All successful responses include non-null `dataFreshness` and `tokenBudgetUsed` when available.
- Failures set `dataFreshness: "unknown"`, `tokenBudgetUsed: null`.

- [x] **Step 3: Add strict schema guards and parser metadata**

For `search_symbols`/`get_context_bundle`/`get_ranked_context`, assert:
- required arguments are present and typed
- engine outputs are runtime-validated for version contract
- parser metadata, when exposed, reports tree-sitter-only execution
- response metadata includes `toolVersion: "1"`

Expected:
- No untyped `any` escape path remains in MCP dispatch.

> Story 3 checks and implementation are now represented in Ralph Story-3. MCP dispatch, validation, and engine contract assertions already enforce v1 envelopes and contract tags across explicit tool calls.

## Task 4: Tests and interface lock-in

**Files:**
- Modify: `tests/interface.test.ts`
- Modify: `tests/engine-contract.test.ts`
- Modify: `tests/engine-behavior.test.ts`

- [x] **Step 1: Replace MCP interface assertions**

Update interface tests to assert:
- registry does not include `query_code`
- new tools are present
- new envelope shape for both success and error paths
- token budget + freshness metadata exists
- `query_code` references are removed from MCP contract assertions

Expected:
- Explicit coverage for the four v1 tools in happy-path and argument-validation paths.

- [x] **Step 2: Add tree-sitter parser regression tests**

- Add/extend tests to confirm tree-sitter-only parsing produces deterministic symbol IDs for selected fixtures.
- Review and accept any symbol snapshot changes caused by removing OXC execution.

Expected:
- Parser behavior remains deterministic with tree-sitter-only execution.

- [x] **Step 3: Run targeted behavioral verification**

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "readiness|diagnostics|project status|deepening"
```

Expected:
- All target tests pass.
- No MCP path invokes `query_code`.
- Parser metadata assertions reflect tree-sitter-only execution.

## Task 5: Release hardening and final rollout checks

**Files:**
- `specs/implementation/mcp-v1-hard-switch-plan.md`
- `specs/raw/astrograph_jcodemunch_agent_spec.md`
- `specs/architecture/adrs.md`
- `src/mcp.ts`, `src/mcp-contract.ts`, `src/validation.ts`, `src/index.ts`, `src/types.ts`, `src/config.ts`, `src/language-registry.ts`
- `tests/interface.test.ts`, `tests/engine-contract.test.ts`, `tests/engine-behavior.test.ts`

- [x] **Step 1: Run required final checks**

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "readiness|project status|diagnostics|deepening"
```

Expected:
- All checks pass.
- Tree-sitter-only parser cutover and MCP contract decisions are implemented exactly.

- [x] **Step 2: Version policy + commit checkpoint**

Run:

```bash
git add src/parser.ts src/mcp.ts src/mcp-contract.ts src/validation.ts src/index.ts src/types.ts src/config.ts src/language-registry.ts src/scripts/install.ts package.json pnpm-lock.yaml tests/interface.test.ts tests/engine-contract.test.ts tests/engine-behavior.test.ts specs/implementation/mcp-v1-hard-switch-plan.md specs/raw/astrograph_jcodemunch_agent_spec.md specs/architecture/adrs.md specs/api-design/mcp-tools.md specs/implementation/README.md specs/README.md
pnpm check:version-bump
git commit -m "feat: hard-switch mcp to strict v1 retrieval tools"
```

Expected:
- `pnpm check:version-bump` passes.
- Commit message reflects hard-switch milestone.

## Rollout Checks (post-merge verification)

- `query_code` absent from MCP tool registration and runtime call-path assertions.
- All MCP calls return envelope response shape (`ok`, `meta`, optional `error`).
- Parser decision is documented and implemented as tree-sitter-only.
- OXC is not present in active parser execution and may only return through a later ADR.
- MCP v1 does not include cache behavior.
- No broadening of MCP intent surface beyond explicit tools.
- No silent behavior drift in install guidance and docs.

## Reviewer Checklist

- [x] `query_code` removed from all MCP-facing docs and `MCP_TOOL_DEFINITIONS`.
- [x] New tool schemas use strict input validation and include version metadata.
- [x] Dispatch always returns a strict envelope.
- [x] Error responses are normalized and never raw thrown strings.
- [x] Token metadata and freshness metadata are present in all successful responses.
- [x] Tree-sitter-only parser decision is explicitly recorded and tested.
- [x] Targeted and contract tests pass before merge.
- [x] Version policy check passed before commit.
