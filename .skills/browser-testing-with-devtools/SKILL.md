---
name: browser-testing-with-devtools
description: Verify browser-facing behavior with live runtime evidence. Use for UI bugs, interactive flows, layout regressions, and console or network issues.
---

# Browser Testing With Devtools

## Overview

User-facing behavior should be checked in a browser, not inferred from code
alone. Prefer runtime evidence over guesswork.

## When to Use

- Debugging UI or interaction bugs
- Checking layout, focus, or responsiveness
- Investigating console or network failures
- Verifying a user-facing change before shipping

## Process

1. Start with the narrowest browser verification that proves the behavior.
2. Prefer live tooling when available: browser automation, devtools, or a
   focused manual check.
3. Check visible UI state, console errors, and failed network requests when
   relevant.
4. Record the exact flow that passed or failed.
5. Pair browser evidence with targeted code or test changes when needed.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "The component compiles, so the UI is fine" | Many regressions only appear at runtime. |
| "I refreshed once and it looked okay" | Superficial checks miss console, network, and interaction failures. |
| "Manual verification is too slow" | A short browser proof is cheaper than shipping a broken flow. |

## Red Flags

- UI fixes are declared complete without runtime proof
- Console errors are ignored because the page still renders
- Layout claims are made without checking responsive breakpoints

## Verification

- [ ] The user-facing flow was exercised in a browser
- [ ] Console or network failures were checked when relevant
- [ ] The exact verified flow is documented in the result
- [ ] Browser evidence matches the claimed fix
