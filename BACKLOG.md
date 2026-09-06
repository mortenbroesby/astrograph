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

**Status:** Achieved

### Active work manifest

Update an entry whenever its work starts, pauses, resumes, or completes. Remove
it only after the branch is merged or otherwise remotely recoverable and its
worktree contains no unique files.

| Goal | State | Branch | Worktree | Base | Verification | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| Establish the P1 fast, observable, resumable workflow | Completed; eligible for retirement | `codex/complete-p1-workflow` | `.worktrees/complete-p1-workflow` | `origin/main` at `de001ee` | PR #139 merged; required CI and release passed; published `.236` runtime passed fresh-client hydration/search/profile proof | Merge this documentation-only closeout, then remove the worktree |
| Preserve retrieval-quality implementation | Preserved remotely; paused | `feat/retrieval-quality-roadmap` at `b9f21d4` | Worktree retired | Remote ref verified at `b9f21d4`; branch remains far behind `origin/main` | Parser and engine-contract tests passed (45 tests); MCP stdio test timed out at its legacy 15-second limit; worktree clean | Resume from the remote branch in a fresh worktree only when reprioritized |
| Reconcile publishable workflow benchmark | Preserved remotely; paused | `feat/publishable-workflow-benchmark` at `d072267` | Worktrees retired | Remote survivor includes the external-corpus cleanup and v2 `-- --strict` behavior; old v2 local branch remains at `6fa66a7` | Four benchmark files pass (14 tests); generated `.benchmarks/` output discarded; `.benchmarks/` now ignored | Resume from the remote survivor only when reprioritized |
| Preserve MCP runtime-hygiene work | Preserved remotely; superseded residue | `agent/mcp-runtime-hygiene` at `1d05beb` | Worktree retired | Remote ref verified; branch remains far behind `origin/main` | Exact mixed residue preserved as non-mergeable WIP: stale `npx @latest`, weakened policy, VS Code colors, and README conflict markers | Retain for forensic recovery only; do not merge |
| Preserve Copilot client timeout change | Superseded and closed | `origin/main` at `13c35d9` | Stash removed after remote-equivalence check | Current main uses one 32-second startup verification constant; removed stash only changed 2 seconds to 5 seconds | Remote source read back before the stash was dropped | No further action |
| Preserve legacy stashes | Preserved remotely; closed | Seven `preserve/stash-*-20260906` branches | No remaining stash or worktree | Each exact stash state, including untracked files, was committed, secret-scanned, pushed, and remote-SHA verified before removal | Recovery branches retain hydration, packed-WASM, launcher, Node-docs, Git-watch, housekeeping, and storage-config states | Resume only the specific preservation branch needed; do not merge wholesale |

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

OpenSpec change: `establish-p1-fast-resumable-workflow`

## P2

1. Make exact-version npm execution immune to package-workspace bin shadowing,
   or provide one canonical neutral-directory published-artifact verifier.
2. Add a supported command for changing global observability settings so users
   do not need to edit the global JSON file manually.
3. Make the local version-bump hook use the same path classification as CI and
   release planning so archiving an OpenSpec `.yaml` file does not falsely
   require a package version bump.
