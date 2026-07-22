# Global Installation Health and Recovery Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](./high-impact-followups-epic.md), Story 2
>
> **Status:** Deferred — the current global Codex path already covers the
> high-impact recovery cases. Reopen only with a reproducible supported-client
> failure that current output cannot resolve.

**Goal:** Make global Astrograph installation failures inspectable and safely
repairable without requiring users to know client config locations.

**Architecture:** Reuse the existing global installer, configuration path
resolver, and marker-owned configuration writes. Prefer direct, breaking
changes over compatibility shims when the evidence identifies a gap. Never
modify configuration not owned by Astrograph.

**Tech Stack:** TypeScript, Node.js 22 LTS, pnpm, Vitest, existing global
installer and CLI/MCP contract tests.

---

## Task 1: Inventory Existing Health Signals

**Files:**
- Inspect: `src/scripts/install.ts`, `src/cli.ts`, `src/command-registry.ts`,
  `src/doctor.ts`, `src/config.ts`
- Inspect tests: `tests/engine-contract.test.ts`, `tests/cli-boundary.test.ts`,
  `tests/interface.test.ts`, `tests/package-bin.test.ts`
- Record: this checklist

- [x] Run the focused baseline in CI mode:

  ```bash
  CI=1 pnpm type-lint
  CI=1 pnpm exec vitest run --no-file-parallelism tests/engine-contract.test.ts tests/cli-boundary.test.ts tests/interface.test.ts
  CI=1 pnpm test:package-bin
  ```

  Evidence: type lint and 60 focused engine/CLI/interface tests pass. The
  packed-package smoke also passes with network access, matching CI; its
  sandbox-only failure was npm DNS resolution, not Astrograph behavior.

- [x] Map every existing global-install preflight, marker ownership rule,
  installer response, cache status/doctor signal, and failure diagnostic.
  `setupGlobalForCodex()` validates Node >=22.12 and executable availability,
  preserves non-Astrograph config through a managed marker block, supports
  dry-run previews, and gives ownership/permission remediation. Existing
  `cache status` and repository `doctor` provide storage/index health; the
  packed-package smoke proves the global installation path end to end.

- [x] Produce a supported client/terminal matrix from actual tested behavior.
  Global setup is currently proven for Codex only; repository-local setup
  supports Codex, Copilot, and Copilot CLI. The packed-package smoke proves
  global Codex registration, two isolated global cache roots, and CLI usage.
  No other global client is promised.

## Task 2: Reproduce and Prioritize Recovery Gaps

**Deferred:** No reproducible high-impact gap remains in the supported global
Codex surface. The package smoke now includes child-process stdout/stderr in a
failure report, making environment failures actionable without a new command.

- [ ] Add focused fixtures for only the missing high-impact cases: moved or
  missing executable, unsupported Node, marker drift, unwritable config, stale
  generated configuration, and repeated repair.

- [ ] Record which gaps are already actionable and which require a new health
  or repair surface. Do not add a generic "doctor" command if existing output
  is sufficient.

- [ ] Select the smallest public contract: improve installer output, add one
  inspectable health subcommand, or add one marker-owned repair flow. Defer
  lower-impact clients and terminal permutations.

## Task 3: Implement the Selected Recovery Path

**Selection gate:** Tasks 1–2 identify a reproducible failure that current
output cannot resolve safely.

**Deferred:** Task 2 did not identify such a gap.

- [ ] Implement only the selected path. It must be JSON-first where it writes
  or reports state, dry-run-safe when configuration could change, and preserve
  non-Astrograph configuration byte-for-byte.

- [ ] Make repeated repair idempotent and fail before a partial write when the
  executable, runtime, permissions, or owned marker cannot be validated.

- [ ] Add only the targeted CLI/MCP/API documentation required by the chosen
  contract; do not expand this into multi-client setup work.

## Task 4: Verify and Handoff

- [x] Run the focused fixtures plus the applicable release guardrails:

  ```bash
  CI=1 pnpm type-lint
  CI=1 pnpm test:package-bin
  pnpm check:version-bump
  git diff --check
  ```

  Evidence: all listed checks pass. `pnpm release:plan` is intentionally not
  applicable: Story 2 makes no product-contract change and
  `check:version-bump` confirms no release is required. The packed-package
  smoke passes when run with CI-equivalent network access.

- [x] Update this checklist and the active epic with the exact failure,
  remediation, tests, and release decision. **Deferred:** no material gap
  remains. The only change is an improved package-smoke error that includes
  child-process stdout/stderr; merge it only after CI verifies the exact
  commit.
