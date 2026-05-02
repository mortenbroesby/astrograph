---
name: code-review-and-quality
description: Review changes across correctness, readability, architecture, security, performance, and verification gaps.
---

# Code Review And Quality

## Overview

Review for real defects and risk first. Summaries come after findings.

## When to Use

- Reviewing a diff before merge
- Auditing a risky change set
- The user explicitly asks for review

## Process

1. Check correctness against the request and any acceptance criteria.
2. Look for regressions, edge cases, and contract breaks.
3. Evaluate readability and whether abstractions still pay for themselves.
4. Check security, performance, and missing tests relative to the changed
   surface.
5. Report findings in severity order with file references where possible.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "The code builds, so it’s fine" | Build success says little about behavior regressions. |
| "I’ll focus on style because it’s faster" | Styling comments are lower value than correctness findings. |
| "No findings means no risk" | Residual gaps and unverified paths still matter. |

## Red Flags

- Review output has no concrete references
- Nits dominate while behavior risks go unmentioned
- Missing verification is not called out

## Verification

- [ ] Findings are prioritized by severity
- [ ] File references are provided where practical
- [ ] Missing or weak verification is called out
- [ ] If no findings exist, residual risk is still stated
