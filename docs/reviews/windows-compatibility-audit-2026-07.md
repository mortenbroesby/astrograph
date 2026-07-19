# Windows Compatibility Audit — July 2026

**Scope:** Story 2 of the Remaining Delivery Epic. This is an evidence and
handoff audit, not an implementation of Windows support.

**Baseline:** `package.json` requires Node `>=22.12.0`; the existing CI uses
only `ubuntu-latest`. `pnpm type-lint` and the focused filesystem-scan,
Git-checkout, path-matcher, and watch-backend suites passed locally. Those
results establish portable intent, not Windows-runner proof.

## Audit Results

| Boundary | Current evidence | Status | Handoff |
| --- | --- | --- | --- |
| Repository paths, scan roots, storage sidecars, and checkout mappings | `path.resolve`, `path.relative`, `path.normalize`, `realpath`, and Node `fs` APIs are used; path escape and separator fixtures exist. | Portable by construction, but not Windows-proven. | **Story 3:** add Windows fixtures/runner assertions for drive letters, spaces, canonical roots, case behavior, SQLite sidecars, and cleanup. Target `src/filesystem-scan.ts`, `src/checkout-mapping.ts`, `src/storage.ts`, and their tests. |
| Glob and watch-event normalization | Backslashes are normalized for glob matching and ignored watch segments; current tests use POSIX roots and a backslash matcher fixture. | Partially proved; Windows event delivery remains unproved. | **Story 6:** run create/edit/rename/delete through the real Windows backend. Target `src/watch-backend.ts`, `tests/watch-backend.test.ts`, and `tests/watch-boundary.test.ts`. |
| Git discovery and fallback | Git runs through `execFile("git", args, { shell: false, windowsHide: true })`, with bounded output and unavailable-Git fallback. | Portable by construction, not Windows-proven. | **Story 4:** run named branch, detached HEAD, linked worktree, Windows Git, Git Bash, missing Git, and non-Git scenarios on `windows-latest`. Target `src/git-checkout.ts` and `tests/git-checkout.test.ts`. |
| Runtime CLI/MCP launch | The package launcher uses `process.execPath` with argument arrays, not a shell wrapper. | Portable by construction, not Windows-proven. | **Story 5:** invoke the packed package from PowerShell, `cmd`, and Git Bash; include CLI index/query and MCP stdio. Target `src/astrograph.ts`, `src/mcp.ts`, and package smoke coverage. |
| Packed-package smoke command runner | `src/scripts/smoke-package-bin.ts` invokes `pnpm` through `execFile`. On Windows, `pnpm` normally resolves to a `.cmd` shim, which Node documents cannot be launched with `execFile` without an appropriate command wrapper. | **Concrete defect.** | **Story 5:** introduce a safe platform-aware package-manager runner, then add a `windows-latest` packed tarball smoke. Target `src/scripts/smoke-package-bin.ts` and a focused test or Windows CI assertion. [Node child-process documentation](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows) is the authoritative platform rule. |
| Test-runner command | `src/scripts/run-vitest.ts` explicitly enables a shell only on Windows for the `vitest` shim. | Deliberate portable handling; needs Windows CI proof. | **Story 7:** run the existing test command in the scoped Windows job; retain this behavior unless the runner disproves it. |
| Installer update check | `src/scripts/install.ts` invokes `npm view` through `execFile("npm", ...)`; an unavailable command is caught, so it does not block setup, but Windows `.cmd` behavior can suppress update notices. | Unproven, non-blocking risk. | **Story 5:** cover update-check execution from a Windows terminal or make the helper use the same safe package-manager runner. Target `src/scripts/install.ts` and `tests/engine-contract.test.ts`. |
| User reset instructions | The installer emits `rm -rf .astrograph`; CLI and troubleshooting docs show the same POSIX command and `/absolute/path/to/repo` examples. | **Concrete user-facing defect.** | **Story 7:** replace with terminal-specific, safe reset instructions and Windows path examples. Target `src/scripts/install.ts`, `docs/reference/cli.md`, `docs/guides/troubleshooting.md`, `README.md`, and install-contract tests. |
| Continuous platform proof | CI has one Ubuntu fast job; no Windows runner executes CLI, MCP, watch, or package smoke. | Missing proof, not evidence of a code defect. | **Story 7:** add a scoped `windows-latest` job after Stories 3–6 define the exact checks. Preserve path filters, cache, concurrency cancellation, and fast/optional split. |

## Findings

### 1. POSIX-only reset guidance blocks the stated Windows terminals

The update message and public recovery docs instruct users to run `rm -rf
.astrograph`. That command is not valid in `cmd.exe` or PowerShell. This is an
actual compatibility defect, independent of whether core indexing works.

**Required later proof:** Add PowerShell and `cmd` recovery commands, test the
installer text or structured output, and verify a reset/reindex sequence on a
Windows runner.

### 2. The packed-package smoke will not establish Windows support as written

The smoke script uses `execFile` for `pnpm pack`, `pnpm add`, and `pnpm exec`.
Node documents that Windows `.cmd` shims cannot be run through `execFile`
without a terminal/command wrapper. The current Linux smoke is valuable but
cannot be reused as Windows evidence until the runner is platform-safe.

**Required later proof:** Use a narrowly scoped, safely quoted Windows command
strategy only for the package-manager shim, retain argument arrays for native
Node/Git executables, and run the complete packed tarball smoke on
`windows-latest`.

## Non-findings and Future Considerations

- The core code does not currently depend on POSIX shell interpolation for
  indexing, Git checkout probing, or CLI/MCP launch. Do not rewrite those
  boundaries before a Windows runner exposes a specific failure.
- Git is correctly modeled as optional enrichment: a missing Git executable
  falls back to filesystem mode. Preserve that behavior.
- The audit does not claim case-insensitive or cross-volume path behavior is
  correct; it identifies those as Story 3 proof obligations.

## Story Handoff Order

1. **Story 3:** path, storage, and cleanup proof.
2. **Story 4:** Windows Git/Git Bash discovery and fallback proof.
3. **Story 5:** package-manager shim fix, packed CLI/MCP smoke, and installer
   update-check proof.
4. **Story 6:** native watch behavior and refresh correctness.
5. **Story 7:** scoped Windows CI plus terminal-specific documentation and the
   reset-guidance correction.

No remediation starts until the corresponding story expands this handoff into
file-level child tasks and acceptance evidence.
