---
description: Collaboratively build a focused Ralph loop command for playground
---

Use the `ralph-plan` skill to help the user create a copyable Ralph loop command for this repo.

When the plan is complete, do not stop at the command alone. Also provide the
matching `pnpm ralph:loop -- ...` invocation when possible and ask the user
whether they want to run the loop now.

The final output should include:

- `<background>`
- `<setup>`
- `<tasks>`
- `<testing>`
- `Output <promise>COMPLETE</promise> when all tasks are done.`

Adapt the plan to `playground`:

- use `pnpm`
- prefer workspace-scoped verification before repo-wide checks
- reference `apps/host`, `packages/remotes/todo-app`, `packages/remotes/uplink-game`, `packages/ui`, and `packages/types` accurately
- leave `docs/superpowers/` alone unless the task is explicitly about that planning track
- keep Ralph focused on work with explicit, mechanical completion criteria
