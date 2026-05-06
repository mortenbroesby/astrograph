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
4. escalate to bundled or ranked context only when the narrow path is not enough

## Workflow 1: Find the Implementation of a Symbol

Start by locating the symbol:

```bash
npx astrograph cli search-symbols --repo /absolute/path/to/repo --query diagnostics
```

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

Use `query-code` when the question is broader than one symbol but still
focused:

```bash
npx astrograph cli query-code \
  --repo /absolute/path/to/repo \
  --intent assemble \
  --query "how does watch refresh remove deleted files?" \
  --budget 8000 \
  --include-references
```

## Workflow 4: Escalate to Context Bundles

Use bundled or ranked context when the narrow path still leaves too much
uncertainty.

Ranked context:

```bash
npx astrograph cli get-ranked-context \
  --repo /absolute/path/to/repo \
  --query "watch refresh" \
  --budget 2000
```

Context bundle around known symbols:

```bash
npx astrograph cli get-context-bundle \
  --repo /absolute/path/to/repo \
  --symbols <symbol-id-1>,<symbol-id-2> \
  --budget 2000 \
  --include-references
```

## Workflow 5: Check Health Before Trusting Results

If the repository may be stale, verify first:

```bash
npx astrograph cli diagnostics --repo /absolute/path/to/repo --scan-freshness
```

If something looks wrong:

```bash
npx astrograph cli doctor --repo /absolute/path/to/repo
```

## Good Habits

- use outlines before large source reads
- prefer exact symbol retrieval over file dumping
- treat diagnostics as part of retrieval discipline, not an afterthought
- escalate gradually instead of loading a large bundle first

## Bad Habits

- reading whole files before checking structure
- using broad search as the first and only tool
- assuming empty or weak results mean the feature is bad instead of checking freshness
- jumping to large context bundles before identifying the relevant symbol or file

## Where To Go Next

- For exact flags and command shapes: [CLI Reference](../reference/cli.md)
- For setup and first use: [First Steps](../getting-started/first-steps.md)
- For failure recovery: [Troubleshooting](./troubleshooting.md)
