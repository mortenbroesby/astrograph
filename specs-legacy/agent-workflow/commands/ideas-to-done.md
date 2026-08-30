---
description: Drain IDEAS.md as an implementation queue
---

Use the `engineering-workflow`, `spec-driven-development`, and `ralph-plan`
skills.

Treat [IDEAS.md](/Users/macbook/personal/playground/IDEAS.md) as the
autopilot-ready implementation queue for this repo.

Workflow:

1. Read the highest-priority item in `IDEAS.md`.
2. Decide whether it is ready for direct execution or needs a compact spec
   first.
3. If it needs a spec, create or refine the spec before broad implementation.
4. Build a focused Ralph loop plan for exactly that queue item.
5. Run the loop or carry out the work end to end using the normal repo
   workflow.
6. Verify with the narrowest relevant package checks.
7. Update README, rules, hooks, or vault notes when behavior or workflow
   changes.
8. Remove the completed item from `IDEAS.md`.
9. Continue with the next queue item until the queue is empty.

Autopilot rules:

- continue without asking for permission unless a real blocker requires user
  input
- stop only for missing requirements, ambiguous destructive changes, or
  external credentials/access the agent cannot infer
- keep the queue ordered, deleting completed items rather than checking them
  off
- if a queue item turns out to be too large, replace it with smaller concrete
  follow-up items in `IDEAS.md` and continue with the first shippable slice

Output expectations:

- state which queue item is being processed
- state whether a spec was used or created
- report the verification that proved the item done
- report the updated top of queue when more items remain
