---
description: Simplify code while preserving exact behavior
---

Use the `engineering-workflow` and `code-simplification` skills.

Simplify a specified scope or recent changes:

1. Understand purpose, callers, edge cases, and current test coverage.
2. Identify real complexity: deep nesting, oversized functions, unclear names,
   duplicated logic, dead paths, or abstractions that no longer pay for
   themselves.
3. Change one simplification at a time.
4. Run relevant checks after the simplification.
5. Stop if behavior changes or verification becomes ambiguous.

Prefer boring clarity over clever compactness.
