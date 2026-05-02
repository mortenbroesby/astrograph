---
name: debugging-and-error-recovery
description: Triage failures systematically. Use when tests fail, builds break, runtime behavior is unexpected, or a change needs safe recovery steps.
---

# Debugging And Error Recovery

## Overview

Debugging should reduce uncertainty, not spread it around. Reproduce first,
localize the failure, then fix with a guard against recurrence.

## When to Use

- Tests fail
- Builds or type-checks break
- Runtime behavior is wrong or inconsistent
- A change needs a safe fallback or rollback shape

## Process

1. Reproduce the failure with the smallest reliable command, test, or manual
   flow.
2. Localize the fault to one boundary, file, or assumption before changing
   multiple things.
3. Reduce the problem: remove variables, narrow input, and compare to a known
   good path.
4. Apply the smallest fix that addresses the identified cause.
5. Add or run a regression guard so the failure is less likely to return
   silently.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "I can see the bug from the stack trace" | Symptoms are not always causes. |
| "I’ll try a few fixes quickly" | Blind edits multiply uncertainty. |
| "The repro is flaky, I’ll just patch around it" | Flaky reproductions usually signal missing understanding. |

## Red Flags

- The failure was not reproduced before the fix
- Multiple unrelated edits are made at once
- The fix adds fallback logic without explaining when it triggers
- Verification does not cover the original failure mode

## Verification

- [ ] A concrete repro exists
- [ ] The likely root cause is named
- [ ] The fix is narrower than the symptom surface
- [ ] A regression guard or follow-up check exists
