## Why

Astrograph's custom spec taxonomy duplicates the lifecycle OpenSpec already
provides and spreads work state across a pointer, roadmap, indexes, and plan
files. One standard workflow reduces drift while preserving existing work and
evidence.

## What Changes

- Make OpenSpec the only live specification and work-tracking system.
- Migrate every active and planned tracker, preserving its checkbox state.
- Archive completed records and retain old architecture/API prose as read-only
  brownfield source material.
- Replace incompatible local planning skills and commands with generated
  OpenSpec integrations for Codex and Claude Code.

## Capabilities

### New Capabilities

- `repository-workflow`: Defines how durable changes are proposed, applied,
  tracked, and archived.

### Modified Capabilities

- None.

## Impact

Repository agent instructions, planning artifacts, and documentation links
change. Runtime code and public APIs do not.
