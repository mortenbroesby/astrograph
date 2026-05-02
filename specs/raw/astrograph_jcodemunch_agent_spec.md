# Astrograph Agent-Facing Implementation Spec

**Document purpose:** Turn the Astrograph vs jCodeMunch analysis into a concrete, implementation-oriented roadmap that a coding agent can execute slice by slice.

**Target repository:** `mortenbroesby/astrograph`

**Important repository rule:** Use the standalone Astrograph repository as the source of truth. Do **not** use the old `playground/tools/ai-context-engine` path as the baseline for implementation planning.

**Audience:** Coding agents, maintainers, and reviewers working on Astrograph.

**Primary goal:** Make Astrograph a highly efficient, local, deterministic, token-conscious MCP code-intelligence server that can compete with the practical agent-facing value of jCodeMunch while keeping Astrograph’s own architecture clean, TypeScript-native, and local-first.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Current Astrograph baseline](#2-current-astrograph-baseline)
3. [What “great” means for an MCP code-intelligence setup](#3-what-great-means-for-an-mcp-code-intelligence-setup)
4. [One-to-one comparison: Astrograph vs jCodeMunch](#4-one-to-one-comparison-astrograph-vs-jcodemunch)
5. [Guiding implementation principles](#5-guiding-implementation-principles)
6. [Workstream A: MCP tool surface](#6-workstream-a-mcp-tool-surface)
7. [Workstream B: Search, ranking, and retrieval algorithms](#7-workstream-b-search-ranking-and-retrieval-algorithms)
8. [Workstream C: Token efficiency and compact output](#8-workstream-c-token-efficiency-and-compact-output)
9. [Workstream D: Caching, freshness, and index generation](#9-workstream-d-caching-freshness-and-index-generation)
10. [Workstream E: Stable symbol identity](#10-workstream-e-stable-symbol-identity)
11. [Workstream F: Graph, references, dependencies, and impact](#11-workstream-f-graph-references-dependencies-and-impact)
12. [Workstream G: Language adapters and polyglot support](#12-workstream-g-language-adapters-and-polyglot-support)
13. [Workstream H: Runtime profiles, compact schemas, and setup modes](#13-workstream-h-runtime-profiles-compact-schemas-and-setup-modes)
14. [Workstream I: Agent guidance, hooks, sessions, and edit lifecycle](#14-workstream-i-agent-guidance-hooks-sessions-and-edit-lifecycle)
15. [Workstream J: Benchmarks and comparison harness](#15-workstream-j-benchmarks-and-comparison-harness)
16. [Suggested file and module layout](#16-suggested-file-and-module-layout)
17. [Useful packages and tools](#17-useful-packages-and-tools)
18. [Prioritized roadmap](#18-prioritized-roadmap)
19. [Definition of done](#19-definition-of-done)
20. [Agent execution notes](#20-agent-execution-notes)

---

## 1. Executive summary

Astrograph already has a strong foundation:

- standalone npm package identity,
- local-first repo indexing,
- SQLite-backed storage,
- tree-sitter parser execution for JavaScript and TypeScript during the MCP v1 hard-switch,
- `astrograph init` setup flow,
- install profiles such as `full`, `some`, and `barebones`,
- MCP server,
- JSON CLI,
- library exports,
- watch/freshness behavior,
- token-budgeted context bundle types,
- benchmark and profiling scripts.

The current gap is not that Astrograph lacks a foundation. The gap is that Astrograph’s **agent-facing MCP surface and retrieval behavior are still narrower** than what a jCodeMunch-style code-intelligence workflow provides.

The highest-value improvements are:

1. Expose direct retrieval tools in MCP, not only `query_code`.
2. Add detail levels and response envelopes.
3. Add index generation and freshness controls (cache features are deferred/removed in v1).
4. Improve ranking with identifier tokenization, BM25, fuzzy fallback, and centrality.
5. Move to stable semantic symbol IDs.
6. Add relationship graph tables and explicit graph tools.
7. Add compact output encoding for large structured responses.
8. Add runtime tool profiles and compact schemas.
9. Add staged language adapters, starting with one non-JS language.
10. Add agent guidance, session memory, edit registration, and hooks.
11. Benchmark everything against real tasks and jCodeMunch-like workflows.

This spec is written so an implementation agent can start from the highest-priority slices without needing to infer the product strategy.

## 0. V1 Hard-Switch Directive (approved for implementation)

The roadmap below is now governed by the following mandatory decisions:

- Hard break from the pre-existing MCP contract is allowed in this milestone.
- `query_code` is **removed** from the MCP tool surface in v1.
- MCP v1 uses strict per-tool schemas only (no compact schema variants in this slice).
- Cache is fully removed in v1. No cache tables, cache-driven tools, or cache-hit logic are implemented before `1.0.0`.
- Backward compatibility is intentionally deprioritized in this hard-switch; migration is release-focused.
- Tool contract versioning is explicit at both levels:
  - Tool registration metadata: `version: "1"` for new v1 tools.
  - Response envelope metadata: `meta.toolVersion === "1"`.
- On version upgrades, treat `.astrograph` as disposable cache/state and rebuild from a clean `.astrograph` directory.
- Tool names remain readable and stable (no `_v1` suffix); version is carried in metadata.
- Hard-switch slice scope is Workstreams A, C, and E only (MCP tool surface, strict schema/token metadata, stable symbol identity prep).

This document is now the source for the v1 implementation pass; all implementation plans and ADRs below should reflect these constraints unless explicitly changed by a later approved ADR.

---

## 2. Current Astrograph baseline

Use the standalone repo as baseline.

Observed current-state assumptions:

- Package name: `@mortenbroesby/astrograph`.
- Runtime target: Node 24+.
- Core stack includes TypeScript, SQLite via `better-sqlite3`, tree-sitter JS/TS parsing for the MCP v1 hard-switch, ripgrep fallback, `@modelcontextprotocol/sdk`, `piscina`, `@parcel/watcher`, tokenizers, and benchmarking/profiling scripts. OXC parser execution is removed from the active v1 hard-switch path; OXC may only return through a later ADR after the MCP v1 contract stabilizes.
- README positions Astrograph as a local MCP server for AI agents.
- `astrograph init` can configure MCP settings for Codex, GitHub Copilot, and GitHub Copilot CLI.
- Setup modes exist: `full`, `some`, and `barebones`.
- Current MCP tools are narrow and centered around indexing, discovery, outlines, `query_code`, status, and diagnostics.
- Library exports more retrieval functionality than MCP currently exposes.
- Current graph-tier language support is JavaScript and TypeScript family only: `ts`, `tsx`, `js`, `jsx`.
- Fallback support exists for file summaries/discovery for Markdown, JSON, YAML, SQL, shell, and text, but these are not graph-tier languages.
- Current ranking uses deterministic weights such as exact name, prefix, summary contains, path contains, token match, and exported bonus.
- Current parser-generated symbol IDs include byte-offset information, which can make symbol IDs unstable after edits that shift source positions.

The immediate architectural opportunity is to expose and harden existing capabilities before building new advanced features.

---

## 3. What “great” means for an MCP code-intelligence setup

A great MCP code-intelligence setup helps agents answer code questions with the smallest useful context.

It should support both exploration and editing:

- “Where is this implemented?”
- “Show me the exact source for this function.”
- “What context do I need to modify this behavior?”
- “Who calls this?”
- “What breaks if I change this?”
- “Can I safely rename this?”
- “Which tests are relevant?”
- “Is the index fresh after my edits?”

### 3.1 Core user experience requirements

A great setup should provide:

| Requirement | Meaning | Why it matters |
|---|---|---|
| Easy install | One command writes MCP config. | Adoption depends on low friction. |
| Clear tool workflow | Search → outline → source → bundle → relationships. | Agents need obvious action paths. |
| Exact source retrieval | Return a symbol or small source span instead of a whole file. | Major token savings. |
| Token budgets | Every broad tool can cap output. | Prevents runaway context use. |
| Detail levels | Compact discovery first; full source only when needed. | Reduces token cost and noise. |
| Freshness signals | Responses indicate whether indexed data is fresh or stale. | Prevents wrong answers from stale code. |
| Cheap incremental refresh | Reindex changed files without full repo reindex. | Essential for large repos. |
| Smart cache | Repeat queries are cheap but invalidated correctly. | Deferred in v1; cache is removed until `1.0.0`. |
| Stable symbol IDs | Symbol identity survives minor source edits. | Enables sessions, references, and diffs. |
| Graph intelligence | Imports, references, callers, dependencies, blast radius. | Enables safe editing. |
| Polyglot path | Can grow beyond JS/TS without spaghetti parser logic. | Real repos are mixed-language. |
| Compact encoding | Large structured responses can be encoded efficiently. | Saves tokens beyond retrieval narrowing. |
| Benchmarks | Retrieval quality and token savings are measured. | Prevents feature claims from becoming guesses. |

### 3.2 The key product principle

A code MCP should not simply expose files. It should help the agent choose **the minimum useful code**.

A poor workflow is:

```text
grep → read full files → paste too much context → guess
```

A great workflow is:

```text
search symbols → inspect outline → retrieve exact source → assemble bounded bundle → check references/impact
```

---

## 4. One-to-one comparison: Astrograph vs jCodeMunch

| Area | Astrograph current state | jCodeMunch-style capability | Gap / action |
|---|---|---|---|
| Install and setup | Strong standalone `astrograph init` flow with IDE modes. | Broad setup plus guide/hook/session concepts. | Add runtime guidance and lifecycle hooks. |
| MCP surface | Narrow, centered on `query_code` and discovery/status tools. | Broad explicit workflow tools. | Expose direct retrieval tools. |
| Library capability | Exports `searchSymbols`, `getSymbolSource`, `getContextBundle`, `getRankedContext`, etc. | MCP exposes most workflow steps directly. | Map existing exports into MCP. |
| Search/ranking | Deterministic weighted scoring. | BM25, fuzzy, abbreviations, semantic, centrality. | Add stronger retrieval algorithms. |
| Token efficiency | Token-budgeted bundles and token tooling. | Detail levels, token budgets, compact output, schema profiles. | Add detail levels and compact encoding. |
| Language support | JS/TS graph tier; discovery fallback for several file types. | Broad polyglot language registry. | Add language adapters gradually. |
| Symbol identity | Current IDs include byte offsets. | Stable semantic symbol identities. | Add stable IDs and alias migration. |
| Graph relationships | Some dependency/importer/reference expansion inputs exist. | Explicit graph/reference/call/impact tools. | Add graph tables and tools. |
| Freshness | Good status/watch/freshness foundation. | Watch, reindex, session-aware tool behavior. | Add index generation and register-edit. |
| Agent workflow | Good IDE config generation. | Guide, hooks, session state, runtime tiering. | Add guide/policy/session tools. |
| Benchmarking | Benchmark scripts exist. | Token-saving and workflow comparison emphasis. | Build task-card comparison harness. |

---

## 5. Guiding implementation principles

### 5.1 Prefer direct, obvious MCP tools over one overloaded umbrella tool

Keep `query_code`, but do not force all workflows through it.

Add direct tools for common agent intentions:

```text
search_symbols
get_symbol_source
get_context_bundle
get_ranked_context
get_file_content
find_importers
find_references
get_dependency_graph
```

### 5.2 Keep Astrograph local and deterministic

Avoid adding hosted dependencies or mandatory embedding providers early. Semantic search can be optional later.

### 5.3 Do not add broad language support before language adapters exist

Avoid stuffing many languages into `parser.ts`.

Create a clean adapter system first.

### 5.4 Make every broad response budgetable

Any tool that can return many items should accept:

```ts
tokenBudget?: number;
detailLevel?: "compact" | "standard" | "full";
format?: "auto" | "json" | "compact";
```

### 5.5 Prefer confidence over false certainty

For references and graph edges, include confidence and evidence.

Example:

```json
{
  "confidence": 0.78,
  "evidence": "named import binding plus identifier usage"
}
```

### 5.6 Benchmark before claiming parity

Every major retrieval improvement should be measured on task cards.

---

## 6. Workstream A: MCP tool surface

### Goal

Expose Astrograph’s existing direct retrieval functionality through MCP so agents can use simple, explicit tools instead of relying only on `query_code`.

### Why this is important

The library already exports retrieval APIs that are not first-class MCP tools. This means Astrograph has hidden capability that agents cannot easily use.

### Tools to add first

Add these MCP tools:

```text
search_symbols
get_symbol_source
get_context_bundle
get_ranked_context
get_file_content
astrograph_guide
```

### Files to modify

```text
src/mcp-contract.ts
src/mcp.ts
src/types.ts
src/validation.ts
src/language-registry.ts
src/cli.ts, if CLI flags need parity
tests/*
README.md
docs/CLI.md, if present
```

### Tool behavior

#### `search_symbols`

Purpose:

```text
Find relevant indexed symbols by query.
```

Input draft:

```ts
{
  repoRoot: string;
  query: string;
  kind?: string;
  language?: string;
  filePattern?: string;
  limit?: number;
  detailLevel?: "compact" | "standard" | "full";
  tokenBudget?: number;
  includeScoreBreakdown?: boolean;
}
```

Initial implementation can delegate to existing `searchSymbols` and ignore advanced options until later.

#### `get_symbol_source`

Purpose:

```text
Return exact source for one or more symbols.
```

Input draft:

```ts
{
  repoRoot: string;
  symbolId?: string;
  symbolIds?: string[];
  contextLines?: number;
  verify?: boolean;
}
```

#### `get_context_bundle`

Purpose:

```text
Assemble relevant source snippets under a token budget.
```

Input draft:

```ts
{
  repoRoot: string;
  query?: string;
  symbolIds?: string[];
  tokenBudget?: number;
  includeDependencies?: boolean;
  includeImporters?: boolean;
  includeReferences?: boolean;
  relationDepth?: number;
}
```

#### `get_ranked_context`

Purpose:

```text
Search and assemble a ranked context bundle in one step.
```

#### `get_file_content`

Purpose:

```text
Controlled file read with freshness metadata. Use only when symbol-level retrieval is insufficient.
```

#### `astrograph_guide`

Purpose:

```text
Tell the agent how to use Astrograph correctly.
```

Output example:

```text
Use Astrograph before broad file reads.

Implementation lookup:
1. search_symbols
2. get_symbol_source
3. get_context_bundle if surrounding context is needed

File exploration:
1. find_files
2. get_file_outline
3. get_file_content only if necessary

Editing:
1. find_references or get_dependency_graph
2. edit
3. index_file after changes
```

### Acceptance criteria

- MCP tool list includes the new direct retrieval tools.
- Existing `query_code` still works.
- Existing CLI and library APIs remain backward compatible.
- Interface tests assert the new MCP tools are registered.
- README documents the direct retrieval workflow.

### Example agent workflow after this slice

User asks:

```text
Where does Astrograph choose supported files for indexing?
```

Agent should do:

```text
1. search_symbols(query="supported files indexing")
2. get_symbol_source(symbolId=<best match>)
3. get_context_bundle(symbolIds=[...], includeDependencies=true, tokenBudget=2000)
```

---

## 7. Workstream B: Search, ranking, and retrieval algorithms

### Goal

Move Astrograph search from deterministic weighted matching to a richer code-search pipeline.

### Why this is important

Most user questions are not exact symbol names. Users ask vague conceptual questions:

```text
"auth validation"
"watch refresh"
"where do we parse config"
"token savings"
"repo freshness"
```

Astrograph must retrieve the right symbol even when the query does not match the name exactly.

### New modules

Create:

```text
src/retrieval/tokenizer.ts
src/retrieval/symbol-document.ts
src/retrieval/bm25.ts
src/retrieval/fuzzy.ts
src/retrieval/centrality.ts
src/retrieval/ranking.ts
src/retrieval/result-cache.ts
```

### Algorithm 1: Identifier-aware tokenizer

Implement a tokenizer that handles code identifiers.

Input examples:

```text
getRepoOutline
repo_root
query-code
ASTROGRAPH_PACKAGE_VERSION
src/mcp-contract.ts
```

Expected tokens:

```text
get, repo, outline
repo, root
query, code
astrograph, package, version
src, mcp, contract, ts
```

Add abbreviation expansion:

```text
ctx  -> context
cfg  -> config, configuration
db   -> database
auth -> authentication, authorization
repo -> repository
impl -> implementation
fn   -> function
```

### Algorithm 2: Symbol document model

Each symbol should become a search document:

```ts
interface SymbolSearchDocument {
  symbolId: string;
  fields: {
    name: string;
    qualifiedName: string | null;
    kind: string;
    filePath: string;
    signature: string;
    summary: string;
    exported: boolean;
  };
  tokens: string[];
}
```

Apply field weights:

```ts
name: 3
qualifiedName: 3
signature: 2
summary: 1
filePath: 1
kind: 1
```

### Algorithm 3: BM25

Add BM25 scoring over symbol documents.

Pseudo-interface:

```ts
export interface Bm25Index {
  idf: Map<string, number>;
  avgDocLength: number;
  documents: Map<string, SymbolSearchDocument>;
  inverted: Map<string, string[]>;
}

export function buildBm25Index(docs: SymbolSearchDocument[]): Bm25Index;

export function scoreBm25(input: {
  index: Bm25Index;
  queryTokens: string[];
  symbolId: string;
}): number;
```

### Algorithm 4: Fuzzy fallback

When confidence is low, try fuzzy matching.

Use:

```text
trigram similarity
edit distance
```

Example:

```text
query: "diagnositcs"
should find: "diagnostics"
```

### Algorithm 5: Centrality

Once graph edges are reliable, compute centrality from dependencies/imports.

Use a simple first version:

```text
centrality(file) = log(1 + importer_count(file))
```

Later add PageRank if needed.

### Ranking result shape

Add score breakdown for debug mode:

```json
{
  "symbol": {
    "id": "src/storage.ts::searchSymbols#function",
    "name": "searchSymbols",
    "filePath": "src/storage.ts"
  },
  "score": 124.7,
  "reasons": [
    "query token matched name",
    "summary matched search",
    "exported symbol",
    "central file"
  ],
  "scoreBreakdown": {
    "exactName": 0,
    "prefixName": 0,
    "bm25": 88.1,
    "fuzzy": 0,
    "centrality": 6.6,
    "exportedBonus": 20,
    "path": 10
  }
}
```

### Acceptance criteria

- `search_symbols` supports ranking with tokenized query terms.
- Exact symbol-name queries still rank exact matches first.
- Vague queries retrieve sensible symbols in tests.
- Typo tests pass for fuzzy fallback.
- Debug mode returns score breakdown.
- Benchmarks compare current ranking vs enhanced ranking.

---

## 8. Workstream C: Token efficiency and compact output

### Goal

Reduce token usage at three layers:

1. retrieve less source,
2. return less metadata,
3. encode repetitive structured data more compactly.

### Required options

Add common options to broad tools:

```ts
detailLevel?: "compact" | "standard" | "full";
tokenBudget?: number;
format?: "auto" | "json" | "compact";
```

### Detail-level definitions

#### Compact

For discovery.

```json
{
  "id": "src/storage.ts::searchSymbols#function",
  "name": "searchSymbols",
  "kind": "function",
  "filePath": "src/storage.ts",
  "startLine": 1200,
  "score": 92.1
}
```

#### Standard

For selection.

```json
{
  "id": "src/storage.ts::searchSymbols#function",
  "name": "searchSymbols",
  "kind": "function",
  "filePath": "src/storage.ts",
  "signature": "export async function searchSymbols(...)",
  "summary": "Search indexed symbols by query and filters",
  "reasons": ["name match", "summary match"]
}
```

#### Full

For source retrieval.

```json
{
  "symbol": { "...": "..." },
  "source": "export async function searchSymbols(...) { ... }",
  "verified": true
}
```

### Compact encoding

Create:

```text
src/encoding/compact.ts
src/encoding/json.ts
src/encoding/format.ts
src/encoding/token-cost.ts
```

Suggested compact format for table-like results:

```json
{
  "format": "astrograph.compact.v1",
  "columns": ["id", "name", "kind", "path", "line", "score"],
  "paths": ["src/storage.ts", "src/mcp-contract.ts"],
  "rows": [
    ["s1", "searchSymbols", "function", 0, 1200, 92.1],
    ["s2", "queryCode", "function", 0, 1400, 84.7],
    ["s3", "MCP_TOOL_DEFINITIONS", "constant", 1, 40, 70.2]
  ]
}
```

### Auto mode

Use `format: "auto"` by default for large structured responses.

Auto mode should:

1. produce JSON,
2. produce compact,
3. estimate or count tokens/bytes,
4. return compact only if savings exceed threshold.

Suggested threshold:

```text
15% byte or token savings
```

### Acceptance criteria

- `format=json` always returns normal JSON.
- `format=compact` always returns compact format if supported.
- `format=auto` returns compact only when worthwhile.
- Small outputs stay JSON.
- Compact responses are deterministic.
- Serialization benchmark records JSON vs compact size.

---

## 9. Workstream D: Caching, freshness, and index generation

### Goal

Make repeated queries fast without ever returning stale results silently.

### Add index generation

Add a metadata key:

```text
indexGeneration
```

Bump it when indexed content changes:

```text
index_folder
index_file
watch-triggered reindex
register_edit
storage rebuild
```

### Add query cache table

```sql
CREATE TABLE IF NOT EXISTS query_cache (
  cache_key TEXT PRIMARY KEY,
  repo_root TEXT NOT NULL,
  index_generation TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  result_tokens INTEGER,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);
```

### Cache key should include

```text
repo root
index generation
tool name
query
symbol ids
file path
filters
detail level
token budget
relation depth
format
ranking mode
```

### In-memory cache

Use a small LRU cache for hot results.

Possible package:

```text
lru-cache
```

Or implement a simple Map-based LRU locally.

### Cache these first

```text
search_symbols
find_files
get_file_tree
get_file_outline
get_ranked_context
query_code discover
```

### Avoid caching these aggressively at first

```text
get_file_content
get_symbol_source
```

If source retrieval is cached, include content hash and verification state in the key.

### Acceptance criteria

- Same query on same index generation hits cache.
- Reindex invalidates cache via generation change.
- Cache hit/miss is visible in `_meta`.
- Cached results do not bypass freshness warnings.
- Tests cover cache invalidation after `index_file`.

---

## 10. Workstream E: Stable symbol identity

### Goal

Make symbol IDs survive ordinary edits.

### Current problem

Current IDs include byte offsets. If code is inserted above a symbol, the same function may receive a new ID.

### New identity model

Use semantic IDs:

```text
src/config.ts::parseConfig#function
src/storage.ts::StorageIndex.open#method
src/types.ts::SearchSymbolsOptions#type
```

For collisions:

```text
src/foo.ts::handler#function
src/foo.ts::handler#function~2
```

### Storage migration

Add fields:

```sql
ALTER TABLE symbols ADD COLUMN stable_id TEXT;
ALTER TABLE symbols ADD COLUMN signature_hash TEXT;

CREATE TABLE IF NOT EXISTS symbol_aliases (
  alias_id TEXT PRIMARY KEY,
  symbol_id TEXT NOT NULL,
  alias_kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### Parser change

Add:

```ts
function buildStableSymbolId(input: {
  relativePath: string;
  qualifiedName: string;
  kind: SymbolKind;
  collisionIndex?: number;
}): string {
  const base = `${input.relativePath}::${input.qualifiedName}#${input.kind}`;
  return input.collisionIndex ? `${base}~${input.collisionIndex}` : base;
}
```

### Compatibility

During migration:

- Accept old IDs in retrieval tools.
- Resolve old IDs through `symbol_aliases`.
- Return both `id` and `stableId` in standard/full detail levels.

### Acceptance criteria

- Same function keeps stable ID after adding lines above it.
- Old ID can still retrieve source after migration.
- Duplicate names get deterministic suffixes.
- Tests cover stable ID behavior after reindex.

---

## 11. Workstream F: Graph, references, dependencies, and impact

### Goal

Move from “find code” to “understand relationships and edit impact.”

### Add graph tables

```sql
CREATE TABLE IF NOT EXISTS symbol_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  referenced_name TEXT NOT NULL,
  target_symbol_id TEXT,
  reference_kind TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER,
  start_byte INTEGER NOT NULL,
  end_byte INTEGER,
  confidence REAL NOT NULL,
  evidence TEXT,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_symbol_references_target
  ON symbol_references(target_symbol_id);

CREATE INDEX IF NOT EXISTS idx_symbol_references_name
  ON symbol_references(referenced_name);

CREATE TABLE IF NOT EXISTS symbol_edges (
  from_symbol_id TEXT NOT NULL,
  to_symbol_id TEXT,
  edge_kind TEXT NOT NULL,
  confidence REAL NOT NULL,
  evidence TEXT,
  PRIMARY KEY(from_symbol_id, to_symbol_id, edge_kind)
);
```

### Add graph modules

```text
src/graph/importers.ts
src/graph/references.ts
src/graph/dependency-graph.ts
src/graph/related-symbols.ts
src/graph/call-graph.ts
src/graph/blast-radius.ts
src/graph/rename-safety.ts
```

### First graph tools

Add in this order:

```text
find_importers
find_references
get_dependency_graph
get_related_symbols
```

### Later graph/impact tools

```text
get_call_hierarchy
get_class_hierarchy
get_blast_radius
check_rename_safe
get_impact_preview
get_changed_symbols
get_symbol_diff
```

### Reference confidence model

Example confidence levels:

```text
1.00 exact import binding and symbol match
0.85 import binding plus identifier usage
0.70 same-file local symbol reference
0.55 name match in likely related file
0.30 text-only fallback match
```

### Example `find_references` output

```json
{
  "target": {
    "symbolId": "src/config.ts::parseConfig#function",
    "name": "parseConfig"
  },
  "references": [
    {
      "filePath": "src/cli.ts",
      "line": 42,
      "referenceKind": "call",
      "preview": "const config = parseConfig(raw);",
      "confidence": 0.85,
      "evidence": "import binding + call expression"
    }
  ],
  "truncated": false
}
```

### Acceptance criteria

- `find_importers` works using current file dependency data.
- `find_references` returns confidence and evidence.
- `get_dependency_graph` can output compact graph data under a budget.
- Graph tools respect stale/fresh status.
- Tests include simple JS/TS reference fixtures.

---

## 12. Workstream G: Language adapters and polyglot support

### Goal

Support more languages without turning `parser.ts` into a giant switch statement.

### Do not do this

Do not install many tree-sitter grammars at once and claim polyglot support.

### Do this instead

Create language adapters:

```text
src/languages/adapter.ts
src/languages/registry.ts
src/languages/javascript.ts
src/languages/typescript.ts
src/languages/python.ts
src/languages/go.ts
src/languages/rust.ts
```

### Adapter interface

```ts
export interface LanguageAdapter {
  language: string;
  extensions: string[];
  supportTier: "outline" | "retrieval" | "graph";
  parserBackend: "tree-sitter" | "regex" | "external";

  parse(input: {
    filePath: string;
    content: string;
    summaryStrategy: SummaryStrategy;
  }): ParsedFile;

  resolveImport?(input: {
    repoRoot: string;
    importerPath: string;
    source: string;
    indexedFiles: Set<string>;
  }): string | null;

  extractReferences?(input: {
    parsed: ParsedFile;
    content: string;
  }): ParsedReference[];

  extractCalls?(input: {
    parsed: ParsedFile;
    content: string;
  }): ParsedCall[];
}
```

### Support tiers

| Tier | Meaning |
|---|---|
| `outline` | Can index files and list symbols. |
| `retrieval` | Can search symbols and retrieve exact source. |
| `graph` | Can resolve imports/references/calls well enough for graph tools. |

### First pilot language

Recommended: Python.

Initial Python scope:

```text
functions
classes
methods
imports
module-level constants
docstrings
exact source spans
```

Out of scope for first pilot:

```text
full call graph
type-aware resolution
dependency-aware context bundle parity
```

### Acceptance criteria for first language pilot

- Python files are discovered and indexed.
- Repo outline includes Python file/symbol counts.
- File outline works for Python.
- Symbol search works for Python symbols.
- Exact symbol source retrieval works for Python.
- Python support tier is documented honestly.

---

## 13. Workstream H: Runtime profiles, compact schemas, and setup modes

### Goal

Keep the MCP surface manageable as Astrograph adds tools.

### Current state

Astrograph already has setup modes:

```text
full
some
barebones
```

These are useful but should not be confused with runtime tool profiles.

### Add runtime profiles

```text
core
standard
full
```

### Suggested profile contents

#### Core

```text
query_code
search_symbols
get_symbol_source
get_context_bundle
find_files
search_text
get_project_status
astrograph_guide
```

#### Standard

```text
core +
get_file_tree
get_file_outline
get_repo_outline
get_ranked_context
get_file_content
find_importers
find_references
get_dependency_graph
diagnostics
```

#### Full

```text
standard +
index_folder
index_file
doctor
get_blast_radius
check_rename_safe
get_changed_symbols
session tools
benchmark/debug tools
```

### Compact schemas

Some tools have many optional arguments. In compact schema mode, hide advanced rarely used fields from `tools/list` while still accepting them if called.

For example, compact `query_code` schema could show only:

```text
repoRoot
query
intent
symbolId
filePath
tokenBudget
```

Full schema can include:

```text
kind
language
filePattern
limit
contextLines
verify
includeTextMatches
includeRankedCandidates
includeDependencies
includeImporters
includeReferences
relationDepth
```

### Files

```text
src/mcp-profiles.ts
src/mcp-contract.ts
src/config.ts
src/types.ts
src/mcp.ts
src/scripts/install.ts
README.md
```

### Acceptance criteria

- Runtime MCP tool list changes based on profile.
- Setup modes map cleanly to runtime profiles.
- Compact schemas reduce visible argument surface.
- Always-present tools remain available: `astrograph_guide`, profile/status tools.

---

## 14. Workstream I: Agent guidance, hooks, sessions, and edit lifecycle

### Goal

Make agents reliably use Astrograph instead of blind file reads and stale context.

### Add MCP tools

```text
astrograph_guide
register_edit
invalidate_cache
get_session_context
get_session_snapshot
get_watch_status
```

### Add CLI commands

```bash
astrograph policy generate --ide codex
astrograph policy generate --ide copilot
astrograph hooks install --ide codex
astrograph hooks audit
astrograph register-edit --file src/config.ts
```

### Session storage

```sql
CREATE TABLE IF NOT EXISTS session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  repo_root TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_search_cache (
  session_id TEXT NOT NULL,
  repo_root TEXT NOT NULL,
  index_generation TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(session_id, repo_root, index_generation, query_hash)
);
```

### `register_edit` behavior

Input:

```json
{
  "repoRoot": "/path/to/repo",
  "filePath": "src/config.ts"
}
```

Behavior:

```text
1. Reindex file.
2. Bump index generation if content changed.
3. Invalidate affected query cache entries.
4. Optionally refresh importers/dependents.
5. Emit event.
```

### Agent policy example

Generated policy should say:

```text
Before broad file reads, prefer Astrograph.
Use search_symbols for implementation lookup.
Use get_file_outline before reading full files.
Use get_symbol_source for exact code.
Use get_context_bundle for multi-symbol context.
After editing a file, call register_edit or index_file.
If diagnostics says stale, refresh before relying on indexed source.
```

### Acceptance criteria

- `astrograph_guide` gives concise workflow advice.
- `register_edit` triggers reindex and cache invalidation.
- Session context records recent symbols/files/tool results.
- Policy generation works for supported IDE targets.

---

## 15. Workstream J: Benchmarks and comparison harness

### Goal

Make improvements measurable on real tasks.

### Benchmark workflows

Add or standardize workflows:

```text
baseline-read-all
astrograph-query-code
astrograph-symbol-first
astrograph-ranked-context
astrograph-bundle
jcodemunch-symbol-first
jcodemunch-ranked-context
jcodemunch-bundle
```

The jCodeMunch workflows can be optional and skipped unless configured.

### Task card example

```yaml
id: find-watch-refresh-logic
query: "where does Astrograph refresh changed files in watch mode?"
allowedPaths:
  - src/**
targets:
  - symbol: watchFolder
  - file: src/storage.ts
successCriteria:
  - correct symbol is returned
  - exact source is retrieved
  - retrieved tokens are below 2000
```

### Result record

```json
{
  "workflow": "astrograph-symbol-first",
  "success": true,
  "toolCalls": 2,
  "latencyMs": 38,
  "baselineTokens": 48000,
  "retrievedTokens": 1400,
  "tokenReductionPct": 97.1,
  "cacheHit": false,
  "evidence": [
    "src/storage.ts::watchFolder#function"
  ]
}
```

### Trace files

Emit trace files:

```text
.benchmarks/latest/traces/<task-id>.<workflow-id>.jsonl
```

Each line:

```json
{
  "ts": "2026-05-02T10:30:00.000Z",
  "tool": "search_symbols",
  "input": { "query": "watch refresh" },
  "outputTokens": 123,
  "latencyMs": 8.3,
  "evidence": ["watchFolder"]
}
```

### Acceptance criteria

- Benchmark can compare baseline vs Astrograph workflows.
- Optional jCodeMunch adapter can be skipped if unavailable.
- Results include token reduction, latency, success, and evidence.
- Report is human-readable and machine-readable.
- Benchmarks cover small and large repo scenarios.

---

## 16. Suggested file and module layout

Target layout after several workstreams:

```text
src/
  mcp.ts
  mcp-contract.ts
  mcp-profiles.ts

  config.ts
  types.ts
  validation.ts
  index.ts
  cli.ts

  storage/
    db.ts
    migrations.ts
    symbols.ts
    files.ts
    cache.ts
    graph.ts
    freshness.ts

  retrieval/
    tokenizer.ts
    symbol-document.ts
    bm25.ts
    fuzzy.ts
    centrality.ts
    ranking.ts
    result-cache.ts
    context-bundle.ts
    ranked-context.ts

  encoding/
    compact.ts
    json.ts
    format.ts
    token-cost.ts

  languages/
    adapter.ts
    registry.ts
    javascript.ts
    typescript.ts
    python.ts
    go.ts
    rust.ts

  graph/
    importers.ts
    references.ts
    dependency-graph.ts
    related-symbols.ts
    call-graph.ts
    blast-radius.ts
    rename-safety.ts

  git/
    diff.ts
    changed-symbols.ts

  session/
    journal.ts
    cache.ts
    context.ts
    plan.ts

  agent/
    guide.ts
    policy.ts
    hooks.ts
```

Do not do this all at once. Use it as the destination map.

---

## 17. Useful packages and tools

Astrograph already uses many good packages. Keep using them:

| Package | Use |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server. |
| `better-sqlite3` | Local SQLite index. |
| `tree-sitter` | Active parser execution model for the MCP v1 hard-switch. |
| `tree-sitter-javascript` | JavaScript and JSX grammar. |
| `tree-sitter-typescript` | TypeScript and TSX grammar. |
| `oxc-resolver` | JS/TS import resolution if source search confirms it is still used outside parser execution. |
| `@vscode/ripgrep` | Live text fallback. |
| `@parcel/watcher` | Watch mode. |
| `piscina` | Worker-thread indexing. |
| `fdir` | Fast discovery. |
| `picomatch` | Include/exclude matching. |
| `fast-json-stringify` | Faster serialization. |
| `tiktoken` / `tokenx` | Token measurement. |

Potential additions:

| Package | Use |
|---|---|
| `lru-cache` | In-memory query/result cache. |
| `tree-sitter-python` | Python adapter pilot. |
| `tree-sitter-go` | Go adapter pilot. |

Do not add grammar packages without fixtures and tests.

---

## 18. Prioritized roadmap

This roadmap is sorted by foundation value, not just speed.

### Priority 0: Expose direct retrieval tools through MCP

Add:

```text
search_symbols
get_symbol_source
get_context_bundle
get_ranked_context
get_file_content
astrograph_guide
```

Why:

- Highest immediate agent usability win.
- Mostly maps existing library functions to MCP.
- Makes Astrograph comparable with jCodeMunch core retrieval workflows.

Difficulty: low to medium.

---

### Priority 1: Add detail levels and response envelopes

Add:

```text
detailLevel
format
_meta timing/freshness/token/truncation
```

Why:

- Required for token discipline.
- Required before compact output.
- Makes outputs easier for agents to reason about.

Difficulty: medium.

---

### Priority 2: Add index generation and query cache

Add:

```text
indexGeneration
query_cache
in-memory LRU
cache invalidation
```

Why:

- Critical for large repos.
- Prevents repeated query cost.
- Enables session restore later.

Difficulty: medium.

---

### Priority 3: Improve ranking with tokenizer, BM25, and fuzzy fallback

Add:

```text
identifier tokenizer
abbreviation expansion
BM25
fuzzy fallback
score breakdown
```

Why:

- Search quality determines whether the whole tool feels good.
- Should be prioritized even if it takes longer.

Difficulty: medium to high.

---

### Priority 4: Add stable symbol IDs

Add:

```text
stable semantic IDs
symbol aliases
legacy ID compatibility
```

Why:

- Foundational for caching, sessions, graph, diffs, and edit workflows.
- Should be prioritized high even if disruptive.

Difficulty: medium to high.

---

### Priority 5: Add first graph tools

Add:

```text
find_importers
find_references
get_dependency_graph
get_related_symbols
```

Why:

- Enables safer editing and impact analysis.

Difficulty: high.

---

### Priority 6: Add compact output

Add:

```text
compact table encoding
path interning
auto savings threshold
serialization benchmark
```

Why:

- Saves tokens after retrieval is already narrowed.
- Important for large structured responses.

Difficulty: medium.

---

### Priority 7: Add Python as first non-JS language

Add:

```text
language adapter framework
Python parser adapter
outline/retrieval support
```

Why:

- Expands usefulness beyond JS/TS.
- Should happen after retrieval foundations are solid.

Difficulty: high.

---

### Priority 8: Add edit-safety tools

Add:

```text
get_changed_symbols
get_blast_radius
check_rename_safe
get_impact_preview
```

Why:

- High user value for real coding.
- Depends on references and stable IDs.

Difficulty: high.

---

### Priority 9: Add runtime profiles and compact schemas

Add:

```text
core/standard/full runtime profiles
compactSchemas
advanced arguments hidden by default
```

Why:

- Keeps MCP schema overhead low as tools grow.

Difficulty: medium.

---

### Priority 10: Add hooks and session tools

Add:

```text
register_edit
get_session_context
policy generate
hooks install
invalidate_cache
```

Why:

- Helps agents use Astrograph correctly.
- More valuable once retrieval and graph tools are strong.

Difficulty: medium to high.

---

### Priority 11: Add semantic search

Add later:

```text
optional embeddings
semantic index
hybrid ranking
embedding drift checks
```

Why:

- Useful for vague queries.
- Not a substitute for lexical and graph quality.

Difficulty: high.

---

## 19. Definition of done

A strong first major parity milestone is done when Astrograph can honestly claim:

1. Agents can use direct MCP tools for search, source, ranked context, bundles, and file content.
2. Broad responses have detail levels and token budgets.
3. Search uses identifier-aware tokenization and enhanced ranking.
4. Cache hits are fast and invalidated by index generation.
5. Symbol IDs remain stable across common edits.
6. Importers, references, and dependency graph tools exist.
7. At least one compact output mode exists for large structured responses.
8. Benchmark reports show token savings and success rates across real tasks.
9. Setup profiles and runtime profiles keep tool surface manageable.
10. Agent guide/policy tools encourage correct workflow.

A later full milestone is done when:

1. Python or another non-JS language has retrieval-tier support.
2. Blast radius and rename safety tools work on JS/TS.
3. Sessions preserve recent retrieval and edit state.
4. Compact output and schema profiles measurably reduce MCP token overhead.
5. Benchmarks compare Astrograph against jCodeMunch-like retrieval workflows.

---

## 20. Agent execution notes

When implementing this spec:

1. Work in small slices.
2. Do not change parser, storage, MCP, and benchmarks all in one PR unless unavoidable.
3. Keep migration notes explicit; do not preserve backward compatibility in v1 runtime behavior.
4. Add tests for every new tool.
5. Add or update benchmark task cards for every major retrieval feature.
6. Prefer explicit result metadata over hidden behavior.
7. Include freshness and truncation metadata in broad outputs.
8. Do not add broad language support without fixtures.
9. Do not add semantic search before lexical ranking is strong.
10. If a feature affects source retrieval, test exact byte/line spans.
11. If a feature touches caching/memoization semantics, confirm it is intentionally disabled in v1.
12. If a feature affects MCP tools, test `tools/list` behavior and schema size.

Recommended first agent task:

```text
Implement Workstream A, Slice 1:
Expose search_symbols, get_symbol_source, get_context_bundle, get_ranked_context, get_file_content, and astrograph_guide through src/mcp-contract.ts, with interface tests and README updates.
```

Recommended second agent task:

```text
Implement response detail levels and a standard result envelope for search_symbols and get_ranked_context, but keep behavior backward compatible where possible.
```

Recommended third agent task:

```text
Skip cache infrastructure in v1. Prepare post-1.0 follow-up work for cache reintroduction and migration.
```

---

# End of spec
