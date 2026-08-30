# GitHub Actions Cost Policy

## Current Cost Risks

- The old CI workflow ran build, type checking, the full normal test suite, slow
  tests, and package smoke on every pull request.
- The slow test lane can run for several minutes and was not separated from
  required PR checks.
- Package smoke performs a build/package-style validation and is valuable, but
  it is more expensive than the required feedback loop for every PR update.
- Workflows had no PR concurrency cancellation, so repeated pushes could keep
  obsolete runs alive.
- Workflow triggers had no path filters, so documentation-only PRs could consume
  runner minutes.

## New Workflow Shape

- `CI / Fast required checks`
  - runs on PRs and protected branch pushes that touch source, tests, scripts,
    package metadata, TypeScript config, or workflow files
  - runs build, type lint, normal tests, and PR version policy
  - uses `ubuntu-latest`, pnpm cache, and PR concurrency cancellation

- `CI / Expensive optional checks`
  - runs slow tests and package smoke
  - runs on `main`, `release/*`, `workflow_dispatch`, or PRs labelled
    `run-expensive-ci`
  - remains GitHub-hosted for now but is isolated so it can move to
    `self-hosted` later without changing required PR checks

- `Release / Publish to npm`
  - runs only on version tags or manual dispatch
  - keeps package verification before publish
  - uses `ubuntu-latest`, pnpm cache, and concurrency cancellation

## Trade-Offs

- Documentation-only PRs no longer run CI automatically. Reviewers should inspect
  Markdown diffs and can use `workflow_dispatch` if a docs change affects
  package behavior.
- Slow tests and package smoke are no longer required on every PR update. They
  still run on `main`, release branches, manual dispatch, and labelled PRs.
- No larger GitHub-hosted runners or matrix expansions were added.

## Reviewer Checklist

- [ ] Workflow triggers are scoped by branch and path.
- [ ] PR workflows cancel obsolete runs.
- [ ] Required PR checks remain fast enough for normal iteration.
- [ ] Expensive checks are separate from required checks.
- [ ] Expensive checks are limited to `main`, `release/*`, manual dispatch, or
      labelled PRs.
- [ ] No larger GitHub-hosted runner labels are used.
- [ ] Dependency caches remain configured.
- [ ] Any cost increase includes `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true` and a
      written estimate of added runner minutes.
