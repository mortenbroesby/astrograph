# Retrieval Workflows

Astrograph works best when the agent retrieves progressively instead of jumping
straight to large context bundles.

This guide shows the default workflow shape that matches Astrograph's main
value proposition: smaller, more precise questions that stay grounded in source.

## The Default Workflow

Use this order unless you have a good reason not to:

1. inspect structure
2. find the exact symbol or file
3. pull the source you actually need
4. escalate to task context only when the narrow path is not enough

## Workflow 1: Find the Implementation of a Symbol

Start by locating the symbol:

```bash
npx astrograph cli search-symbols --repo /absolute/path/to/repo --query diagnostics
```

The result is bounded. If `truncated` is true, use its `refinementHints` to
narrow by path, kind, or limit; `tokenSavings` shows the exact savings versus
all ranked symbol items before the cap.

Then inspect the exact source:

```bash
npx astrograph cli get-symbol-source --repo /absolute/path/to/repo --symbol <symbol-id>
```

## Workflow 2: Understand a File Before Reading It

Get the outline first:

```bash
npx astrograph cli get-file-outline --repo /absolute/path/to/repo --file src/index.ts
```

If the outline tells you the file matters, then fetch more targeted source or
search within it.

## Workflow 3: Ask a Repository Question

Use `get-task-context` when the question is broader than one symbol but still
focused and needs source-attributed context within an agent-visible budget:

```bash
npx astrograph cli get-task-context \
  --repo /absolute/path/to/repo \
  --query "how does watch refresh remove deleted files?" \
  --intent debug \
  --payload-token-budget 8000 \
  --include-references
```

## Workflow 4: Anchor Task Context

Use explicit symbols when you already know the relevant implementation:

```bash
npx astrograph cli get-task-context \
  --repo /absolute/path/to/repo \
  --symbols <symbol-id-1>,<symbol-id-2> \
  --payload-token-budget 2000 \
  --include-references
```

## Workflow 5: Check Health Before Trusting Results

If the repository may be stale, verify first:

```bash
npx astrograph cli diagnostics --repo /absolute/path/to/repo --scan-freshness
```

Read `retrievalHealth` before escalating. `safe` permits all retrieval;
`degraded` names the operations that remain safe (for example, unresolved
imports can limit graph expansion without invalidating direct symbol/source
retrieval); `unsafe` gives the recovery action to take first.

If something looks wrong:

```bash
npx astrograph cli doctor --repo /absolute/path/to/repo
```

## Good Habits

- use outlines before large source reads
- prefer exact symbol retrieval over file dumping
- treat diagnostics as part of retrieval discipline, not an afterthought
- use configured ranking path presets only as an opt-in tie-breaker; generic
  ranking remains the fallback
- escalate gradually instead of loading a large bundle first

## Bad Habits

- reading whole files before checking structure
- using broad search as the first and only tool
- assuming empty or weak results mean the feature is bad instead of checking freshness
- jumping to task context before identifying the relevant symbol or file

## Where To Go Next

- For exact flags and command shapes: [CLI Reference](../reference/cli.md)
- For setup and first use: [First Steps](../getting-started/first-steps.md)
- For failure recovery: [Troubleshooting](./troubleshooting.md)
