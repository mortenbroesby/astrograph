## MODIFIED Requirements

### Requirement: First exploration hydrates an unavailable index

Astrograph agent guidance SHALL direct an agent to inspect repository readiness first. When readiness reports a missing or unavailable index, the agent SHALL run `index_folder`, wait for it to complete, and retry the original Astrograph retrieval request before using filesystem inspection. When a deep-ready index is degraded for a reason that re-indexing cannot repair, the agent SHALL use the reported safe operations and recommended action instead of repeating hydration.

Astrograph SHALL invalidate and rebuild persisted indexes whose storage compatibility version predates a change to stored retrieval semantics.

#### Scenario: First retrieval has no index
- **WHEN** an agent starts code exploration and project status reports no index
- **THEN** the agent runs `index_folder` for that repository
- **AND** retries its requested Astrograph retrieval after hydration completes

#### Scenario: Deep-ready index has degraded dependency health
- **WHEN** project status reports a fully indexed repository whose safe discovery and source operations remain available
- **AND** the recommended action requires correcting unresolved imports before re-indexing
- **THEN** the agent continues with the safe Astrograph operations
- **AND** does not repeat `index_folder` during the same unchanged session

#### Scenario: Hydration cannot recover retrieval
- **WHEN** indexing or the retried Astrograph request fails
- **THEN** the agent may use filesystem inspection
- **AND** states the failure reason instead of describing the index as skipped

#### Scenario: Runtime upgrade changes stored symbol representation
- **WHEN** an upgraded runtime opens an index created before the structural-signature representation
- **THEN** Astrograph archives the incompatible cache through the existing reversible recovery flow
- **AND** rebuilds the repository before serving retrieval from the new storage version
