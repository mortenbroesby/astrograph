# Astrograph Backlog

This file is the source of truth for priority and execution order. Lower
numbers run first: P0 blocks P1, P1 blocks P2, and so on. Within a priority,
items are listed in execution order.

OpenSpec remains the source of truth for detailed behavioral requirements,
design, tasks, and completed-change history. Only selected backlog work gets an
active OpenSpec change; migrated `backlog-*` changes are reference material
until selected here.

## P0 - Trustworthy published runtime

**Status:** Achieved

Make the package we dogfood through Codex and Copilot the same package artifact
we verify and publish, and make it resolve reliably across repositories and Git
worktrees on this computer.

Execution order:

1. Adopt this lightweight planning model: `BACKLOG.md` owns priority, and one
   focused OpenSpec change owns the selected implementation.
2. Add an npm `snapshot` channel. CI must build one immutable package version,
   test the exact packed tarball, and publish that same tarball under the
   `snapshot` dist-tag. Local dogfooding installs from npm, not from a checkout
   or local tarball.
3. Keep production on the separate `latest` dist-tag. Production publication
   or promotion must verify that the package contents match the tested
   candidate.
4. Install a stable device-owned Astrograph launcher that does not change with
   the current directory, repository `.tool-versions`, worktree, shell `PATH`,
   or package-manager shim selection.
5. Configure Codex and Copilot independently where their formats differ, but
   make both launch the same selected device runtime and global cache.
6. Retain one shared daemon per immutable runtime version only if it passes the
   reliability proof. Per-client stdio bridges may be separate; live old and new
   versions must coexist without daemon contention, and each daemon must support
   multiple repositories and distinct worktree indexes.
7. Add bounded startup recovery and actionable diagnostics. A failed MCP start
   must be retryable or clearly require a client reload; it must not disappear
   silently for the lifetime of a long-running client.
8. Prove the installed snapshot end to end through both clients: discover all
   expected tools, inspect status, hydrate a missing index, search successfully,
   reuse the intended daemon, and keep repository/worktree data isolated.

Exit criteria:

- `astrograph@snapshot` installs and reports the exact immutable version tested
  before publication.
- Codex and Copilot resolve that same version from repositories using different
  Node/asdf selections and from multiple worktrees.
- Both clients expose the complete supported MCP tool catalog and complete the
  status -> hydrate -> search path.
- Concurrent repositories and worktrees neither replace one another's index nor
  trigger daemon version ping-pong.
- Restart, upgrade, stale-state, and failed-startup recovery are bounded and
  documented with commands that report the effective executable, package
  version, runtime location, daemon identity, and index identity.
- The production `latest` channel cannot receive an unverified package artifact.

OpenSpec change: `establish-p0-published-runtime`

## P1 - Fast, safe development feedback loop

**Status:** Next

Make the shortest trustworthy local verification path match required CI, reuse
the same packed artifact throughout a run, and keep slow or resource-sensitive
checks explicit instead of letting them distort ordinary feedback.

Execution order:

1. Define one authoritative fast local verification command that matches the
   required PR gate.
2. Separate fast deterministic checks from expensive package, reliability, and
   performance checks, while retaining exact-artifact coverage before publish.
3. Pack once and reuse the same tarball across local smoke, CI, and publication.
4. Remove or repair stale assertions and unchecked benchmark error paths that
   create false failures.
5. Keep worktree and generated-state hygiene automatic without pruning or
   mutating unrelated active worktrees.
6. Keep verification output concise and structured enough to identify the
   failing layer immediately.

Exit criteria:

- One documented command gives a fast, reproducible pre-push signal matching
  required CI.
- Expensive gates run only where their risk warrants them and report their
  actual elapsed time and resource assumptions.
- Package verification and publication consume one digest-identified artifact.
- Known stale tests and benchmark error handling no longer obscure real
  regressions.

OpenSpec change: create after `establish-p0-published-runtime` is archived.

## P2

To be prioritized after P1 is defined.
