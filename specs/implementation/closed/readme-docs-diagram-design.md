# README and Docs Diagram Design

> **Status:** Closed — both Excalidraw source files and SVG exports are tracked
> under `assets/diagrams/` and embedded by `README.md` and `docs/README.md`.

## Goal

Add a small, high-signal visual layer to Astrograph's public documentation so a
reader can understand the product faster without turning the README or docs
compendium into a diagram-heavy site.

The first pass should add exactly two diagrams:

1. a practical Astrograph workflow diagram in the root `README.md`
2. a docs journey diagram in `docs/README.md`

## Why This Exists

The rewritten README and docs now explain Astrograph clearly in text, but the
current surface is still mostly prose. A reader who scans quickly may miss the
practical loop that makes Astrograph different:

- an agent asks a focused code question
- Astrograph answers through local structured retrieval
- the agent gets source-grounded context with less token waste

The docs compendium has a similar opportunity. A simple journey map can help a
new reader understand where to start and how the docs are organized.

## Scope

In scope:

- create one diagram for the root README
- create one diagram for `docs/README.md`
- export them to checked-in static assets
- embed them in the two Markdown pages with stable relative paths

Out of scope for this pass:

- adding diagrams to every individual doc page
- creating animated or interactive diagrams
- building a custom diagram style system beyond these assets
- introducing diagram generation into CI or the release flow

## Design Direction

The diagrams should use a technical-editorial visual language:

- restrained and readable, not playful
- clean boxes, directional arrows, and explicit labels
- enough polish to feel contemporary
- consistent with the README's current high-signal tone

They should clarify structure, not market the project with decorative artwork.

## Diagram 1: README Workflow

### Purpose

Show how Astrograph works in practice for an AI coding agent.

### Message

The reader should understand this sequence at a glance:

`agent question` -> `Astrograph local index + MCP/CLI surfaces` ->
`targeted retrieval` -> `grounded answer with lower token waste`

### Content

The diagram should include four stages:

1. the agent asks a code understanding question
2. Astrograph mediates through local indexing and structured retrieval
3. the agent receives focused outputs such as outlines, symbols, source, and
   targeted search results
4. the session stays more grounded and less bloated than broad file-dump
   workflows

### Placement

Place it near the top of the root README, after the opening thesis and before
or around the early explanatory sections, so it supports the mental model
instead of getting buried after setup.

## Diagram 2: Docs Journey

### Purpose

Show how to navigate the docs compendium.

### Message

The reader should understand:

- where to start if new
- which pages teach usage
- which pages are guides
- which pages are reference material

### Content

The diagram should show a simple path:

`new here?` -> `concepts` -> `first steps` -> `retrieval workflows` / `CLI
reference` -> `guides` / `reference`

It should visually separate learning flow from lookup/reference flow.

### Placement

Place it near the top of `docs/README.md`, before the detailed page lists.

## Asset Format

Use Excalidraw as the source format and check in exported static assets for
Markdown embedding.

Preferred asset layout:

- `assets/diagrams/readme-workflow.excalidraw`
- `assets/diagrams/readme-workflow.svg`
- `assets/diagrams/docs-journey.excalidraw`
- `assets/diagrams/docs-journey.svg`

SVG is preferred for embedding because it stays crisp in GitHub rendering.

## Accessibility

Each embedded diagram should include clear alt text in Markdown that explains
the intent of the graphic in one sentence.

The diagrams should remain understandable in grayscale and should not rely on
color alone to distinguish meaning.

## Error Handling and Maintenance

The diagrams should avoid hard-coded product claims that are likely to drift.
They should describe stable concepts such as local indexing, structured
retrieval, and docs navigation.

If the docs structure changes later, the docs journey diagram should be updated
as part of the same docs edit.

## Verification

Implementation is complete when:

- both Excalidraw source files exist
- both exported SVG assets exist
- `README.md` embeds the workflow diagram successfully
- `docs/README.md` embeds the docs journey diagram successfully
- links and relative paths render correctly in repository Markdown
- the diagrams match the approved technical-editorial direction

## Recommendation

Keep this pass intentionally small. Two strong diagrams are enough to test
whether visuals improve comprehension before expanding the pattern elsewhere.
