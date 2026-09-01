## Purpose

Ensure supported MCP clients can keep using Astrograph's indexed retrieval path when a local repository index or daemon needs recovery.

## ADDED Requirements

### Requirement: Validated client session metadata

The MCP server SHALL preserve the existing `content-references-v1` session validation at the tool boundary and shall not execute a tool when its session metadata is malformed.

#### Scenario: Client supplies a valid session envelope

- **WHEN** a supported tool receives a `content-references-v1` session with a valid identifier and optional known content IDs
- **THEN** the tool executes normally and applies the existing content-reference behavior

#### Scenario: Client supplies malformed session metadata

- **WHEN** a supported tool receives an invalid session capability, identifier, or known content ID list
- **THEN** the tool returns an `invalid_argument` result without executing the requested command

### Requirement: Actionable indexed-retrieval recovery

The MCP server SHALL make a failed or timed-out daemon/index request distinguishable from an application failure, so a supported client can perform one bounded index hydration and retry before choosing its documented fallback.

#### Scenario: Missing or stale index hydrates successfully

- **WHEN** repository status shows an index is missing or stale and the client requests hydration
- **THEN** Astrograph completes hydration and a subsequent indexed retrieval can return a normal result

#### Scenario: Hydration cannot complete

- **WHEN** daemon startup, indexing, or an indexed retrieval times out or fails during recovery
- **THEN** Astrograph returns a stable actionable failure that identifies recovery as unavailable rather than an opaque internal error

#### Scenario: Recovery retry is bounded

- **WHEN** a daemon request detects a stale runtime record during an indexed operation
- **THEN** Astrograph starts at most one replacement daemon and retries the request once before returning the actionable failure

### Requirement: Nested worktree exclusion

Astrograph SHALL exclude a nested `.worktrees` directory from source discovery and discovery-only file listing, so indexing a checkout does not include sibling local worktree copies.

#### Scenario: Repository contains nested worktrees

- **WHEN** a repository root contains `.worktrees/<name>/` with supported source files
- **THEN** discovery and file listing omit those files while retaining supported files in the target checkout
