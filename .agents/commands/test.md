---
description: Prove behavior with focused tests or checks
---

Use the `engineering-workflow` and `test-driven-development` skills.

For new behavior:

1. Identify the behavior contract and edge cases.
2. Add or run the narrowest test that proves the contract.
3. Broaden to workspace or shared checks when the change crosses boundaries.

For bugs:

1. Reproduce the bug with a failing test or concrete command when practical.
2. Apply the fix.
3. Confirm the reproduction now passes.
4. Run regression checks appropriate to the affected surface.

If the failure is user-facing in a browser, also use
`browser-testing-with-devtools`.
