## Purpose

Provide one dependable device-owned Astrograph runtime for Codex and Copilot
across repositories and linked worktrees without cwd or toolchain drift.

## ADDED Requirements

### Requirement: Client registration is independent of repository context

Astrograph SHALL register Codex and Copilot with an absolute device-owned
runtime command that does not resolve Astrograph through the current working
directory, repository `.tool-versions`, shell `PATH`, or package-manager shim.

#### Scenario: A client starts inside different repositories and worktrees

- **WHEN** Codex or Copilot launches Astrograph from any configured repository
  or worktree
- **THEN** the configured command uses the device runtime's absolute Node
  executable and absolute installed Astrograph entrypoint
- **AND** reports the same selected immutable Astrograph version

#### Scenario: A new runtime is activated

- **WHEN** a registry-installed runtime passes installation verification
- **THEN** client registrations are updated transactionally
- **AND** the previously working runtime remains selectable until the new
  registration and MCP handshake have been verified

### Requirement: Codex and Copilot use compatible client adapters

Astrograph SHALL support client-specific configuration formats while keeping
their package selection and persistent runtime state compatible.

#### Scenario: Both supported clients are configured

- **WHEN** the installer configures Codex and Copilot
- **THEN** it writes the native TOML or JSON representation required by each
  client
- **AND** both registrations identify the same selected package version
- **AND** each client receives its own stdio MCP bridge

### Requirement: Repository and worktree indexes remain distinct

The runtime SHALL identify projects by canonical repository or worktree root
and SHALL NOT merge indexes merely because projects share Git history or a
common daemon.

#### Scenario: Two worktrees of one repository are used concurrently

- **WHEN** requests arrive for two canonical worktree roots
- **THEN** each root has a distinct project identity and index
- **AND** updates in one worktree do not replace or invalidate the other index

#### Scenario: Multiple repositories share the runtime

- **WHEN** clients use Astrograph across multiple repository roots
- **THEN** a compatible shared daemon may serve those projects efficiently
- **AND** project routing remains explicit and isolated

### Requirement: Startup failure has bounded recovery and diagnostics

The client bridge SHALL recover from expected stale or incompatible runtime
state within a bounded startup sequence and SHALL fail with actionable
identity information instead of disappearing silently.

#### Scenario: The daemon version is incompatible

- **WHEN** a bridge encounters a daemon owned by an incompatible Astrograph
  version
- **THEN** it selects the deterministic daemon namespace for its own immutable
  package version instead of contending for the older version's state or socket
- **AND** retries the handshake within a documented time bound
- **AND** avoids unbounded competing restart loops between clients
- **AND** leaves live clients on the older immutable version operational

#### Scenario: Recovery cannot establish an MCP server

- **WHEN** bounded startup recovery is exhausted
- **THEN** diagnostics show the configured client, absolute runtime paths,
  selected and effective package versions, daemon identity, project root, and
  index state
- **AND** state whether the client must reload its MCP catalog

#### Scenario: Initial repository hydration exceeds a short query deadline

- **WHEN** `index_folder` needs longer than the ordinary retrieval request
  budget to hydrate a real repository
- **THEN** the daemon bridge keeps that request connected for its documented
  bounded hydration budget
- **AND** ordinary status and retrieval calls retain their shorter failure bound

### Requirement: The shared daemon remains conditional on reliability

The implementation SHALL retain the shared daemon only while concurrency and
recovery tests demonstrate that it improves efficiency without reducing
client or project isolation reliability.

#### Scenario: The daemon passes the reliability gate

- **WHEN** simultaneous Codex and Copilot bridges across multiple repositories
  and worktrees complete the defined reliability suite
- **THEN** the shared daemon remains the default architecture

#### Scenario: The daemon repeatedly fails the reliability gate

- **WHEN** failures remain attributable to shared daemon ownership after the
  stable runtime and bounded recovery are in place
- **THEN** the implementation may replace or remove the shared daemon behind
  the same client registration contract
- **AND** preserves existing indexes or provides a reversible migration
