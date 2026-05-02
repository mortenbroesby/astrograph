---
name: shipping-and-launch
description: Check release readiness before push or deploy. Use when changes are about to leave the local workspace.
---

# Shipping And Launch

## Overview

Shipping is a quality gate, not an afterthought. Confirm readiness before code
moves to a shared branch or production target.

## When to Use

- Before pushing substantial changes
- Before opening or updating a release-oriented PR
- Before deployment or launch steps

## Process

1. Confirm the relevant lint, type-check, test, build, or deploy checks ran.
2. Confirm docs, rules, AGENTS, or vault notes were updated when behavior,
   workflow, or setup changed.
3. Check for secrets, debug leftovers, TODOs that block release, and generated
   output churn.
4. Identify rollback shape and any manual validation still needed.
5. Report blockers clearly before shipping.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "The diff is small, so release checks can wait" | Small diffs still break shared branches. |
| "Someone else will catch it in CI" | Local proof is cheaper than remote failure. |
| "Docs can be updated later" | Workflow and setup drift compounds quickly. |

## Red Flags

- Relevant checks were skipped without explanation
- Release blockers are buried below summaries
- Setup or workflow changed with no matching docs or memory update

## Verification

- [ ] Relevant checks ran or were explicitly skipped with reason
- [ ] Supporting docs or memory were updated when needed
- [ ] Release blockers are stated clearly
- [ ] Remaining manual validation is explicit
