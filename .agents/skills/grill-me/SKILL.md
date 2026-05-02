---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving dependencies one decision at a time. Use when requirements are unclear, assumptions need validation, or the user wants to stress-test a plan before implementation.
---

# Grill Me

Use this skill when the main risk is building on vague, conflicting, or
untested assumptions.

## Goal

Replace premature implementation with deliberate clarification.

## Workflow

1. Identify what is stated versus what is assumed.
2. Ask one focused question at a time.
3. For each question, provide your recommended answer or default.
4. Resolve dependencies in order instead of branching into many unrelated
   questions at once.
5. If the codebase can answer a question, inspect the codebase instead of
   asking the user.
6. Stop grilling once the decision tree is clear enough to plan or implement.

## Good Triggers

- The user says "grill me", "ask me questions", or "stress-test this".
- A feature request has hidden product or technical choices.
- A plan sounds plausible but leaves important edge cases undefined.
- The repo may already answer some of the open questions.

## Avoid

- Do not ask a long batch of questions at once.
- Do not grill the user for tiny, obvious, low-risk edits.
- Do not keep asking once the remaining uncertainty is no longer material.

## Output Pattern

For each turn:

- ask one question
- include your recommended answer
- explain briefly why that decision matters

When finished:

- summarize the resolved decisions
- name the next skill to load, if any
