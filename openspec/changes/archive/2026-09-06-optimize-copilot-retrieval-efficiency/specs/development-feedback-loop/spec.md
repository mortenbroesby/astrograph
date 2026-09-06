## MODIFIED Requirements

### Requirement: Performance optimization is measurement bounded

The development workflow SHALL compare equivalent fixed-input runs and SHALL change only the smallest set of shared causes proven dominant by the same baseline. Real-client trials SHALL remain bounded, read-only, and privacy-safe.

#### Scenario: A bounded performance pass is run
- **WHEN** a developer investigates a reported slowdown
- **THEN** the workflow records a before baseline from equivalent deterministic or real-client runs
- **AND** selects only the dominant measured Astrograph causes for change
- **AND** repeats equivalent runs after the change
- **AND** records a no-change result when the evidence identifies no actionable Astrograph hot path

#### Scenario: A real-client trial is recorded
- **WHEN** Copilot or Codex is used to measure Astrograph behavior
- **THEN** the retained repository evidence contains aggregates rather than raw prompts, source, client logs, or session identifiers
- **AND** the trial has an explicit request, permission, and duration bound
