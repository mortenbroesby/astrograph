# Global Copilot CLI Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](../planned/high-impact-followups-epic.md), Story 8
>
> **Status:** Complete — merged as PR #29 after exact-head Fast and Windows
> compatibility/package-smoke CI passed.

**Goal:** A user installs Astrograph for Copilot CLI once, then works in any repository with Astrograph’s user-private global cache and without repo-local Astrograph configuration.

**Architecture:** Write only the Astrograph-owned `mcpServers.astrograph` entry in Copilot CLI’s user configuration (`~/.copilot/mcp-config.json`, or `$COPILOT_HOME/mcp-config.json`). Reuse the global Astrograph configuration that selects `storageLocation: "global"`. Keep repository-local `.mcp.json` as an explicit override path, because Copilot CLI gives it precedence over a same-named user server. Do not add a daemon, shared mutable cache, or a new configuration format.

**Tech Stack:** TypeScript, Node.js 22 LTS, Vitest, SQLite, the existing installer, and Copilot CLI’s documented local MCP JSON format.

---

## Task 1: Define and Prove the User-Level Contract

**Files:**
- Modify: `src/scripts/install.ts`
- Test: `tests/engine-contract.test.ts`
- Reference: `https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference`
- Reference: `https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers`

- [x] Confirm the documented configuration location and shape: user-level `mcp-config.json` uses an `mcpServers` object and local servers use `type: "local"`, `command`, `args`, `env`, and `tools`. `COPILOT_HOME` replaces the default `~/.copilot` configuration root.
- [x] Add an idempotent global Copilot CLI installer that validates the same Node/PATH prerequisites as Codex, preserves unrelated JSON and MCP entries, writes the global Astrograph storage selection, and supports dry run.
- [x] Extend `astrograph install --global --ide` to accept `copilot-cli` as a first-party target, rejecting unsupported targets without writing configuration. The packed-package smoke invokes the real CLI command with `$COPILOT_HOME`.

## Task 2: Prove Normal Global Use and Recovery

**Files:**
- Test: `tests/engine-contract.test.ts`

- [x] Add disposable-home tests for install, re-run/repair, invalid user configuration, and `$COPILOT_HOME` override. Unrelated user MCP entries survive unchanged. A relative `$COPILOT_HOME` is rejected before writes.
- [x] Add a two-unconfigured-repository integration test: install once, index and query both repositories, prove isolated paths below the shared global Astrograph cache root, and prove neither repository receives `.mcp.json`, `.astrograph`, or `astrograph.config.*`.

## Task 3: Document the First-Party Path and Hand Off

**Files:**
- Modify: `README.md`
- Modify: `docs/reference/cli.md`
- Modify: `docs/guides/troubleshooting.md`
- Modify: `specs/implementation/active/high-impact-followups-epic.md`
- Modify: `specs/implementation/active/README.md`
- Modify: this checklist

- [x] Document one-time global installation for Codex and Copilot CLI, the normal “use Astrograph in the opened repository” workflow, user-level config locations, and `cache status`/`doctor` recovery. Keep repo-local install as an explicit alternative.
- [x] Run the focused contract tests, `CI=1 pnpm type-lint`, `pnpm test:package-bin`, `pnpm check:version-bump`, `git diff --check`, and the specs inventory command. Four focused Copilot global tests passed; the full contract file passed 47/47; packed-package smoke completed successfully; type and version checks passed after the `0.5.0-alpha.137` increment.
- [x] Commit, push, and merge only after the exact PR head passes Fast required
  checks and Windows compatibility/package smoke. PR #29 run `29875333200`
  passed both gates for final exact head `ddf6dc6`, then merged.
