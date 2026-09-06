## Purpose

Ensure first-use code exploration recovers a missing index before Astrograph is
abandoned for broad filesystem inspection.

## ADDED Requirements

### Requirement: First exploration hydrates an unavailable index

Astrograph agent guidance SHALL direct an agent to inspect repository readiness
first. When readiness reports a missing, stale, or unavailable index, the agent
SHALL run `index_folder`, wait for it to complete, and retry the original
Astrograph retrieval request before using filesystem inspection.

#### Scenario: First retrieval has no index

- **WHEN** an agent starts code exploration and project status reports no index
- **THEN** the agent runs `index_folder` for that repository
- **AND** retries its requested Astrograph retrieval after hydration completes

#### Scenario: Hydration cannot recover retrieval

- **WHEN** indexing or the retried Astrograph request fails
- **THEN** the agent may use filesystem inspection
- **AND** states the failure reason instead of describing the index as skipped

### Requirement: Recovery does not pre-index repositories

Astrograph SHALL NOT create an index merely because it is installed, registered,
or launched. Index hydration SHALL occur only in response to an exploration
request or an explicit indexing action.

#### Scenario: Setup completes without exploration

- **WHEN** a user installs or registers Astrograph without selecting indexing
- **THEN** no repository index is created
