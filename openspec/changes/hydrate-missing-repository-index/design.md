## Context

`index_folder` already creates a complete repository index, and
`get_project_status` exposes missing and stale readiness. The gap is the
generated agent policy: it suggests indexing but does not require waiting and
retrying before filesystem fallback.

The source checkout's `astrograph.config.ts` also imports the package's public
runtime entrypoint. Before a build, that entrypoint targets absent `dist` files,
so configuration loading prevents indexing from starting.

## Goals / Non-Goals

**Goals:**

- Make first-use recovery explicit in Codex and Copilot policy blocks.
- Keep the source checkout's typed config loadable before its first build.
- Preserve a clear, evidence-based fallback when hydration cannot complete.
- Prove the emitted policy cannot regress to a silent missing-index fallback.

**Non-Goals:**

- Background indexing, install-time indexing, or automatic indexing of every
  repository a client opens.
- New MCP tools, dependencies, telemetry, or a change to index storage.

## Decisions

### Put recovery in the shared generated policy

Update `agentsPolicyBlockForAgentsMd` and
`agentsPolicyBlockForCopilotInstructions` in `src/scripts/install.ts`, plus the
repository's own exploration policy. This reaches installed repositories and
the Astrograph development workflow without duplicating index behavior.

The alternative—auto-indexing inside every retrieval tool—would turn a read
operation into an unexpected write and make latency and failure handling less
visible to the caller.

### Treat index hydration and retrieval retry as one recovery sequence

The policy will say: readiness check, `index_folder`, wait, retry the original
tool, then explain any fallback. Existing `index_folder` completion already
provides the hydration boundary, so no polling or background worker is needed.

### Make the repository config type-only in source mode

Replace the Astrograph repository config's runtime `defineConfig` import with a
TypeScript `satisfies` type reference to the source type contract. The type
reference is erased by the config loader, retaining editor guidance without
asking Node to resolve the unbuilt package export.

Changing the config loader to special-case self imports would add a hidden
resolution path that consumer repositories do not need.

### Verify emitted text rather than client-specific behavior

Extend `tests/engine-contract.test.ts` previews for both policy variants.
This verifies the installed contract without requiring Codex or Copilot during
CI.

Add a focused configuration-load assertion for the package-root checkout. It
runs before the build command and proves the no-`dist` case directly.

## Risks / Trade-offs

- [An agent lacks a working MCP transport] → Guidance permits filesystem
  fallback only after reporting the failed hydration/retry reason.
- [A stale index remains degraded for non-index reasons] → The agent retries
  the safe retrieval request rather than looping on repeated indexing.
- [A config uses a runtime self import] → Keep this change scoped to
  Astrograph's own source config; installed consumer packages already have the
  public `dist` entrypoint.

## Migration Plan

Managed policy markers already replace prior generated blocks on a subsequent
`astrograph install --agents`; no user source or index migration is required.

## Verification

- `pnpm exec vitest run tests/engine-contract.test.ts --testTimeout=20000`
- `pnpm type-lint`
- `pnpm build`
- `pnpm check:version-bump --base origin/main`
- `git diff --check`
