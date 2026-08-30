---
name: documentation-and-adrs
description: Record the why alongside the what. Use when workflow, architecture, contracts, setup, or long-lived behavior changes.
---

# Documentation And ADRs

## Overview

Durable changes need durable explanation. Update the smallest stable document
that future sessions will actually load.

## When to Use

- Workflow or architecture changes
- Public API or contract changes
- Setup expectations change
- A design decision should be preserved beyond the current session

## Process

1. Put observable behavior in OpenSpec specs and change-specific decisions in
   the change's `design.md`. Use README, AGENTS, rules, or docs only for their
   established audiences.
2. Capture the why, not just the mechanics.
3. Keep docs aligned with the actual command surface and repo structure.
4. For durable architecture or workflow choices, use an OpenSpec change.
5. Link related docs instead of duplicating large explanations.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "The diff explains itself" | Diffs rarely explain intent or tradeoffs. |
| "I’ll update docs in a later cleanup" | Later cleanups usually never happen. |
| "A session note is enough for every change" | Some changes need architecture-level documentation. |

## Red Flags

- Workflow changed but AGENTS or rules stayed stale
- Setup commands in docs no longer match package scripts
- Architecture decisions are buried only in conversation

## Verification

- [ ] The right durable doc surface was updated
- [ ] The reason for the change is captured
- [ ] Commands and paths in docs are accurate
- [ ] Vault notes are used when lasting repo context changed
