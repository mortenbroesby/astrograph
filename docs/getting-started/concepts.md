# Astrograph Concepts

Astrograph is a local code-intelligence layer for AI agents.

It helps an agent ask smaller, better questions about a real repository instead
of defaulting to broad search, repeated file dumps, and oversized context
windows.

## The Core Idea

Astrograph indexes a codebase locally and exposes structured retrieval tools.
That lets an agent work from outlines, symbols, source slices, and targeted
context instead of treating the repository like undifferentiated text.

The practical outcome is simple:

- answers stay closer to source
- token usage drops because retrieval is narrower
- long sessions stay cleaner because less irrelevant context accumulates

## What Astrograph Is

Astrograph is:

- local-first code intelligence
- deterministic retrieval over indexed code structure
- an MCP and CLI surface for agent-facing code exploration
- a better default for symbol lookup, source inspection, and targeted context

## What Astrograph Is Not

Astrograph is not:

- a memory system for prior sessions
- a generic agent shell
- a remote indexing service
- a brute-force repo-to-prompt pipeline

Those categories can complement Astrograph, but they are not the same job.

## Why It Saves Tokens

Token savings are not the product by themselves. They are the consequence of a
better retrieval model.

If an agent can ask for the outline of a file, the implementation of a symbol,
or a ranked context bundle around one question, it does not need to read five
files just to get oriented.

Less blind reading means less waste.

## Local-First Matters

Astrograph runs against the repository on disk. That keeps retrieval tied to
the working tree the agent is actually operating in, and it avoids turning code
exploration into a remote sync problem.

## File Support Tiers

Astrograph distinguishes between graph-capable source files and files that are
useful for discovery. This prevents a filename extension from implying symbol
or dependency-graph support that Astrograph has not actually parsed.

| Files | Tier | What you can use |
| --- | --- | --- |
| `.ts`, `.tsx`, `.js`, `.cjs`, `.mjs`, `.jsx` | Graph | Indexing, repository and file outlines, symbol search/source, task context, plus discovery and summaries. |
| `.md`, `.mdx`, `.json`, `.yaml`, `.yml`, `.sql`, `.sh`, `.txt` | Discovery-only | `find_files`, literal `search_text`, deterministic `get_file_summary`, project status, and diagnostics. |
| Other files | Generic discovery | File discovery and literal text search when applicable; no language or graph claim. |

For discovery-only files, summaries are based on their content shape: Markdown
headings, JSON or YAML top-level keys, SQL schema objects, shell functions, or
non-empty text lines. They are intentionally not accepted by the `language`
filter and do not appear in symbol or dependency-graph results.

Use `get_project_status` or `diagnostics` to inspect the exact language registry
and tool availability in the version of Astrograph you are running.

## Where To Go Next

- Read [First Steps](./first-steps.md) to get Astrograph running.
- Use the [CLI Reference](../reference/cli.md) when you want the exact command
  surface.
