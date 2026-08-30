---
name: spec-driven-development
description: Write a compact, testable spec before implementation. Use for new features, structural changes, or any request that needs clearer boundaries before code.
---

# Spec-Driven Development

## Overview

Define the target before building. A useful spec is short, specific, and easy
to verify.

## When to Use

- Starting a new feature or refactor
- Changing workflow, architecture, or setup expectations
- User intent is clear at a high level but underspecified in behavior

## Process

1. Capture the objective, target user, constraints, non-goals, and acceptance
   criteria.
2. Ground the scope in repo rules, local `AGENTS.md`, and relevant vault notes.
3. Name the exact commands or manual checks that will prove completion.
4. Keep small specs in the conversation; use a durable doc or vault note only
   when the change warrants lasting context.
5. Do not start broad implementation until the spec is specific enough to test.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "The task is obvious, I can just start coding" | Small misunderstandings turn into avoidable rework. |
| "We can document it after implementation" | Backfilled intent is usually inaccurate and incomplete. |
| "A spec has to be long to be useful" | Brevity is better if the acceptance criteria are concrete. |

## Red Flags

- No explicit acceptance criteria
- Hidden assumptions about boundaries or ownership
- Verification plan is missing or vague
- The request changes workflow or architecture but nothing durable is updated

## Verification

- [ ] Objective and constraints are explicit
- [ ] Acceptance criteria are specific enough to check
- [ ] Verification commands or manual checks are named
- [ ] Repo-specific boundaries are captured before implementation
