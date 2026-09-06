# repository-workflow Specification

## Purpose

Define the repository-wide agreement for proposing, implementing, tracking,
and archiving durable Astrograph changes with OpenSpec.

## Requirements

### Requirement: Durable changes use lightweight priority and selected OpenSpec contracts

The repository SHALL use `BACKLOG.md` as its only live source of priority and
execution order, and SHALL use OpenSpec as the detailed behavioral contract,
design, task tracker, and completed-change history for selected durable work.

#### Scenario: Work is captured or reprioritized

- **WHEN** an idea is added, removed, or moved between priority levels
- **THEN** the agent updates `BACKLOG.md`
- **AND** no OpenSpec change is required until that work is selected for
  detailed execution

#### Scenario: Agent starts selected durable work

- **WHEN** an agent begins a selected non-trivial behavioral or workflow change
- **THEN** the agent creates or updates exactly one change under
  `openspec/changes/`
- **AND** reviews its proposal, specs, design, and tasks before implementation

#### Scenario: Agent performs a trivial non-behavioral change

- **WHEN** selected work is limited to a small documentation or mechanical
  correction with no durable behavior to specify
- **THEN** it may be implemented without creating an OpenSpec change
- **AND** remains subject to normal review and verification

#### Scenario: Change is completed

- **WHEN** every task and relevant verification for a change is complete
- **THEN** the change is archived through OpenSpec
- **AND** its delta specs become current behavioral truth
- **AND** `BACKLOG.md` is updated to reflect the resulting priority state

### Requirement: Migrated work preserves its state without setting priority

The repository SHALL preserve every legacy in-progress, planned, deferred,
parked, completed, and superseded work record without treating their presence
or names as the live priority queue.

#### Scenario: Agent inspects migrated work

- **WHEN** an agent lists OpenSpec changes
- **THEN** migrated `active-*` and `backlog-*` changes remain available as
  historical planning context
- **AND** only selection and ordering in `BACKLOG.md` authorizes current focus
- **AND** completed records remain available under the OpenSpec archive

### Requirement: Repository changes use isolated linked worktrees

Agents SHALL perform repository-changing work in a task-scoped linked Git
worktree unless an explicit documented exception applies.

#### Scenario: Agent begins repository-changing work

- **WHEN** an agent is about to edit tracked or untracked repository content
- **THEN** it reuses the linked worktree assigned to that task or creates one
  from the intended base before editing
- **AND** verifies the project-local worktree directory is ignored
- **AND** reports the worktree root, branch, and baseline state

#### Scenario: A worktree exception is required

- **WHEN** the user explicitly requires the current checkout, the operation is
  worktree administration or recovery, or the target is not a Git repository
- **THEN** the agent states the reason before mutating files
- **AND** preserves unrelated changes

### Requirement: Tasks use explicit readiness and completion gates

The repository SHALL define and apply a Definition of Ready before implementation
and a Definition of Done before reporting a task delivered.

#### Scenario: A task becomes ready

- **WHEN** work is selected for implementation
- **THEN** its outcome, boundaries, acceptance criteria, dependencies, required
  authority, worktree/base, and verification evidence are explicit
- **AND** non-trivial durable work has a strict-valid OpenSpec contract
- **AND** no unresolved choice can materially change the solution or side effects

#### Scenario: An implementation task is checked complete

- **WHEN** the task's full stated behavior exists and its stated verification
  passes
- **THEN** its OpenSpec checkbox may be marked complete
- **AND** partial work, intent, indirect evidence, or deferred failures do not
  qualify

#### Scenario: A task is reported delivered

- **WHEN** acceptance criteria and applicable repository gates pass
- **THEN** the scoped changes are committed and pushed from the worktree
- **AND** the remote ref and exact-head CI are verified when applicable
- **AND** external mutations are read back from their target systems
- **AND** required documentation, specifications, backlog state, versioning,
  diagnostics, and rollback guidance are current

### Requirement: Legacy specs are read-only source material

The repository SHALL retain incompatible legacy specs as read-only brownfield
context and SHALL NOT update them as current requirements or task trackers.

#### Scenario: Legacy context is relevant to a new change

- **WHEN** a legacy document describes the area being changed
- **THEN** the agent may use it during exploration
- **AND** captures only the verified behavior being changed in an OpenSpec delta

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
