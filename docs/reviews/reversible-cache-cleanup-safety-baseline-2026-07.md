# Reversible Cache Cleanup Safety Baseline

**Date:** 2026-07-22  
**Scope:** Astrograph-managed cache recovery and cleanup only. This review does
not authorize edits, moves, or deletion outside a validated Astrograph cache
root.

## Inventory

| Path | Caller | Scope and confirmation | Safe outcome |
| --- | --- | --- | --- |
| Explicit per-repository cleanup | `cache remove --repo` → `removeGlobalCache` | Global storage only; preview by default; `--yes` required | Move one validated cache directory to `repos/.archive`; emit receipt. |
| Whole-global-cache size pruning | `cache prune --all --max-bytes` → `pruneGlobalCaches` | Exact whole-cache scope; preview by default; `--yes` required | Move oldest inactive, validated repository cache directories to their archive; skip active SQLite databases. |
| Incompatible/malformed storage recovery | `ensureStorageVersion` → `discardObsoleteStorage` | Automatic only for the configured canonical Astrograph storage directory | Reject symlink or active SQLite target; archive the directory, then create an empty current-version cache. |
| Restore | `cache restore --repo --receipt` → `restoreCache` | Preview validates first; `--yes` required | Move only a direct-child archive named by a valid receipt back to an absent canonical cache location. |

`rm` remains in test fixtures and bounded package-smoke temporary-directory
cleanup; it is not used by production cache cleanup or recovery. In-memory
`Map.delete` calls and index record removal do not touch user filesystem paths.

## Required guards

- Resolve and validate the canonical managed root before mutation.
- Reject broad roots, direct or ancestor symlinks, non-directory targets,
  out-of-root receipt paths, collisions, and existing restore destinations.
- Probe SQLite with a zero-timeout exclusive transaction and refuse active
  caches.
- Use same-filesystem `rename` only. Do not fall back to copy-plus-delete when
  a move fails.
- Write a versioned receipt before the move. A failed move leaves the original
  cache in place; the receipt records the attempted archive location.
- Keep archive retention manual until a separate, explicit product decision
  defines a user-visible retention policy. Permanent deletion has no CLI or MCP
  surface.

## External practice reviewed

The design follows the common containment-and-approval pattern rather than
granting a cleanup command broad filesystem authority:

- Codex runs in a scoped sandbox by default and separates elevated filesystem
  access from ordinary work. [Codex safety guidance](https://deploymentsafety.openai.com/gpt-5-3-codex/ai-self-improvement)
- Claude Code exposes permission modes and describes its normal mode as asking
  before tool use; bypassing permissions is explicitly marked dangerous.
  [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- VS Code's filesystem API makes trash use an explicit `useTrash` deletion
  option, instead of making recursive deletion implicit.
  [VS Code workspace filesystem API](https://code.visualstudio.com/api/references/vscode-api)

Astrograph's cache archives intentionally use move-and-receipt rather than a
platform trash integration: cache roots can be remote or nonstandard, while an
adjacent managed archive preserves the same filesystem boundary and has a
deterministic restore command.

## Evidence

- `tests/engine-contract.test.ts`: dry-run, archive bytes/receipt, restore,
  malformed/out-of-root receipt, active lock, and symlink rejection.
- `tests/engine-behavior.test.ts`: obsolete marker recovery, global recovery,
  active-lock refusal, and symlink refusal.
- `tests/cli-boundary.test.ts`: required prune scope and CLI argument boundary.
