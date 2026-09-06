## ADDED Requirements

### Requirement: Interrupted work remains recoverable and completed worktrees are retired

The repository SHALL keep active goals and unfinished work recoverable through
`BACKLOG.md`, named branches, and remote commits, and SHALL retire task
worktrees after completion only when their state is reproducible elsewhere.

#### Scenario: A task starts or changes state
- **WHEN** an agent starts, pauses, resumes, or completes a selected task
- **THEN** `BACKLOG.md` records its goal, branch, worktree, current state, next
  action, and known verification state
- **AND** remains the only live priority and active-work manifest

#### Scenario: Coherent work is interrupted
- **WHEN** a task has coherent tracked or untracked changes but cannot finish in
  the current session
- **THEN** the agent checks the patch for secrets and unrelated content
- **AND** commits and pushes it to the named task branch with unfinished status
  and verification gaps recorded in `BACKLOG.md`
- **AND** does not use a stash as the normal handoff mechanism

#### Scenario: Dirty work cannot be safely committed
- **WHEN** changes contain unresolved ownership, secrets, generated residue, or
  unrelated states that cannot be separated safely
- **THEN** the worktree remains intact
- **AND** `BACKLOG.md` records the blocker and exact recovery location
- **AND** cleanup does not discard or publish the unsafe state

#### Scenario: A task worktree is eligible for cleanup
- **WHEN** its intended state is committed and pushed or confirmed merged,
  required evidence is recorded, and no unique files remain
- **THEN** the linked worktree may be removed
- **AND** stale worktree metadata may be pruned
- **AND** the primary checkout can return to current `origin/main`

#### Scenario: Existing stashed work is reconciled
- **WHEN** an Astrograph stash is inventoried for cleanup
- **THEN** it is classified as superseded, recoverable work, or unsafe/unknown
- **AND** recoverable work is moved to a named branch and pushed before the
  verified stash copy is removed
- **AND** unsafe or unknown work is preserved with its blocker recorded
