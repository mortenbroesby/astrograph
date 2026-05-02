---
name: code-simplification
description: Reduce complexity while preserving exact behavior. Use when code works but is harder to read, reason about, or change than necessary.
---

# Code Simplification

## Overview

Prefer boring clarity over cleverness. Simplify only after behavior and callers
are understood.

## When to Use

- A working area has unnecessary complexity
- A recent change introduced indirection or duplication
- The user asks for cleanup or simplification

## Process

1. Understand purpose, callers, edge cases, and current verification.
2. Identify real complexity: deep nesting, oversized functions, dead paths,
   duplicated logic, or abstractions that no longer pay for themselves.
3. Simplify one thing at a time.
4. Re-run relevant checks after each simplification.
5. Stop when readability improves without changing behavior.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "Shorter always means simpler" | Dense code can be harder to understand. |
| "I’ll combine cleanup with feature work" | Mixed intent makes regressions harder to isolate. |
| "This abstraction might be useful later" | Speculative structure adds maintenance cost today. |

## Red Flags

- Simplification changes behavior without explicit intent
- Cleanup is bundled into unrelated feature work
- Verification becomes weaker after refactor

## Verification

- [ ] Existing behavior is preserved
- [ ] Complexity was actually reduced
- [ ] Relevant checks still pass
- [ ] The new code is easier to explain than the old code
