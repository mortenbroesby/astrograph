# Comforting Global Install Experience Implementation Plan

**Goal:** Make global Astrograph setup understandable and reassuring, while
preserving its existing idempotent configuration behavior.

**Architecture:** Keep `setupGlobalForCodex` and `setupGlobalForCopilotCli` as
the sole writers. Add a human-oriented CLI renderer around their existing
results, retain machine-readable output behind an explicit `--json` flag, and
use a package lifecycle message only to explain the next safe command after a
global npm installation. Package installation must never edit MCP client
configuration automatically.

**Tech Stack:** TypeScript, Node.js >=22.12.0, Commander, Clack prompts,
pnpm, and Vitest.

---

## Task 1: Render global setup for people

**Files:** `src/scripts/install.ts`, `tests/engine-contract.test.ts`.

- [x] Add a small formatter for successful global setup that names the selected
  client, Astrograph version, managed configuration locations, global private
  storage, and the one next action: restart the client and open any repository.
- [x] Use Clack progress feedback only for an interactive terminal. Keep
  non-interactive output plain and readable.
- [x] Add `--json` as the explicit compatibility escape hatch for scripts and
  dry-run previews; do not expose configuration-file contents in normal output.
- [x] Verify the formatter, JSON mode, and dry-run wording with focused tests.

## Task 2: Welcome a global package installation without side effects

**Files:** `package.json`, `src/scripts/global-install-message.mjs` (new),
`tests/global-install-message.test.ts` (new), `README.md`.

- [x] Add a post-install message that runs only when npm reports a global
  install. It must show the installed Astrograph version and direct the user to
  `astrograph install --global --ide codex|copilot-cli`.
- [x] Keep local dependency installs silent, and do not create MCP config,
  storage, or repository files from a package lifecycle hook.
- [x] Explain the two-step global flow in the README: install the executable,
  then explicitly choose and configure a client.

## Task 3: Verify and ship

- [x] Run `pnpm exec vitest run tests/engine-contract.test.ts tests/global-install-message.test.ts` — 50 tests passed on Node 22.23.1.
- [x] Run `pnpm test:package-bin`, `pnpm type-lint`, `pnpm build`,
  `pnpm check:version-bump`, and `git diff --check`.
- [x] Apply the release policy: `pnpm release:plan` classifies the combined
  runtime feature set as minor and targets `0.8.0-alpha.167`.
- [ ] Commit, push, open a draft PR, and record CI evidence before closing this
  plan.
