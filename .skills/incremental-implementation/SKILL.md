---
name: incremental-implementation
description: Implement in thin, verifiable slices. Use when changing more than one file or when behavior needs proof at each step.
---

# Incremental Implementation

## Overview

Build one coherent slice at a time. Keep the tree understandable and verifiable
after each step.

## When to Use

- Any implementation spanning multiple files
- Refactors that can be split into behavior-preserving steps
- Changes with meaningful rollback boundaries

## Process

1. Pick the next smallest slice that produces visible progress.
2. Load only the context needed for that slice.
3. Make the scoped code or docs change.
4. Run the narrowest relevant verification immediately.
5. Expand only when the previous slice is coherent and proven.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It’s faster to wire everything at once" | Large blind edits make debugging slower, not faster. |
| "I’ll test after the full diff is done" | Late verification hides the step that introduced the regression. |
| "This helper cleanup can go in now too" | Scope creep makes outcomes harder to reason about. |

## Red Flags

- A single diff mixes feature work, cleanup, and infrastructure drift
- Verification is postponed until the end
- The next change depends on unproven assumptions

## Verification

- [ ] Each slice has a clear purpose
- [ ] Relevant checks run before moving on
- [ ] Scope stayed narrow
- [ ] The tree remains coherent after each step
