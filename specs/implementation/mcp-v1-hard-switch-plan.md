# MCP v1 Hard-Switch Plan: Explicit Tools, Strict Schemas, and Cache Deletion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MCP query surface with explicit retrieval tools, remove
`query_code`, ship a strict response envelope for all public MCP calls, and remove
cache behavior from MCP v1.

**Architecture:** Keep MCP as a thin executor layer over existing `src/storage.ts`
library functions, but change `src/mcp-contract.ts` and `src/mcp.ts` so all tool
registration, dispatch, and responses follow a v1 contract. MCP-facing cache
paths are removed in this slice and cache reintroduction is deferred to post-1.0.

**Tech Stack:** TypeScript, Node 24, `@modelcontextprotocol/sdk`, Zod, Vitest.

---

## Task 1: Freeze contract shape and baseline current behavior

**Files:**
- Modify: `specs/raw/astrograph_jcodemunch_agent_spec.md`
- Modify: `specs/api-design/mcp-tools.md`
- Modify: `specs/architecture/adrs.md`
- Modify: `specs/implementation/README.md`
- Modify: `specs/README.md`

- [ ] **Step 1: Confirm current baseline in docs and source**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts
pnpm exec vitest run tests/engine-contract.test.ts
```

Expected:
- All checks pass.
- Record baseline for `query_code` behavior, then remove it in the v1 cut.

- [ ] **Step 2: Lock decisions in docs**

Apply these decisions in spec/docs:
- `query_code` removed from MCP surface.
- v1 tools: `search_symbols`, `get_symbol_source`, `get_context_bundle`,
  `get_ranked_context`.
- Shared envelope: `ok/data/meta` with `error` on failure.
- Response/tool metadata versioning: `toolVersion: "1"` and registration `version: "1"`.
- No cache introduction or cache-related tools/behavior in v1.

Expected:
- `specs/architecture/adrs.md` includes ADR-003.
- `specs/api-design/mcp-tools.md` contains exact envelope schema.
- `specs/raw/astrograph_jcodemunch_agent_spec.md` has explicit hard-switch constraints.

## Task 2: Remove `query_code` tool and add v1 tool registry entries

**Files:**
- Modify: `src/mcp-contract.ts`
- Modify: `src/validation.ts` (cleanup MCP-facing `query_code` validation if no longer used by MCP tests/dispatch)
- Modify: `src/types.ts` (if new tool-level response metadata types are needed)

- [ ] **Step 1: Replace MCP tool list**

In `MCP_TOOL_DEFINITIONS`:
- remove `query_code`.
- add `search_symbols`, `get_symbol_source`, `get_context_bundle`,
  `get_ranked_context` with strict zod schemas.
- set each definition registration metadata `version: "1"` (or equivalent contract field
  on each tool definition).
- route `search_symbols` to `engine.searchSymbols`, `get_symbol_source` to
  `engine.getSymbolSource`, and bundle/retrieve tools to `getContextBundle` and
  `getRankedContext`.

Expected:
- Tool name list no longer includes `query_code`.
- New tools are discoverable via `MCP_TOOL_NAMES`.
- Update path includes full local state refresh (`.astrograph` delete/recreate) on hard-switch migration.

- [ ] **Step 2: Preserve query-code behavior outside MCP (optional)**

Keep `queryCode` exported from `src/index.ts` and underlying library for internal or
CLI usage; do not expose query/session cache pathways through MCP in this slice.

Expected:
- No break in non-MCP public API for this task.

## Task 3: Enforce strict v1 envelope and error model

**Files:**
- Modify: `src/mcp.ts`
- Modify: `src/index.ts` (if exporting envelope types)
- Add: tests in `tests/interface.test.ts`, `tests/engine-contract.test.ts`

- [ ] **Step 1: Add common envelope types and helpers**

Introduce strict v1 wrappers in MCP dispatch path:

- `type McpResponseEnvelope<T> = { ok: true; data: T; meta: { toolVersion: "1"; tokenBudgetUsed: number | null; dataFreshness: "fresh"|"stale"|"unknown"; warnings?: string[] } }`
- `type McpErrorEnvelope = { ok: false; data: null; error: { code: string; message: string; details?: Record<string, unknown> }; meta: { toolVersion: "1"; tokenBudgetUsed: null; dataFreshness: "unknown" } }`

Update `dispatchTool` and `createMcpServer` registration to always return envelopes.

Expected:
- Every MCP tool call returns one envelope shape.
- thrown exceptions are normalized into `ok: false` responses.

- [ ] **Step 2: Add tool token budget and freshness metadata into responses**

- `tokenBudgetUsed` should be computed from existing token estimate logic.
- `dataFreshness` follows existing freshness/staleness signals from diagnostics-like
  result metadata.

Expected:
- Clients can read one common response shape for routing/scheduling logic.

- [ ] **Step 3: Update interface tests**

Replace MCP interface expectations:
- assert new tool registration list includes `search_symbols`, `get_symbol_source`,
  `get_context_bundle`, `get_ranked_context`.
- assert `query_code` is not listed.
- assert new envelope shape (`ok`, `meta`, `error`) and metadata presence.

Expected:
- Tests enforce schema conformance and hard-switch behavior.

## Task 4: Final verification and cutover proof

**Files:**
- `tests/interface.test.ts`
- `tests/engine-contract.test.ts`

- [ ] **Step 1: Run focused verification**

```bash
pnpm type-lint
pnpm exec vitest run tests/interface.test.ts tests/engine-contract.test.ts
pnpm exec vitest run tests/engine-behavior.test.ts -t "readiness|project status|diagnostics"
```

Expected:
- All target tests pass.
- No MCP calls to `query_code` remain in interface flows.

- [ ] **Step 2: Release-gate and commit**

Run:

```bash
git add \
  src/mcp.ts \
  src/mcp-contract.ts \
  src/validation.ts \
  src/index.ts \
  src/types.ts \
  tests/interface.test.ts \
  tests/engine-contract.test.ts \
  specs/raw/astrograph_jcodemunch_agent_spec.md \
  specs/architecture/adrs.md \
  specs/api-design/mcp-tools.md \
  specs/implementation/README.md \
  specs/README.md
pnpm check:version-bump
git commit -m "feat: hard-switch MCP to v1 strict retrieval tools"
```

Expected:
- `pnpm check:version-bump` passes.
- Commit includes both implementation and contract updates.

## Rollout Checks

- No query/session/result cache behavior remains in MCP v1.
- `query_code` absent from MCP tool surface.
- All v1 MCP tools return strict envelope with `meta.toolVersion = "1"` and registration
  metadata versioning.
