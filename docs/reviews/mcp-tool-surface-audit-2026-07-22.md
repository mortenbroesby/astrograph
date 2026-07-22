# MCP Tool-Surface Audit — 2026-07-22

**Decision:** Select the smallest direct correction: generated Codex and
Copilot CLI installations must enable every MCP v1 tool, deriving that list
from `MCP_TOOL_DEFINITIONS`. The preferred core is guidance, not a hidden or
inaccessible capability tier. No MCP tool is removed or added.

## Scope and Method

This audit examined `origin/main` at `bedb192` and its MCP `tools/list`
response, using the source-backed stdio server and the project's exact
`cl100k_base` tokenizer. It covers the current command registry, MCP contract,
installer-generated client configuration, generated agent policy, retrieval
guide, and interface/contract tests.

The server returned 14 MCP tools: 7,516 UTF-8 bytes / 1,520 serialized
`cl100k_base` tokens. The former global installer allowlist exposed 10 of them:
5,476 bytes / 1,101 tokens. The four omitted definitions add 2,040 bytes / 419
tokens. These are schema payload measurements only; they do not represent host
prompt framing or tool-call results.

## MCP Workflow Matrix

Every MCP command requires `repoRoot`. “Required input” lists its additional
required input. Bytes/tokens are each individual serialized `tools/list` item.

| Tool | Distinct workflow intent | Required input | Bytes / tokens | Policy | Evidence/caller |
| --- | --- | --- | ---: | --- | --- |
| `index_folder` | Build or rebuild repository index | — | 406 / 82 | Core | readiness recovery; installer and MCP |
| `index_file` | Refresh one changed supported file | `filePath` | 499 / 99 | Core | targeted refresh; installer and MCP |
| `find_files` | Locate candidate paths by name/path | — | 568 / 117 | Specialized | path-only discovery fallback; MCP |
| `search_text` | Find literal text when symbols are insufficient | `query` | 583 / 118 | Specialized | lexical fallback; CLI/MCP |
| `get_file_summary` | Inspect deterministic file summary | `filePath` | 435 / 89 | Specialized | file-level fallback; MCP |
| `get_project_status` | Decide whether index/readiness is trustworthy | — | 450 / 95 | Core | first operation in generated policy; MCP |
| `get_repo_outline` | Orient by language/file/symbol totals | — | 323 / 69 | Core | structural orientation; CLI/MCP |
| `get_file_tree` | List indexed files and symbol counts | — | 323 / 69 | Core | structural orientation; CLI/MCP |
| `get_file_outline` | Inspect symbols before reading a file | `filePath` | 402 / 84 | Core | default retrieval guide; CLI/MCP |
| `suggest_initial_queries` | Offer first discovery anchors | — | 330 / 69 | Core | concise discovery aid; CLI/MCP |
| `search_symbols` | Locate exact indexed symbols | `query` | 819 / 168 | Core | default retrieval guide; CLI/MCP |
| `get_symbol_source` | Retrieve exact source by symbol id | `symbolId` or `symbolIds` | 684 / 135 | Core | default retrieval guide; CLI/MCP |
| `get_task_context` | Assemble bounded, attributed task context | — | 1,261 / 236 | Core | bounded escalation; CLI/MCP |
| `diagnostics` | Diagnose storage/freshness/retrieval health | — | 418 / 88 | Core | health/recovery; CLI/MCP |

`get_task_context` is the largest individual definition (236 tokens), but it
has a distinct bounded-assembly contract. The audit found no redundant MCP
tool with equivalent inputs and output semantics, so removal is not justified.

## CLI-Only Commands

The registry also has five CLI-only commands. They do not contribute to MCP
schema overhead and each retains a different human/operator workflow:

| Command | Intent | Decision |
| --- | --- | --- |
| `init` | initialize/inspect repository storage | retain; bootstrap workflow |
| `watch` | keep an index refreshed while a process runs | retain; lifecycle workflow |
| `query-code` | direct CLI/library discovery and source query | retain; not an MCP v1 tool; no removal evidence |
| `get-file-content` | explicit whole-file CLI retrieval | retain; deliberate fallback outside MCP |
| `doctor` | human-readable health report | retain; operator-facing counterpart to diagnostics |

## Reproduced Global-Workflow Confusion

Before this selection, `src/scripts/install.ts` generated a 10-tool
`enabled_tools`/`tools` allowlist for global Codex and Copilot CLI setup. Its
generated `AGENTS.md` and Copilot instructions simultaneously told agents to
start with `get_project_status` and to use `find_files`, `search_text`, and
`get_file_summary`. All four were absent from that allowlist. The focused
installer regression test failed against that exact mismatch before the fix.

This is a real capability contradiction, not a count preference: an installed
client can be instructed to use a tool that its own generated configuration
does not expose. Restricting the policy text instead would keep specialized
fallbacks inaccessible, contrary to Story 5’s requirement that advanced tools
remain directly callable and discoverable.

## jCodeMunch Comparison

The comparison source is jCodeMunch’s README on its `main` branch, accessed
2026-07-22: <https://github.com/jgravelle/jcodemunch-mcp>. It documents 60+
tools, configurable core/standard/full tiers, compact schemas, and a
three-tool `counter` front door that routes to hidden actions.

Its useful lesson is to make a recommended core explicit and explain a
discovery-first composition. Astrograph must not copy its tier filtering,
adaptive selection, `menu`/`route` front door, or tool-count framing: this
story forbids hidden selection and a generic router, and Astrograph’s 14-tool
surface has a materially different 1,520-token baseline.

## Selected Policy

- **Preferred core:** status/indexing, structural orientation, initial-query
  suggestions, symbol discovery, exact source, bounded task context, and
  diagnostics.
- **Specialized direct tools:** `find_files`, `search_text`, and
  `get_file_summary`; use them when the core intent does not fit.
- **Visibility:** all 14 remain directly exposed by generated global Codex and
  Copilot CLI configuration. The core is a documented default workflow, not a
  hidden or dynamic server mode.
- **No selection:** do not remove a tool, add aliases, implement a router, or
  make schema size a standalone target. Reconsider removal only with evidence
  that a specific tool lacks a distinct workflow and has no caller/contract.

## Verification Pointers

- `tests/interface.test.ts` proves the live `tools/list` order matches
  `MCP_TOOL_DEFINITIONS` and that `query_code` is not exposed through MCP.
- `tests/engine-contract.test.ts` proves global Codex and Copilot setup is
  idempotent and retains unrelated configuration; its added regression asserts
  the four formerly inaccessible policy tools are enabled.
- `src/mcp.ts` registers each definition without a hidden routing layer.
