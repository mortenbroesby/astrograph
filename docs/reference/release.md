# Release Reference

Astrograph uses GitHub Actions with npm trusted publishing.

This page is about how Astrograph decides whether something should publish, how
to dry-run that decision, and how the actual publish flow works.

## Supported Release Environments

Local development and package verification support Node 22 LTS or newer on
macOS, Linux, and Windows. On Windows, use PowerShell, `cmd.exe`, or Git Bash;
the packed-package smoke validates the published CLI and MCP entrypoints on a
native Windows runner. Git is optional for normal indexing and retrieval: when
Git is unavailable or a folder is not a checkout, Astrograph safely uses its
filesystem fallback. Release automation itself runs on GitHub-hosted Linux.

## Release Model

Astrograph separates version bookkeeping from npm publishing:

- `increment`
  Moves the alpha counter without publishing.
- `patch`
  Publishes compatible fixes or internal runtime changes.
- `minor`
  Publishes backward-compatible features.
- `major`
  Publishes breaking changes marked with `!` or `BREAKING CHANGE:`.

The release agent compares commits and changed files since the latest merged
`v*.*.*` tag. For publishable decisions it also compares its candidate with
`origin/main`, the matching Git tag, and npm's published version. A candidate
that is stale, duplicate, or unverified against npm is rejected before it can
commit or tag. A plan reports unavailable registry state without writing;
apply fails safely until that source is available.

Docs, specs, agent rules, and workflow-only changes do not publish. Runtime
package changes under `src/`, publishable package scripts, package metadata, or
lockfile changes publish when the commit signals warrant it.

## First-Time Setup

1. Configure npm trusted publishing for `mortenbroesby/astrograph`.
2. Point the npm package at the `ci.yml` workflow and `npm` environment.
3. Protect the `npm` environment if manual approval is desired.
4. Confirm the package is public and publishes to the `latest` dist-tag.

If a tag was created but its npm publication failed, correct the trusted
publisher binding first, then dispatch **CI** with that exact tag. Do not create
another tag or change the version: the retry checks out the immutable tagged
commit and republishes only that package version.

## Local Plan and Apply

Plan locally without changing files:

```bash
pnpm release:plan
```

Apply locally, updating `package.json` and version contract tests only after
the same `main` and npm conflict checks succeed:

```bash
pnpm release:apply
```

## Agentic Release Flow

1. A release-worthy pull request includes its valid package version bump before
   it is merged. Apply `no-release` only when a runtime-looking change must not
   publish; docs, specs, and workflow-only changes are naturally no-ops.
2. The path-scoped `CI` workflow completes Fast checks on the merge candidate.
3. After Fast succeeds on `main`, one release job evaluates the merged SHA,
   package version, matching tag, npm registry, and `no-release` exception.
4. When accepted, that same job pushes `v<package.version>` and publishes the
   checked-out merge candidate to npm with provenance. It never writes a
   version commit to `main`, creates a release PR, or starts another workflow.

The release decision performs no install, build, lint, or test steps. It relies
on the successful CI gate and only decides whether the already-versioned merge
may be tagged and published. npm's normal package lifecycle may still build the
tarball during `npm publish`.

This replaces the prior release-agent plus tag-publisher pair with one
post-Fast `ubuntu-latest` job for qualifying `main` merges. It adds no broad
trigger, runner, matrix, schedule, or hosted Windows usage.

`pnpm release:plan` remains the local, non-mutating inspection command. The
manual **CI** workflow is retry-only: dispatch it with an existing matching tag
after a failed npm publication; it checks out that tag and cannot create or
bump a version. It deliberately shares `ci.yml` with the automatic publisher,
because npm permits only one trusted-publisher workflow per package.

## Manual Release Flow

1. Run `pnpm release:plan` and inspect its `mainVersion`, registry state,
   candidate version, and transaction action.
2. For a release-worthy change, run `pnpm release:apply` before opening the
   owning pull request. It writes the declared coupled version updates that the
   pull request must carry into the merge.
3. Verify the normal CI gate before requesting review:

```bash
pnpm build
pnpm type-lint
pnpm test
pnpm test:package-bin
```

4. Merge the verified pull request. The guarded CI job tags and publishes that
   exact merge candidate; do not create a competing manual tag.

The merge publisher installs locked dependencies and runs `npm publish` with
provenance. It deliberately does not repeat build, lint, or test gates;
package lifecycle preparation remains npm's responsibility for the tarball.

The retry publisher accepts only a tag matching the checked-out package version
(`v<package.json version>`). New releases must therefore pass through a
guarded merge of the pull request that owns the version bump. A manual **CI**
dispatch is a retry only: select the existing matching tag when a prior
publication did not reach npm; it never creates or bumps a version.

After publish, verify:

```bash
npm view astrograph dist-tags
npm view astrograph@latest version
```
