## Purpose

Define immutable npm snapshot and production channels whose published package
is the exact artifact that passed package and MCP verification.

## ADDED Requirements

### Requirement: Snapshot publication uses one verified immutable artifact

The project SHALL provide an npm `snapshot` channel whose publication job
creates one uniquely versioned package tarball, verifies that exact tarball,
and publishes that same file without rebuilding or repacking it.

#### Scenario: A snapshot is published

- **WHEN** an authorized manual snapshot run targets a commit
- **THEN** the run assigns an immutable snapshot version derived from the
  release line and run identity
- **AND** packs the package exactly once in an isolated staging directory
- **AND** runs the package-binary and MCP smoke tests against that tarball
- **AND** publishes that same tarball under the npm `snapshot` dist-tag
- **AND** reports the commit, package version, tarball digest, and npm dist-tag

#### Scenario: Snapshot verification fails

- **WHEN** a package or MCP smoke test fails, the version already exists, or
  the target commit cannot be established unambiguously
- **THEN** publication stops before mutating the npm registry
- **AND** the `latest` dist-tag remains unchanged

### Requirement: Dogfooding installs snapshots from npm

The device runtime SHALL install a selected snapshot through the npm registry,
not from a repository checkout, workspace link, or local tarball.

#### Scenario: A developer selects the snapshot channel

- **WHEN** the device runtime is installed or updated from `snapshot`
- **THEN** it resolves and installs `astrograph@snapshot` into its managed
  runtime location
- **AND** records the resolved immutable package version
- **AND** verifies the installed package before activating it for any client

### Requirement: Production publication is isolated from snapshots

The npm `latest` channel SHALL remain a separately guarded main-branch release
path and SHALL publish the exact package tarball verified by that release run.

#### Scenario: A production package is published

- **WHEN** the guarded main-only release reaches its publish step
- **THEN** it consumes the same tarball and digest produced by its package
  verification step
- **AND** publishes that file under `latest` without rebuilding it

#### Scenario: Snapshot code is promoted toward production

- **WHEN** a snapshot has completed device dogfooding successfully
- **THEN** production still requires the normal reviewed main-branch release
  and version decision
- **AND** uses the same pack-once, test-that-file, publish-that-file workflow
  rather than assuming a locally tested checkout is equivalent
