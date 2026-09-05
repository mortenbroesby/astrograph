## Context

See `proposal.md` for motivation. Today global registration writes an `npx`
command, so npm can resolve against the current repository and then fall
through to runtime-manager shims. A failed long-lived MCP launch also remains
absent until the client reloads its catalog. The release workflow publishes
from the working directory after earlier package smoke coverage rather than
passing one immutable tarball from verification to publication.

The implementation spans compatibility-sensitive installer output, daemon
ownership, npm trusted publishing, and both supported client configuration
formats. It must stay within the manual/scoped GitHub Actions cost policy and
must not disturb existing user indexes during migration.

## Goals / Non-Goals

**Goals:**

- Make priority cheap to maintain while keeping selected behavior rigorously
  specified.
- Make every client launch resolve one known registry-published version from a
  stable device-owned location.
- Make the package bytes checked by each publication path be the bytes npm
  receives.
- Prove simultaneous multi-repository and multi-worktree use before retaining
  the daemon as the default efficiency layer.
- Preserve an immediately usable previous runtime during updates and recovery.

**Non-Goals:**

- Bundle or auto-update Node itself in this change. The installer captures and
  validates an absolute Node executable and can repair the selection later.
- Make Codex and Copilot share a stdio stream or client configuration file.
- Automatically promote an already published snapshot version to `latest`.
  npm trusted publishing authenticates `npm publish`, while dist-tag mutation
  has a different credential boundary; production will instead use the same
  pack-once pipeline on a reviewed main commit.
- Add a background updater, network service, or scheduled GitHub workflow.

## Decisions

### 1. `BACKLOG.md` owns priority; OpenSpec starts at selection

`BACKLOG.md` contains the ordered P0/P1/P2 view, selection state, and exit
criteria. `AGENTS.md` will direct agents there before `openspec list`.
OpenSpec remains the contract for selected non-trivial work and the durable
archive. Migrated `backlog-*` changes remain reference material but do not set
priority merely by existing.

This avoids maintaining the same ordering in many OpenSpec folders. The
alternative—one OpenSpec change for every idea—creates ceremony before scope
is known and obscures the small number of truly active priorities.

Repository changes also default to isolated linked worktrees. The existing
`.skills/using-git-worktrees/SKILL.md` remains the procedural source; the
always-on rule in `AGENTS.md` and `.agents/rules/worktrees.md` makes isolation
the default instead of an optional routing choice. `.worktrees/` is ignored and
used automatically unless repository instructions require another location.
The laptop-wide Codex and Copilot instruction files carry the same default so
repositories without their own policy remain isolated.

The always-on `.agents/rules/task-lifecycle.md` defines readiness before work
and evidence-backed completion afterward. It keeps an individual OpenSpec
checkbox local to its stated behavior and verification, while reserving
"delivered" for committed, pushed, exact-head-verified work with target-system
readback for external mutations. This prevents local intent or a narrow test
from being presented as the completed P0 outcome.

### 2. Both npm channels use a pack-once artifact pipeline

The existing `.github/workflows/ci.yml` will be extended rather than adding a
second broad workflow. Snapshot publication is an explicit manual mode with no
schedule or matrix. In an isolated staging directory it assigns a unique
SemVer prerelease such as
`0.12.2-alpha.224.snapshot.<run>.g<sha>`, builds once, packs once, and records the
tarball SHA-256. Retaining the release-line alpha components keeps runtime
diagnostics compatible while the extra identifiers keep snapshots immutable
and ordered before the next production alpha. `src/scripts/smoke-package-bin.ts`
will accept an existing tarball and will not pack when one is supplied. The
workflow then publishes that exact path with
`npm publish <file> --tag snapshot --provenance`.

The production release path will likewise transfer one verified tarball and
digest to its publish job and publish the file rather than the directory. It
keeps the existing main-only version decision, tag, environment, and trusted
publishing controls. Snapshot publication never changes `latest`; production
publication never depends on a developer credential.

A snapshot has its own immutable prerelease version because npm versions
cannot be overwritten. Repacking separately after tests was rejected because
even deterministic source cannot prove that npm received the tested bytes.
Using local tarballs for normal dogfooding was rejected because it bypasses the
registry resolution and provenance path under test.

### 3. A managed runtime descriptor replaces `npx` and shell resolution

The global installer in `src/scripts/install.ts` will install the selected npm
specifier into a versioned device directory under Astrograph's existing global
storage boundary. It records a small runtime descriptor containing:

- the registry-resolved immutable Astrograph version;
- an absolute `process.execPath` selected and verified during installation;
- the absolute installed `dist/astrograph.js` entrypoint; and
- the package channel and installation timestamp needed for diagnostics.

Codex TOML and Copilot JSON will each invoke that absolute Node path with the
absolute entrypoint and `mcp` argument. Activation writes configuration only
after an installed-package version check and MCP initialization/tool-list
probe succeed. Config writes use the existing atomic-write behavior; the
previous versioned runtime remains available for rollback.

