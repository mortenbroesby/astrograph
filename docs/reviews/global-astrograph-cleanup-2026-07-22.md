# Global Astrograph Cleanup Inventory — July 22, 2026

**Scope:** The active Global Astrograph Cleanup and Delivery Preparation
checklist. This is a bounded evidence record, not a general refactor backlog.

## Baseline

| Check | Result |
| --- | --- |
| `pnpm type-lint` | Passed |
| `pnpm exec vitest run tests/engine-contract.test.ts tests/interface.test.ts tests/cli-boundary.test.ts` | Passed: 62 tests |
| `pnpm check:version-bump` | Passed |

The initial fresh-worktree baseline could not start because dependencies were
not installed (`tsc: command not found`). After `pnpm install --frozen-lockfile`,
the same required baseline passed. This is an environment setup condition, not
a product failure.

## Inventory and decision

| Class | Evidence | Decision |
| --- | --- | --- |
| Obsolete pre-v1 cache reads/migrations | `src/storage.ts` discards an incompatible or malformed cache without reading/migrating its contents; focused engine tests prove removal, including symlink safety. Current SQLite schema migrations remain part of the one current cache format. | Retain; no obsolete-cache compatibility path remains. |
| Legacy JSON repository configuration | `src/config.ts` reads `astrograph.config.json` only when `astrograph.config.ts` is absent. It is documented and covered by engine, CLI, event, and watch fixtures. | Retain as an active public configuration contract; it is not cache compatibility. |
| Duplicate generated-client tool definitions | `src/scripts/install.ts` derives Codex and Copilot allowlists from `MCP_TOOL_DEFINITIONS`. | Retain; the production installer has one owner. |
| Stale tracked Codex client policy | `.codex/config.toml` allowlisted removed MCP `query_code`, omitted current direct tools, and placed the unrelated GitHub server inside Astrograph’s managed block. | **Remove/reconcile now.** Align its allowlist and approvals with the v1 definitions; keep GitHub outside Astrograph markers. |
| Documentation/spec tracker links | `pointer.md`, `specs/implementation/roadmap.md`, and active/planned/closed indexes were reconciled in PRs #41–42. | No additional cleanup candidate found in this inventory. |

## Selected cleanup

The safe cohesive change is limited to `.codex/config.toml` and a contract test:

- replace the removed `query_code` allowlist entry with all current MCP v1 tool
  names, in canonical `MCP_TOOL_DEFINITIONS` order;
- add matching approval blocks so development behavior follows the installer’s
  generated configuration;
- close Astrograph’s marker before the independently owned GitHub server;
- prove the tracked configuration cannot again drift from the MCP definition.

This changes no runtime MCP tool, installer behavior, cache format, public
envelope, or repository configuration contract.

## Next-story selection

[File-Type Support Coverage and Discovery](../../specs/implementation/planned/filetype-support-coverage-delivery-checklist.md)
is the next selected story after this cleanup merges. The user requested visible
support for `.cjs`, `.mjs`, `.yaml`, `.yml`, `.md`, and `.txt`; the registry
already supports those extensions, but user-facing coverage documentation and
the full extension matrix are not yet complete. Its first task verifies that
contract and adds only evidence-backed missing support.
