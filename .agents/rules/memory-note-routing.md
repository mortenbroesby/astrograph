---
alwaysApply: true
---

# Memory Note Routing

When `pnpm knowledge:check` or a related workflow warning says a repo memory
note is required, route the note type with this state machine:

1. Did the change introduce or expose follow-up work that should survive the
   current session?
   Then create or update a task note under
   `vault/00 Repositories/playground/04 Tasks/`.
2. Did the change establish, reverse, or clarify a durable rule, policy,
   workflow default, or engineering preference?
   Then create or update a decision note under
   `vault/00 Repositories/playground/02 Decisions/`.
3. Did the change alter the repo's structure, boundaries, source of truth,
   ownership map, startup flow, or system shape?
   Then create or update an architecture note under
   `vault/00 Repositories/playground/01 Architecture/`.
4. Otherwise create or update a session note under
   `vault/00 Repositories/playground/03 Sessions/`.

Use one primary note type per warning by default. Prefer the highest matching
rule in the tree.

If a change needs both durable policy and leftover follow-up work, create the
decision or architecture note first, then add or update a task note only for
the unresolved work. Do not use a session note as the long-term home for
durable policy.
