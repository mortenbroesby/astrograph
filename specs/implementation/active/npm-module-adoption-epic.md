# Reduce Astrograph Boilerplate with Proven npm Modules

> **Status:** Active — Story 1 is selected. Follow its delivery checklist;
> Stories 2–10 remain planned until explicitly selected.

**Goal:** Replace generic bespoke tooling plumbing with mature npm modules where
that reduces maintenance or strengthens package confidence, while preserving
Astrograph-specific product behavior.

**Architecture:** Keep the command registry, MCP response envelopes, installer
managed blocks, and release-policy semantics custom. Adopt a module only behind
a small internal seam, one bounded area at a time, with explicit error, timeout,
offline, and Windows behavior retained.

**Tech stack:** TypeScript, Node.js `>=22.12.0`, pnpm, Vitest, npm, GitHub
Actions; candidates: `execa`, `semver`, `latest-version`, `publint`,
`@arethetypeswrong/cli`, `knip`, `dependency-cruiser`, `tsx`, `confbox`, and
`concurrently`.

## Non-goals

Do not replace the command registry, MCP contract/response envelope model,
installer managed-block behavior, or Astrograph-specific release-decision
logic. Those remain custom unless a future ADR provides strong contrary
evidence.

Every selected story records current call sites and behavior, verifies the
candidate's Node/license fit, and runs `pnpm check:version-bump` for source,
script, test, or package-metadata changes.

## Priority and slices

| Slice | Stories | Purpose |
| --- | --- | --- |
| A — plumbing | 1–3 | Generic process, semver, and registry lookup cleanup. |
| B — package confidence | 4–6 | Package-quality and dependency-drift gates. |
| C — boundaries/scripts | 7–8 | Architecture boundaries and TS script evaluation. |
| D — situational | 9–10 | Installer/local-development improvements only with evidence. |

## Story 1 — Process execution seam with `execa`

**Targets:** `package.json`, new `src/lib/process.ts`,
`src/scripts/run-vitest.ts`, `src/scripts/release-agent.ts`,
`src/scripts/install.ts`, and focused tests.

**Tasks:** add `execa`; define a narrow process wrapper; migrate the named
scripts in that order; preserve stdio, timeouts, non-zero propagation, and
Windows behavior.

**Done when:** those targets have no direct `spawnSync`/`execFileSync` without
a documented reason, diagnostics are at least equivalent, and supported-Node
CI passes.

## Story 2 — Generic version handling with `semver`

**Targets:** `package.json`, generic helpers in `src/version.ts` and
`src/release-transaction.ts`, installer update logic, and tests.

**Tasks:** replace only generic parsing/comparison with `semver`; retain
Astrograph alpha-release policy and its decision rules.

**Done when:** generic version ordering is library-backed, alpha behavior is
unchanged, and installer/release tests pass.

## Story 3 — Registry lookup with `latest-version`

**Targets:** `package.json`, release-agent and installer lookup paths, focused
offline/error tests.

**Tasks:** replace appropriate `npm view … version` subprocess calls; keep an
explicit registry-unavailable policy and existing update wording.

**Done when:** lookup is simpler/testable, failures degrade safely, and user
messaging is unchanged.

## Story 4 — Package gate with `publint`

**Targets:** `package.json`, package/release docs, and CI/release workflow only
after the GitHub Actions cost review.

**Tasks:** add `lint:package`; run after build and before release/apply;
document remediation.

**Done when:** package errors block release, docs explain the check, and scoped
triggers, caching, and concurrency remain intact.

## Story 5 — Consumer export/type checks with `@arethetypeswrong/cli`

**Targets:** `package.json`, pack-smoke scripts/tests, CI/release docs.

**Tasks:** add `lint:types`; run it on the packed tarball, not the source tree.

**Done when:** consumer type/export issues fail before publish and the guardrail
is documented.

## Story 6 — Drift baseline with `knip`

**Targets:** `package.json`, optional config, and evidence-backed removals.

**Tasks:** run locally; classify findings as safe removals, configured false
positives, or intentional retention; add CI only after the baseline is quiet.

**Done when:** a reviewed baseline exists and CI, if selected, has an
acceptable false-positive rate.

## Story 7 — Architecture boundaries with `dependency-cruiser`

**Tasks:** add a minimal rule set that enforces 2–4 useful boundaries: no bench
imports from runtime entries, no unintended heavy runtime imports from scripts,
and no CLI/install-only imports from workers.

**Done when:** violations are actionable and no broad architecture rewrite is
introduced.

## Story 8 — Evaluate `tsx` for TypeScript scripts

**Tasks:** evaluate on the Node floor; migrate only `dev:cli`, `dev:mcp`, one
test command, and one bench command first; retain easy rollback.

**Done when:** selected commands are simpler without macOS/Linux/Windows
regression. Do not migrate every script at once.

## Story 9 — Evaluate `confbox` only for generic config work

**Tasks:** classify installer parsing/serialization versus managed-block code;
adopt `confbox` only for generic JSONC/TOML/YAML/INI work that preserves
formatting.

**Done when:** managed blocks remain custom and the adopt/decline decision is
documented with evidence.

## Story 10 — Evaluate `concurrently` for local development only

**Tasks:** identify one repeated local workflow (for example watcher plus MCP
or bench loop); do not parallelize core build because `build:js` cleans `dist`.

**Done when:** one optional developer loop improves and no build-output race is
introduced.

## Definition of done

- Proven modules handle generic process, semver, registry, package-quality, and
  drift concerns where evidence justifies adoption.
- Astrograph-specific command, MCP, installer-managed-block, and release-policy
  behavior remains custom.
- CI catches package and consumer type/export problems before publication.
- Every adopted dependency has focused behavior and platform evidence.
- CLI, MCP, installer, release, and supported developer workflows do not
  regress.

## Selection gate

Select Slice A only after recording the current call sites and tests. Select
Slice B only after confirming added CI minutes fit the Actions cost policy.
Select Slices C–D only when a concrete boundary or repeated developer workflow
provides the evidence.
