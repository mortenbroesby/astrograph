# Windows CLI, MCP, and Package Invocation Delivery Checklist

> **Story:** 5 of the [Remaining Delivery Epic](./remaining-delivery-epic.md)
>
> **Status:** In progress — fix the package-manager `.cmd` boundary and retain
> native terminal proof for Story 7.

**Goal:** Make CLI, MCP stdio, and the packed npm artifact usable from
PowerShell, `cmd`, and Git Bash.

**Architecture:** Native Node and Git calls stay on `execFile` with argument
arrays. Package-manager shims use a narrowly scoped runner: on Windows it
invokes the resolved `.cmd` command through `cmd.exe /d /s /c` with correctly
escaped arguments; elsewhere it remains `execFile`. Reuse the runner for the
package smoke and installer update check. Story 7 runs the packed artifact and
MCP smoke on the native Windows terminals.

## Tasks

- [ ] Baseline `pnpm test:package-bin` and inspect the `execFile("pnpm")` and
  `execFileSync("npm")` call sites.
- [ ] Add a focused, platform-aware package-manager runner with unit tests for
  native arguments and Windows `.cmd` quoting; keep Git/Node runners unchanged.
- [ ] Route packed-package smoke and installer update lookup through that
  runner.
- [ ] Add Windows-runner handoff covering packed install, CLI index/query, MCP
  stdio, and update lookup from PowerShell, `cmd`, and Git Bash.
- [ ] Run focused tests, `pnpm type-lint`, `pnpm check:version-bump`, and
  `git diff --check`; commit, push, review, and merge after CI.
