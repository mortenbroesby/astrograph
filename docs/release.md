# Release

Astrograph uses GitHub Actions with npm trusted publishing.

## First-Time Setup

1. Configure npm trusted publishing for `mortenbroesby/astrograph`.
2. Point the npm package to the `release.yml` workflow and `npm` environment.
3. Protect the `npm` environment if manual approval is desired.
4. Confirm the package is public and publishes to the `latest` dist-tag.

## Release Decision Policy

Astrograph separates version bookkeeping from npm publishing:

- `increment` changes keep the alpha counter moving but do not publish.
- `patch` publishes compatible fixes or internal runtime changes.
- `minor` publishes backward-compatible features.
- `major` publishes breaking changes marked with `!` or `BREAKING CHANGE:`.

The release agent compares commits and changed files since the latest merged
`v*.*.*` tag. Docs, specs, agent rules, and GitHub workflow-only changes do not
publish. Runtime package changes under `src/`, publishable package scripts,
package metadata, or lockfile changes publish when the commit signals warrant it.

Plan locally without changing files:

```sh
pnpm release:plan
```

Apply locally, updating `package.json` and version contract tests when a release
is needed:

```sh
pnpm release:apply
```

## Agentic Release Flow

1. Merge release-worthy work to `main`.
2. Open the `CI` workflow in GitHub Actions and run `workflow_dispatch`.
3. Keep `release_mode` as `plan` to see the decision without side effects.
4. Rerun the same workflow on `main` with `release_mode=apply` when the plan is
   correct.
5. The workflow runs the fast and expensive gates first, then the release agent:
   - decides `none`, `increment`, `patch`, `minor`, or `major`;
   - updates the alpha version only for publishable patch/minor/major releases;
   - commits the version change to `main` when needed;
   - pushes `v<package.version>`.
6. The tag push triggers `release.yml`, which publishes to npm.

Apply mode is intentionally manual and restricted to `main` so regular CI pushes
do not spend release minutes or publish accidentally.

## Manual Release Flow

1. Bump `package.json` using the alpha version policy.
2. Run `pnpm install --lockfile-only` if dependency metadata changed.
3. Verify `pnpm build`, `pnpm type-lint`, `pnpm test`, and `pnpm test:package-bin`.
4. Merge to `main`.
5. Create and push a tag matching the package version, for example:

```sh
git tag v0.1.0-alpha.56
git push origin v0.1.0-alpha.56
```

The release workflow uses `npm publish` for the publish step because npm
trusted publishing is authenticated through npm CLI OIDC support. The rest of
the workflow still uses `pnpm` for install, build, and verification.

It publishes with npm provenance, public access, and the explicit `latest`
dist-tag. After publish, verify:

```sh
npm view astrograph dist-tags
npm view astrograph@latest version
```
