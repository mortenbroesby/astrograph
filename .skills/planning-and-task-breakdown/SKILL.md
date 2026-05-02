---
name: planning-and-task-breakdown
description: Break a clear request or spec into small, ordered, verifiable slices with acceptance criteria and dependency notes.
---

# Planning And Task Breakdown

## Overview

Translate intent into implementation steps that can be executed without losing
coherence.

## When to Use

- A spec exists and implementation needs sequencing
- The task spans multiple files or workspaces
- The user wants a plan before code

## Process

1. Read the request, relevant spec, repo rules, and the smallest useful
   architecture context.
2. Split work into ordered vertical slices, not horizontal layers.
3. Add acceptance criteria for each slice.
4. Mark dependencies, risks, and anything that can be parallelized safely.
5. Attach the narrowest useful verification to each slice.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "I can keep the plan in my head" | Hidden plans drift and are hard to review. |
| "We should plan every internal detail" | Overplanning slows execution and gets stale. |
| "I’ll do the infrastructure first" | Vertical slices reveal integration risk earlier. |

## Red Flags

- Tasks are broad and non-verifiable
- Verification only appears at the very end
- Dependencies are implicit
- The plan is longer than the work justifies

## Verification

- [ ] Tasks are small and ordered
- [ ] Each step has a concrete outcome
- [ ] Verification is attached per slice
- [ ] The plan scales to the actual risk of the change
