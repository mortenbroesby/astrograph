# Global Installation Health and Recovery Delivery Checklist

> **Epic:** [High-Impact Product Follow-Ups Epic](../planned/4_high-impact-followups-epic.md), Story 2
>
> **Status:** Closed — selected after a real global-install failure: npm
> `latest` remained at `0.4.4-alpha.133`, whose CLI lacked `--version` and the
> expected global Copilot setup. `0.5.0-alpha.153` now publishes the new
> contract; verify installation, diagnostics, repair, and client behavior from
> the packaged artifact before adding more surface area.

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
  The installed `0.5.0-alpha.153` artifact reports `copilot-cli` as the default
  global client; `astrograph install --global --dry-run` previews its only two
  writes without changing state. Focused contracts prove idempotent Copilot
  CLI registration, unrelated-config preservation, `COPILOT_HOME`, diagnostics,
  prerequisite failures, and global cache isolation. Codex remains supported;
  no other global client is promised.

## Task 2: Reproduce and Prioritize Recovery Gaps

**Selection evidence:** A globally installed stale package produced an
unactionable experience: `astrograph --version` was unavailable and
`astrograph install --global --ide copilot-cli` was rejected despite the
intended first-party Copilot flow. The release of `0.5.0-alpha.153` contains
the corrective contract. This story must prove the installed artifact—not only
the repository source—makes version, diagnostics, default global Copilot setup,
and safe repair understandable.

- [x] Confirm the existing focused fixtures cover the high-impact cases: a
  missing executable, unsupported Node, invalid/unwritable Copilot config,
  invalid `COPILOT_HOME`, repeat installation, and unrelated-config
  preservation. The managed replacement makes repeated registration the safe
  repair path; no marker-drift or stale-config case exposed an unhandled write.

- [x] Record the decision: all observed failures are already actionable through
  installer preflight, `--diagnostics`, and `--dry-run`. The original failure
  was the stale published `.133` package, not a missing source contract.

- [x] Select no new public recovery surface. Keep the existing JSON diagnostics
  and marker-owned idempotent installer; do not add a generic doctor or repair
  command without a new reproducible gap.

## Task 3: Implement the Selected Recovery Path

**Selection gate:** Tasks 1–2 identify a reproducible failure that current
output cannot resolve safely.

**Not selected:** Task 2 did not identify such a gap.

- [x] No implementation was warranted. Existing JSON diagnostics, dry-run
  preview, preflight failures, and repeat-install behavior already meet the
  bounded recovery contract without adding a compatibility shim or new tool.

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
  remediation, tests, and release decision. **Closed with no source change:**
  `astrograph --version` reported `0.5.0-alpha.153`; `--diagnostics` reported
  the supported Node runtime, `~/.astrograph` paths, configured clients, and
  the next safe step; `install --global --dry-run` previewed Copilot CLI and
  global-storage writes. Four focused global-recovery contracts passed.
