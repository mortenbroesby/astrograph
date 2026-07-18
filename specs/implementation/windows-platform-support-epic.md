# Windows Platform Support Epic

> **Status:** Planned — do not begin until an implementation story is expanded
> into a checked delivery plan.

**Goal:** Make Astrograph reliably usable on supported Windows systems from a
standard Node.js terminal and Git Bash, with equivalent indexing, refresh,
Git-enrichment fallback, CLI, MCP, storage, and package behavior.

**Architecture:** Keep platform behavior behind Node's filesystem, path, and
child-process APIs. Treat paths as normalized data rather than shell fragments;
use argument-array child processes with `shell: false`. Git remains optional:
Git Bash may enrich checkout diagnostics, but neither Git nor Bash is required
for ordinary local indexing.

**Tech Stack:** TypeScript, Node 24, SQLite, Vitest, GitHub Actions Windows
runners, and the published npm package smoke test.

---

## Supported Environments

| Environment | Required behavior |
| --- | --- |
| Windows Node.js terminal (`cmd.exe` or PowerShell) | Install, index, refresh, query, watch, and run MCP stdio without POSIX shell syntax. |
| Git Bash on Windows | The same Node commands work; optional Git discovery handles Windows Git safely. |
| Windows without Git | Indexing and refresh succeed in filesystem fallback mode with a non-fatal Git diagnostic. |

## Scope and Non-Goals

This epic covers Windows path handling, SQLite storage paths and lifecycle,
child-process Git probing, package/CLI/MCP invocation, watch refresh, CI proof,
and documentation. It does not add WSL-specific behavior, invoke shell scripts
from the engine, mutate Git state, support unsupported Node versions, or make
Git a prerequisite for indexing.

## Story Map

| Order | Story | Depends on | Outcome |
| --- | --- | --- | --- |
| 1 | Windows Compatibility Audit | None | OS-sensitive paths, filesystem calls, subprocesses, and shell assumptions are catalogued with target tests. |
| 2 | Filesystem and Storage Portability | Story 1 | Canonical roots, storage sidecars, SQLite paths, and cleanup work on Windows. |
| 3 | Git Discovery and Fallback | Stories 1–2 | Git Bash/Windows Git uses safe arguments and missing-Git fallback stays non-fatal. |
| 4 | CLI, MCP, and Package Invocation | Stories 1–3 | CLI and stdio MCP work from supported terminals and the packed npm artifact. |
| 5 | Watch and Refresh Reliability | Stories 2–4 | File changes, renames, and safe fallback refresh work on Windows. |
| 6 | Windows CI, Documentation, and Release Gate | Stories 2–5 | Windows evidence is required before a release that claims support. |

## Story 1: Windows Compatibility Audit

**Goal:** Turn platform assumptions into explicit, testable requirements before
behavior changes.

- [ ] Inventory each OS-sensitive path operation, filesystem traversal, SQLite
  call, child process, environment variable, and command example.
- [ ] Identify POSIX-only separators, shell interpolation, executable-name, and
  case-sensitivity assumptions.
- [ ] Record target files and a focused fixture or Windows-runner assertion for
  every finding.

## Story 2: Filesystem and Storage Portability

**Goal:** Preserve canonical repository identity and `.astrograph` storage
lifecycle across Windows paths.

- [ ] Normalize and compare absolute/canonical paths without assuming `/`.
- [ ] Verify nested roots, spaces, drive letters, and case behavior in fixtures
  or Windows CI.
- [ ] Verify SQLite, metadata, integrity, and cleanup use Node path APIs and
  never rely on shell deletion.

## Story 3: Git Discovery and Fallback

**Goal:** Support Windows Git and Git Bash enrichment while retaining safe
filesystem-only indexing.

- [ ] Execute Git with `execFile`/argument arrays, bounded output, and
  `shell: false`; never interpolate paths into commands.
- [ ] Normalize Git root output before comparison with Node-resolved paths.
- [ ] Prove named branch, detached HEAD, linked worktree, unavailable Git, and
  non-Git fallback on a Windows runner.

## Story 4: CLI, MCP, and Package Invocation

**Goal:** Make user-facing entry points work from Windows Node terminals and
Git Bash.

- [ ] Run built CLI commands through the package bin from PowerShell or `cmd`.
- [ ] Run MCP over stdio without POSIX shell wrappers or signal assumptions.
- [ ] Install and smoke-test the packed npm tarball on Windows.

## Story 5: Watch and Refresh Reliability

**Goal:** Keep incremental refresh correct after Windows filesystem events.

- [ ] Test create, edit, rename, and delete through the supported watch backend.
- [ ] Confirm debouncing and error diagnostics preserve freshness guarantees.
- [ ] Verify a failed watch or Git probe falls back safely to ordinary refresh.

## Story 6: Windows CI, Documentation, and Release Gate

**Goal:** Make Windows support continuously verifiable and visible to users.

- [ ] Add a scoped Windows CI job without broadening triggers or weakening fast
  checks; read the GitHub Actions cost policy before editing workflows.
- [ ] Run platform tests, type checks, and packed-package smoke tests on a
  Windows runner.
- [ ] Document supported terminals, Git-optional fallback, and prerequisites in
  user-facing setup and release documentation.
- [ ] Require green Windows CI for the exact merged `main` commit before the
  guarded release workflow for a release that claims Windows support.

## Definition of Done

- [ ] Core indexing and refresh are proven on Windows without Git.
- [ ] Git Bash and Windows Git enrich checkout state without controlling cache
  identity or blocking indexing.
- [ ] CLI, MCP, watch, and packed npm package smoke tests pass on Windows.
- [ ] Windows CI is scoped, green, and documented before a Windows-support
  release is published.
