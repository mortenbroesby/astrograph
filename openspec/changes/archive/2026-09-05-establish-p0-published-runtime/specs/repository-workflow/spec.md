## MODIFIED Requirements

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

The repository SHALL preserve legacy in-progress, planned, deferred, parked,
completed, and superseded work records without treating their presence or
names as the live priority queue.

#### Scenario: Agent inspects migrated work

- **WHEN** an agent lists OpenSpec changes
- **THEN** migrated `active-*` and `backlog-*` changes remain available as
  historical planning context
- **AND** only selection and ordering in `BACKLOG.md` authorizes current focus
- **AND** completed records remain available under the OpenSpec archive

## ADDED Requirements

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
