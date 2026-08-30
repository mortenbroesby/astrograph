## Purpose

Ensure every managed global Astrograph client uses one installed runtime and one compatible user-local daemon across setup, repair, and package upgrades.

## ADDED Requirements

### Requirement: Managed global clients use one installed runtime
Global setup SHALL register the Astrograph installation that performs setup without invoking a package downloader or creating a second package copy at client startup. Repeated global install, update, repair, or reconfigure operations SHALL converge the selected client and every already-managed global client on that same runtime while preserving unrelated configuration.

#### Scenario: Fresh global registration
- **WHEN** a user runs global setup from an installed Astrograph package
- **THEN** the managed client launches that installed package directly and does not invoke `npx` or download Astrograph at startup

#### Scenario: Global package upgrade
- **WHEN** a user runs a global lifecycle command from a newer installed Astrograph package
- **THEN** every existing Astrograph-managed global client registration is updated to the newer runtime invocation without duplicating its managed server entry

#### Scenario: Unmanaged conflict
- **WHEN** setup detects another Astrograph registration or installation that it does not own
- **THEN** it reports the conflicting location and recovery guidance without deleting or rewriting the unmanaged state

### Requirement: One daemon spans compatible package versions
Astrograph clients SHALL reuse the one live user-local daemon when its daemon protocol is compatible, regardless of npm package-version differences. A client SHALL NOT start a competing daemon while a live daemon owns the shared runtime record.

#### Scenario: Compatible package upgrade
- **WHEN** a client from a newer package version connects to a live daemon with the same supported protocol version
- **THEN** the client uses that daemon instead of returning a package-version incompatibility error or starting another daemon

#### Scenario: Incompatible protocol
- **WHEN** a client encounters a live daemon with an unsupported protocol version
- **THEN** the client returns actionable recovery guidance and does not replace, signal, or compete with that daemon

### Requirement: Global lifecycle synchronizes daemon ownership
A successful non-dry-run global install, update, repair, or reconfigure SHALL leave managed clients pointing at the current installed runtime and SHALL leave the compatible singleton daemon running that runtime version. Daemon retirement SHALL authenticate against the private daemon endpoint before signaling or removing live state.

#### Scenario: Upgrade with a live older daemon
- **WHEN** a global lifecycle command runs from a newer installed package while an older compatible daemon is live
- **THEN** Astrograph authenticates the daemon, retires it, waits for its runtime record to clear, starts the current daemon, and verifies readiness before reporting success

#### Scenario: Dry-run lifecycle
- **WHEN** a global lifecycle command runs with `--dry-run`
- **THEN** it previews configuration convergence without stopping or starting a daemon

#### Scenario: Synchronization cannot complete
- **WHEN** the existing daemon cannot be authenticated or retired safely
- **THEN** the lifecycle command fails with source-free recovery guidance and leaves user configuration and live daemon state unchanged

### Requirement: Indexing remains available after upgrades
After successful global runtime synchronization, Astrograph SHALL preserve hydration-first indexing and SHALL allow repository indexing through the managed daemon. Agents MAY fall back to ordinary repository tools only after Astrograph hydration and retry fail fatally, and the fallback reason MUST be reported.

#### Scenario: First repository use after upgrade
- **WHEN** a managed client opens a repository without a healthy index after a successful global upgrade
- **THEN** `index_folder` completes through the synchronized daemon and retrieval can be retried

#### Scenario: Fatal Astrograph failure
- **WHEN** status, hydration, and retry fail because Astrograph is unavailable
- **THEN** agent guidance permits ordinary repository tools and requires the fatal Astrograph failure to be stated
