---
alwaysApply: true
---

# Task Lifecycle

Use these gates before starting work and before reporting it complete.

## Definition of Ready

A task is ready when:

- Its intended outcome, boundaries, and user-visible acceptance criteria are
  explicit. An exploration task may leave the solution open, but must name the
  question and expected decision or evidence.
- It is selected by `BACKLOG.md`, an active OpenSpec change, or an explicit user
  request. A migrated `backlog-*` folder alone does not make work ready.
- Non-trivial durable work has coherent proposal, delta specs, design decisions,
  and ordered tasks that pass strict OpenSpec validation.
- Required dependencies, credentials, approvals, external systems, and likely
  destructive actions are identified. Any missing item has a fail-closed plan.
- The task has an isolated linked worktree, intended base commit, preserved
  unrelated changes, and a known baseline state.
- The verification evidence is named before implementation: focused tests plus
  any broader build, package, release, client, or live-system proof needed by
  the acceptance criteria.
- No unresolved choice would materially change the behavior, architecture,
  security boundary, cost, or external side effect.

If a gate is missing, investigate or refine the task first. Ask the user only
when the missing decision or authority cannot be derived safely.

## Definition of Done

An individual task may be checked in `tasks.md` only when its complete stated
behavior exists and its stated verification passes. Partial work, intent,
indirect evidence, and deferred failures are not completion.

A delivered task is done when:

- Every applicable acceptance criterion is proven by current, authoritative
  evidence at the same scope as the claim.
- The diff is minimal, reviewed, and free of unrelated or accidental changes.
- Focused tests and all applicable repository gates pass. Failures are fixed or
  explicitly accepted by the user; they are never silently waived.
- Documentation, `BACKLOG.md`, OpenSpec artifacts, migrations, diagnostics, and
  rollback guidance are updated wherever the behavior requires them.
- The release/version decision is applied. Completed repository changes are
  committed and pushed from the task worktree, and the remote ref matches the
  reported commit.
- Required CI is green for the exact delivered commit when CI applies.
- Every external mutation, including npm publication or device configuration,
  is read back from the target system and matches the intended version,
  identity, channel, and content digest where applicable.
- No required task, known regression, temporary workaround, or cleanup needed
  for correctness remains hidden. Remaining optional work is recorded at the
  correct backlog priority.

Do not mark an OpenSpec change complete or archive it until every change task
and the delivery-level evidence above are complete.
