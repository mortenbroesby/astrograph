# Release

Astrograph uses GitHub Actions with npm trusted publishing.

## First-Time Setup

1. Configure npm trusted publishing for `mortenbroesby/astrograph`.
2. Point the npm package to the `release.yml` workflow and `npm` environment.
3. Protect the `npm` environment if manual approval is desired.

## Release Flow

1. Bump `package.json` using the alpha version policy.
2. Run `pnpm install --lockfile-only` if dependency metadata changed.
3. Verify `pnpm build`, `pnpm type-lint`, `pnpm test`, and `pnpm test:package-bin`.
4. Merge to `main`.
5. Create and push a tag matching the package version, for example:

```sh
git tag v0.1.0-alpha.56
git push origin v0.1.0-alpha.56
```

The release workflow publishes with npm provenance and public access.
