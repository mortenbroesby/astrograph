# repository-workflow Specification

## Purpose

Define the repository-wide agreement for proposing, implementing, tracking,
and archiving durable Astrograph changes with OpenSpec.

## Requirements

### Requirement: Durable changes use OpenSpec

The repository SHALL use OpenSpec as its only live system for behavioral specs,
change design, implementation tasks, and completed-change history.

#### Scenario: Agent starts durable work

- **WHEN** an agent begins a non-trivial behavioral or workflow change
- **THEN** the agent creates or updates one change under `openspec/changes/`
- **AND** reviews its proposal, specs, design, and tasks before implementation

#### Scenario: Change is completed

- **WHEN** every task and relevant verification for a change is complete
- **THEN** the change is archived through OpenSpec
- **AND** its delta specs become current behavioral truth

### Requirement: Migrated work preserves its state

The repository SHALL preserve every legacy in-progress, planned, deferred,
parked, completed, and superseded work record without treating historical
documents as a second live queue.

#### Scenario: Agent inspects migrated work

- **WHEN** an agent lists OpenSpec changes
- **THEN** `active-*` names identify previously in-progress work
- **AND** `backlog-*` names identify work requiring explicit selection
- **AND** completed records are available under the OpenSpec archive

### Requirement: Legacy specs are read-only source material

The repository SHALL retain incompatible legacy specs as read-only brownfield
context and SHALL NOT update them as current requirements or task trackers.

#### Scenario: Legacy context is relevant to a new change

- **WHEN** a legacy document describes the area being changed
- **THEN** the agent may use it during exploration
- **AND** captures only the verified behavior being changed in an OpenSpec delta
