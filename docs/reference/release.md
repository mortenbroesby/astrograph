# Release Reference

Astrograph uses GitHub Actions with npm trusted publishing.

This page is about how Astrograph decides whether something should publish, how
to dry-run that decision, and how the actual publish flow works.

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
`v*.*.*` tag.

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

Apply locally, updating `package.json` and version contract tests when a
release is needed:

```bash
pnpm release:apply
```

## Agentic Release Flow

1. Add the `release` label to a release-worthy pull request, then merge it to
   `main`.
2. The path-scoped `CI` workflow completes its required checks.
3. After a successful `main` CI run, the release agent automatically runs in
   apply mode only when the pushed commit is associated with that merged,
   labelled pull request. It does not run for direct pushes, unlabelled PRs,
   pull requests, or failed CI.
4. The release agent:
   - decides `none`, `increment`, `patch`, `minor`, or `major`
   - updates the alpha version only for publishable patch, minor, or major releases
   - commits the version change to `main` when needed
   - pushes `v<package.version>`
5. The tag push triggers `release.yml`, which publishes to npm.

The version-only release commit reruns CI, but its `Release <version>` commit
message is explicitly excluded from automatic release-agent runs. This prevents
a release loop even if CI observes the commit before its tag is visible.

The release agent performs no install, build, lint, or test steps. It relies on
the successful CI gate and only decides the release, commits the version, and
pushes its tag.

This is a permanent, opt-in GitHub Actions cost: at most one additional
`ubuntu-latest` job with a three-minute timeout per labelled, merged release
PR. The label and successful CI gate keep ordinary merges and direct pushes
from consuming release-runner minutes.

`workflow_dispatch` remains available for a non-mutating `release_mode=plan`
inspection or a guarded `release_mode=apply` retry on `main`.

## Manual Release Flow

1. Bump `package.json` using the alpha version policy.
2. Run `pnpm install --lockfile-only` if dependency metadata changed.
3. Verify:

```bash
pnpm build
pnpm type-lint
pnpm test
pnpm test:package-bin
```

4. Merge to `main`.
5. Create and push a tag matching the package version:

```bash
git tag v0.1.0-alpha.56
git push origin v0.1.0-alpha.56
```

The publish step uses `npm publish` because npm trusted publishing is
authenticated through npm CLI OIDC support. The rest of the workflow still uses
`pnpm` for install, build, and verification.

After publish, verify:

```bash
npm view astrograph dist-tags
npm view astrograph@latest version
```
