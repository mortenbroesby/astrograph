# Release Reference

Astrograph uses GitHub Actions with npm trusted publishing.

This page is about how Astrograph decides whether something should publish, how
to dry-run that decision, and how the actual publish flow works.

## Supported Release Environments

The published package supports Node 20.19+, 22, and 24. Local contributor
builds require Node 22.18+ or 24.11+ because tsdown does not support Node 20.
The manual **Node package compatibility** workflow builds under Node 22, then
tests the packed artifact under Node 20 or 24; it adds no automatic Actions
usage. Git is optional for normal indexing and retrieval: when Git is
unavailable or a folder is not a checkout, Astrograph safely uses its
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
publisher binding first, then dispatch **CI** with `mode=retry` and that exact
tag. Do not create another tag or change the version: the retry checks out the
immutable tagged commit, rebuilds one tarball, verifies it, and publishes that
same file only when the version is still absent from npm.

```bash
gh workflow run ci.yml --ref <tag> -f mode=retry -f tag=<tag>
```

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
4. When accepted, that job stages the exact version, builds once, packs once,
   records SHA-256 metadata, and runs the package/MCP smoke against that file.
5. Only after the smoke passes does the job push `v<package.version>`, publish
   the same tarball under `latest`, download it from npm, and compare its digest.

The release decision itself only decides whether the already-versioned merge
may be tagged and published. The release job owns the exact artifact proof; npm
does not rebuild from the checkout during publication.

This replaces the prior release-agent plus tag-publisher pair with one
post-Fast `ubuntu-latest` job for qualifying `main` merges. It adds no broad
trigger, runner, matrix, schedule, or hosted Windows usage.

`pnpm release:plan` remains the local, non-mutating inspection command. Manual
**CI** dispatch supports `mode=retry` for an existing tag and `mode=snapshot`
for registry-based dogfooding. Both deliberately share `ci.yml` with the
automatic publisher because npm permits only one trusted-publisher workflow per
package.

## Snapshot Dogfooding

Dispatch one snapshot from the branch or tag containing the exact commit:

```bash
gh workflow run ci.yml --ref <branch-or-tag> -f mode=snapshot
```

The dispatch-only Ubuntu job is serialized and capped at 20 minutes. It derives
an immutable version such as
`0.13.0-alpha.225.snapshot.<run>.g<sha>`, builds and packs once in an isolated
staging directory, then smokes and publishes that same tarball under
`snapshot`. It records the selected commit, immutable version, and SHA-256 in
the run summary. The job also verifies that `latest` did not move and that the
tarball downloaded from npm has the recorded digest.

`snapshot` is for device dogfooding; `latest` remains the separately guarded
production channel. Never promote a snapshot by moving `latest` to it.

Inspect the published channels and immutable snapshot:

```bash
npm view astrograph dist-tags
version="$(npm view astrograph@snapshot version)"
npm view "astrograph@$version" version dist.tarball
```

For a local no-publish rehearsal, use a unique numeric run id and the exact
commit SHA, then pass the emitted tarball path and version to the same smoke
script used by CI:

```bash
pnpm release:artifact --output-dir /tmp/astrograph-snapshot --run-id 12345 --sha <commit-sha>
node --import=tsx ./src/scripts/smoke-package-bin.ts --prebuilt --tarball <tarball-path> --expected-version <snapshot-version>
```

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

The merge publisher installs locked dependencies, creates one versioned
artifact, smokes it, and passes its exact path to `npm publish` with provenance.
The registry download must match the recorded SHA-256 before the job is green.

The retry publisher accepts only a tag matching the checked-out package version
(`v<package.json version>`). New releases must therefore pass through a
guarded merge of the pull request that owns the version bump. A manual retry
selects `mode=retry` and the existing matching tag when a prior publication did
not reach npm; it never creates or bumps a version.

After publish, verify:

```bash
npm view astrograph dist-tags
npm view astrograph@latest version
```

## Rollback

- Bad snapshot: do not delete a published version or touch `latest`. Dispatch
  `mode=snapshot` from the last known-good commit; its new immutable version
  becomes the `snapshot` target. Devices pinned to an older immutable version
  remain unchanged.
- Failed production publication after the tag exists: fix the trusted
  publisher, then dispatch `mode=retry` with that tag. The retry fails closed if
  npm already contains the version.
- Bad production release: ship a reviewed patch through the normal `main`
  release path. Do not unpublish or manually move `latest` backward.