A shell wrapper, global npm bin, `npx`, and asdf shim were rejected because
their effective runtime changes with `PATH`, cwd, or `.tool-versions`. Bundling
Node was deferred because absolute runtime capture is much smaller and solves
the observed failure; `doctor` will identify a missing captured executable and
offer a repair command.

### 4. Client adapters are separate but select one runtime

The installer retains native client adapters for `~/.codex/config.toml` and
Copilot's MCP JSON. Repository-local Astrograph client registrations are
removed from Astrograph's own checkout so they cannot shadow the device
selection. Both adapters are generated from the same runtime descriptor, and
each client starts its own stdio bridge.

`src/scripts/install.ts`, `src/doctor.ts`, and their tests will treat effective
command, arguments, selected version, and client scope as a compatibility
boundary. A dry-run preview remains available before configuration mutation.

### 5. Canonical worktree roots are independent daemon tenants

The stdio bridge continues to infer a canonical project root per client
session. The daemon may share process and caches, but its tenant key is the
canonical worktree root, not the Git common directory or repository remote.
Tests will exercise two worktrees of one repository plus another repository
through concurrent Codex- and Copilot-shaped bridges and assert distinct index
metadata.

Keeping the daemon initially is the smallest path because current evidence
points to package selection and client reload, not daemon tenancy, as the
primary absence cause. If the concurrency/recovery suite still attributes
repeated failures to shared ownership, the stdio bridge contract permits a
direct-process replacement without changing client registration.

### 6. Startup recovery is single-owner and bounded

`src/daemon-client.ts`, `src/daemon-runtime.ts`, and `src/daemon-server.ts` will
implement one lock-coordinated handoff when the selected package version does
not match the running daemon. Other bridges wait for that attempt instead of
starting competing restarts. One retry and a documented deadline bound MCP
startup.

Failure output and `doctor --json` will include the client adapter, configured
and effective paths and versions, daemon record, project/worktree identity,
and index health. Astrograph cannot force an already running Codex or Copilot
process to rediscover a failed MCP server, so diagnostics explicitly identify
when a client catalog reload is the remaining step rather than claiming an
automatic repair.

## Risks / Trade-offs

- **Captured Node is moved or removed** -> Activation verifies the absolute
  executable; `doctor` reports it precisely and reinstall repairs the runtime
  while retaining the prior descriptor.
- **Snapshot versions accumulate** -> Keep publication manual and document an
  npm retention review after the workflow is proven; do not add automated
  deletion in P0.
- **Workflow cost grows** -> Reuse `ci.yml`, keep snapshot dispatch-only and
  single-platform, avoid scheduled/matrix work, and reuse the packed artifact
  between verification and publication. Automatic PR/push cost is unchanged;
  each explicit snapshot adds one Ubuntu job capped at 20 minutes.
- **Two clients race during upgrade** -> Versioned installation plus atomic
  descriptor activation and one daemon handoff owner keep the prior runtime
  usable until the new one passes its probe.
- **Canonical paths change through symlinks** -> Resolve real paths at the
  tenant boundary and cover aliases in `tests/daemon-tenants.test.ts`.
- **Client reload remains externally controlled** -> Make it the sole explicit
  final diagnostic only after the registered command succeeds independently.

## Migration Plan

1. Land `BACKLOG.md`, the repository-workflow delta, and implementation tasks.
2. Add tarball-input smoke coverage and the manual snapshot mode without
   changing the current production publish behavior; validate the workflow
   syntax and cost guardrail.
3. Change production to publish its verified tarball, then dry-run the release
   decision with `pnpm release:plan`.
4. Add the versioned device runtime and absolute client registrations with
   unit, package, and concurrent worktree tests.
5. Publish one snapshot through trusted CI, install `astrograph@snapshot` on
   this computer, and verify the registry version and tarball digest.
6. Activate Codex and Copilot registrations, reload each client when required,
   and run status, hydration, and search in multiple repositories/worktrees.
7. Keep the daemon if the reliability suite passes. Otherwise replace its
   shared ownership behind the unchanged bridge contract and rerun the suite.
8. Roll back by atomically restoring the previous runtime descriptor and
   client configs; never delete existing indexes as part of rollback.

Compatibility-sensitive files include `.github/workflows/ci.yml`,
`package.json`, `src/scripts/smoke-package-bin.ts`, `src/scripts/install.ts`,
`src/doctor.ts`, `src/daemon-client.ts`, `src/daemon-runtime.ts`,
`src/daemon-server.ts`, and their focused tests. Required verification includes
`pnpm build`, `pnpm type-lint`, `pnpm test:package-bin:prebuilt`,
focused installer/release/daemon tests, `openspec validate
establish-p0-published-runtime --strict`, and live npm plus Codex/Copilot MCP
readback for the published snapshot.
