## MODIFIED Requirements

### Requirement: The shared daemon remains conditional on reliability

The implementation SHALL retain the shared daemon only while concurrency and recovery tests demonstrate that it improves efficiency without reducing client or project isolation reliability. Client guidance SHALL account for the daemon's per-repository safety queue.

The managed runtime SHALL reuse its selected Node executable across client-driven upgrades and SHALL run package installation and native rebuild lifecycle scripts with that Node's bin directory first on `PATH`.

#### Scenario: The daemon passes the reliability gate
- **WHEN** simultaneous Codex and Copilot bridges across multiple repositories and worktrees complete the defined reliability suite
- **THEN** the shared daemon remains the default architecture

#### Scenario: One client requests several operations for one repository
- **WHEN** an agent needs multiple Astrograph results from the same canonical repository root
- **THEN** client guidance directs it to issue those operations sequentially
- **AND** ordinary requests do not expire solely because the client created a same-repository parallel burst

#### Scenario: The daemon repeatedly fails the reliability gate
- **WHEN** failures remain attributable to shared daemon ownership after the stable runtime, bounded recovery, and documented request sequencing are in place
- **THEN** the implementation may replace or remove the shared daemon behind the same client registration contract
- **AND** preserves existing indexes or provides a reversible migration

#### Scenario: Codex and Copilot launch setup from different Node environments
- **WHEN** a device already has a healthy managed runtime and another client upgrades it from a different ambient Node version
- **THEN** Astrograph retains the active descriptor's Node executable
- **AND** npm install and native rebuild scripts execute with that Node's bin directory first on `PATH`
- **AND** runtime verification loads native dependencies under the same ABI before client configuration is changed

#### Scenario: A client rewrites Codex TOML comments
- **WHEN** the Astrograph block still selects an immutable entrypoint inside the managed runtime root but its management comments are missing or displaced
- **THEN** setup recognizes the registration by its managed command structure
- **AND** restores one canonical managed block without requiring `--reset`
- **AND** preserves unrelated Codex and MCP configuration
