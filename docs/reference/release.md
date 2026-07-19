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
2. Point the npm package at the `release.yml` workflow and `npm` environment.
3. Protect the `npm` environment if manual approval is desired.
4. Confirm the package is public and publishes to the `latest` dist-tag.

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

1. Add the `release` label to a release-worthy pull request, then merge it to
   `main`.
2. The path-scoped `CI` workflow completes its required fast and Windows checks.
3. After a successful `main` CI run, the release agent automatically runs in
   apply mode only when the pushed commit is associated with that merged,
   labelled pull request. It does not run for direct pushes, unlabelled PRs,
   pull requests, or failed CI.
4. The release agent:
   - decides `none`, `increment`, `patch`, `minor`, or `major`
   - updates the alpha version only for publishable patch, minor, or major releases
   - commits the version change to `main` when needed
   - pushes `v<package.version>`
5. The release agent pushes the matching tag, then explicitly dispatches the
   existing `Release` workflow at that tag. This explicit dispatch is required
   because tags created by the default Actions token do not start a second
   workflow through the normal push trigger. `Release` publishes to npm.

The version-only release commit reruns CI, but its `Release <version>` commit
message is explicitly excluded from automatic release-agent runs. This prevents
a release loop even if CI observes the commit before its tag is visible.

The release agent performs no install, build, lint, or test steps. It relies on
the successful CI gate and only decides the release, commits the version, and
pushes its tag.

This is a permanent, opt-in GitHub Actions cost: one existing
`ubuntu-latest` release-agent job with a three-minute timeout and one existing
tag-publisher invocation per labelled, merged release PR. It adds no runner or
broad trigger; it waits for the existing fast and Windows gates, then dispatches
the pre-existing Release workflow. The label and successful gates keep ordinary
merges and direct pushes from consuming release-runner minutes.

`workflow_dispatch` remains available for a non-mutating `release_mode=plan`
inspection or a guarded `release_mode=apply` retry on `main`. Both modes first
run the same fast and Windows jobs as a merged `main` change; the three-minute
release agent runs only after those gates succeed and performs no install,
build, lint, or test work itself.

## Manual Release Flow

1. Run `pnpm release:plan` and inspect its `mainVersion`, registry state,
   candidate version, and transaction action.
2. Run `pnpm release:apply` only from an up-to-date `main` checkout. It either
   writes the declared coupled version updates or accepts an already-valid
   candidate without a second increment.
3. Verify the normal CI gate:

```bash
pnpm build
pnpm type-lint
pnpm test
pnpm test:package-bin
```

4. Let the guarded CI release agent commit and tag the accepted candidate. Do
   not create a competing manual tag.

The tag publish workflow installs locked dependencies and runs `npm publish`
with provenance. It deliberately does not repeat build, lint, or test gates;
package lifecycle preparation remains npm's responsibility for the tarball.

After publish, verify:

```bash
npm view astrograph dist-tags
npm view astrograph@latest version
```
