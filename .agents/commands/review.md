---
description: Review changes across correctness, readability, architecture, security, and performance
---

Use the `engineering-workflow` and `code-review-and-quality` skills.

Review the current diff, staged changes, or named scope:

1. Prioritize findings by severity.
2. Check correctness against the request and acceptance criteria.
3. Check readability, naming, and local conventions.
4. Check architecture boundaries and whether abstractions pay for themselves.
5. Check security and performance risks relevant to the changed surface.
6. Call out missing tests or verification gaps.

Use shared references in `.agents/references/` when they sharpen the review
without inflating scope.

Return findings first with file and line references where possible.
