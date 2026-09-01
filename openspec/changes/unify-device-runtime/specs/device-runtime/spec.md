## Purpose

Provide one predictable device-level Astrograph runtime that every supported
global MCP client can use without duplicating repository indexes or daemons.

## ADDED Requirements

### Requirement: Global clients use the device installation

Global Astrograph setup SHALL register Codex and Copilot CLI to invoke the
same device-installed Astrograph command, rather than a client-specific
temporary package installation.

#### Scenario: Both global clients are configured

- **WHEN** a user configures global Astrograph for Codex and Copilot CLI
- **THEN** both client registrations invoke the device-installed Astrograph command with the MCP subcommand
- **AND** neither registration resolves Astrograph through `npx`

#### Scenario: Device command is unavailable

- **WHEN** a user requests global client setup and no device-installed Astrograph command is available
- **THEN** setup installs the current Astrograph version once for the active Node runtime and verifies the command before writing client configuration

#### Scenario: Device installation cannot complete

- **WHEN** the device installation or command verification fails during global setup
- **THEN** setup makes no client-configuration changes
- **AND** reports how to install or repair the device command

### Requirement: Global clients share one device runtime

Globally configured clients SHALL use the same user-level cache and runtime
location, preserving one isolated index per canonical repository and reusing a
compatible daemon.

#### Scenario: Two clients access one repository

- **WHEN** globally configured Codex and Copilot CLI access the same canonical repository with compatible Astrograph versions
- **THEN** both use the repository's existing global cache entry
- **AND** both use the same ready daemon runtime

#### Scenario: A stale device runtime is found

- **WHEN** a global client finds a demonstrably stale daemon record
- **THEN** Astrograph removes only that stale record and starts one replacement daemon
- **AND** it retains indexes for other repositories
