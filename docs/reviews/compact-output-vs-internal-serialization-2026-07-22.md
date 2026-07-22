# Compact Output vs Internal Serialization Assessment — July 2026

## Decision

Treat these as separate parked candidates with different success measures:

1. **Compact MCP output** is the agent-facing token-efficiency candidate. It
   belongs to Precision Retrieval Story 4 and is the higher-priority candidate
   once envelope measurements demonstrate material savings.
2. **MessagePack** is an internal storage research candidate. It belongs to
   Precision Retrieval Story 10 and remains parked until one measured internal
   boundary proves a material benefit over simpler JSON/layout cleanup.

Neither is selected by this assessment. JSON remains the default public format
and normal debugging representation.

## Current-state corrections

- Current MCP tools are `index_folder`, `index_file`, `find_files`,
  `search_text`, `get_file_summary`, `get_project_status`, `get_repo_outline`,
  `get_file_tree`, `get_file_outline`, `suggest_initial_queries`,
  `search_symbols`, `get_symbol_source`, `get_task_context`, and `diagnostics`.
- `get_ranked_context` is an internal TypeScript surface, not an MCP tool.
  `find_references`, `find_importers`, and `get_dependency_graph` are not
  current MCP tools. Graph-like expansion is part of `get_task_context` and
  health vocabulary.
- MCP currently emits pretty JSON in a strict v1 envelope. Measure that full
  agent-visible text, including successful, empty, error, and provenance-heavy
  cases—not merely an inner data object.
- MCP v1 explicitly says compact schema variants are disabled. Any future
  compact format therefore needs an explicit ADR/API contract decision,
  versioned envelope, and reference decoder; it cannot be an invisible
  formatter change.
- Worker analysis already uses structured cloning through Piscina, not JSON
  IPC. There is no sync transport, and network synchronization is descoped.

## Compact MCP-output gate

Benchmark `search_symbols`, `get_file_tree`, `get_file_outline`, and a bounded
`get_task_context` against a deterministic table/path-interned compact JSON
draft. Record bytes, agent-visible tokenizer counts, encode/decode latency,
round-trip equivalence, and readability. Set any `auto` threshold only after
those results exist. `get_task_context` additionally requires an explicit
decision about whether its declared budget applies to JSON, compact output, or
both.

## Internal-serialization gate

Start only at the SQLite `analysis_artifacts` boundary, whose artifact rows
contain several JSON payload fields. Measure row/database bytes, warm-load
latency, serialization CPU, and memory. Compare current JSON with a
deduplicated JSON/layout alternative before MessagePack. Adopt a binary format
only if it materially wins while JSON debug inspection and safe pre-v1
cache-discard/rebuild behavior remain available.

## Boundaries

- Do not emit binary MessagePack as an MCP response.
- Do not promise MessagePack for worker IPC, query persistence, refresh
  metadata, or sync before those concrete boundaries are measured.
- Do not turn compact output into a replacement for ranking, retrieval
  correctness, provenance, or token-budgeted selection.
