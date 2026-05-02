---
description: Implement the next slice and verify it
---

Use the `engineering-workflow`, `incremental-implementation`, and
`context-engineering` skills.

Implement incrementally:

1. Pick the next small task from the current request or plan.
2. Load only the context needed for that slice.
3. Make the scoped code or docs change.
4. Run the narrowest relevant check.
5. Repeat only when the tree stays coherent and verification still passes.

If the work depends on external framework behavior, also use
`source-driven-development`.

If the work changes shared types, mount contracts, route payloads, or exported
interfaces, also use `api-and-interface-design`.

If a check fails, switch to the debugging path before adding more scope.
