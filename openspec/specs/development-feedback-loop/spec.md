# development-feedback-loop Specification

## Purpose

Provide a fast, trustworthy local development signal and privacy-safe evidence
for finding the dominant cost when Astrograph work becomes slow or unreliable.

## Requirements

### Requirement: One command provides the required fast verification signal

The repository SHALL expose and document one deterministic local command whose
checks match the required pull-request gate, while separately naming expensive
package, reliability, and performance gates.

#### Scenario: Developer requests the shortest trustworthy check
- **WHEN** a developer runs the documented fast verification command
- **THEN** it executes the same checks required for ordinary pull requests
- **AND** its output identifies the failing verification layer
- **AND** it does not implicitly run an expensive optional gate

### Requirement: Verbose performance evidence is local, optional, and sanitized

Astrograph SHALL retain its existing aggregate observability behavior by
default and SHALL expose bounded verbose performance detail only when explicitly
enabled. Verbose evidence MUST exclude source text, raw queries, repository file
paths, session identifiers, and captured child-process output.

#### Scenario: Default report is requested
- **WHEN** a user runs `astrograph report`
- **THEN** the top-level command succeeds and returns the existing aggregate
  privacy-safe report
- **AND** no verbose profile rows are included

#### Scenario: Verbose performance capture and report are enabled
- **WHEN** verbose performance capture is enabled and a user runs
  `astrograph report --verbose`
- **THEN** the report includes bounded recent operation and index-phase timings
- **AND** includes outcome and effective concurrency information needed to
  compare equivalent runs
- **AND** includes none of the excluded content

### Requirement: Performance optimization is measurement bounded

The development workflow SHALL compare equivalent fixed-input runs and SHALL
change only the smallest set of shared causes proven dominant by the same
baseline. Real-client trials SHALL remain bounded, read-only, and privacy-safe.

#### Scenario: A bounded performance pass is run
- **WHEN** a developer investigates a reported slowdown
- **THEN** the workflow records a before baseline from equivalent deterministic
  or real-client runs
- **AND** selects only the dominant measured Astrograph causes for change
- **AND** repeats equivalent runs after the change
- **AND** records a no-change result when the evidence identifies no actionable
  Astrograph hot path

#### Scenario: A real-client trial is recorded

- **WHEN** Copilot or Codex is used to measure Astrograph behavior
- **THEN** the retained repository evidence contains aggregates rather than raw
  prompts, source, client logs, or session identifiers
- **AND** the trial has an explicit request, permission, and duration bound

### Requirement: Unhealthy-client retries are bounded

The documented agent workflow SHALL use one project status attempt, at most one
hydration attempt when appropriate, and one status retry before reporting
structured runtime diagnostics or requiring a fresh client.

#### Scenario: Astrograph remains unavailable after hydration
- **WHEN** status or hydration fails and the single retry also fails
- **THEN** the agent stops repeating the same MCP sequence
- **AND** records the attempted operation, duration, result, and retry reason
- **AND** reports the runtime or client failure layer before using direct
  repository inspection
