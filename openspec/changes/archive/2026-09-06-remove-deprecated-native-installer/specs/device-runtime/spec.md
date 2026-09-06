## ADDED Requirements

### Requirement: Supported runtimes use maintained native installation

Astrograph SHALL require Node.js 22.12 or newer and SHALL install its native
SQLite runtime without the deprecated `prebuild-install` package.

#### Scenario: User installs on a supported Node runtime

- **WHEN** Astrograph is installed from its packed npm artifact on Node.js 22.12 or newer
- **THEN** package installation does not emit the `prebuild-install` deprecation warning
- **AND** indexing opens and uses the packaged native SQLite dependency successfully

#### Scenario: User installs on Node 20

- **WHEN** a user attempts to install or configure Astrograph on Node.js 20
- **THEN** package metadata and installer diagnostics state that Node.js 22.12 or newer is required
- **AND** no client configuration is changed by the rejected setup

#### Scenario: Maintainer verifies supported runtime families

- **WHEN** the compatibility workflow is dispatched
- **THEN** it offers maintained Node.js 22 and Node.js 24 runtime targets
- **AND** runs the packed package smoke against the selected target
