# Implementation Specifications

This directory separates the executable queue from planned work and closed
evidence so documentation status is visible from the file tree.

## Work Status

- [Active Work](./active/README.md) - The selected delivery queue; the next
  follow-up candidates require their own evidence gates before implementation.
- [Planned Work](./planned/README.md) - Approved backlog that has not been selected for delivery.
- [Closed Records](./closed/README.md) - Completed and superseded implementation plans and evidence.

## Standing References

- [Spec System](./spec-system.md) - Maintain this specs tree and the repo-local agent skills.
- [GitHub Actions Cost Policy](./github-actions-cost-policy.md) - Keep CI inside free Actions usage.
- [Release Agent Workflow](./release-agent.md) - Decide publish-worthy changes and push release tags.

## Planned Subsystem Coverage

The remaining durable subsystem and public-contract coverage is tracked in the
[Spec System Backlog](./planned/spec-system-backlog.md). Do not create a second
unchecked list here.

## Implementation Rules

- Implementation specs are not marketing docs.
- Each plan must include exact commands and expected outcomes.
- Source-changing work must handle package version policy.
- Use isolated worktrees unless the user explicitly asks for direct `main` work.
