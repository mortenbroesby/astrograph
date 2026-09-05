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
