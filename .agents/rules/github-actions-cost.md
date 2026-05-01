# GitHub Actions Cost Guardrail

Use this rule whenever reviewing or editing `.github/workflows/**`.

## Default Policy

Keep GitHub-hosted runner usage inside the free Actions allowance. Prefer fast
required checks and move expensive checks to manual dispatch, protected branches,
release branches, labelled PRs, or self-hosted runners when available.

## Block Or Warn On

Do not approve or implement workflow changes that materially increase Actions
minutes unless the task or PR explicitly says:

```text
ALLOW_GITHUB_ACTIONS_COST_INCREASE=true
```

Warn or block changes that:

- add new workflows
- add or broaden `on: push`, `on: schedule`, or wide `pull_request` triggers
- remove `paths` or `paths-ignore` filters
- remove `concurrency.cancel-in-progress`
- add large matrix expansions
- add larger GitHub-hosted runners such as `ubuntu-latest-4-cores`, `ubuntu-latest-8-cores`, `ubuntu-latest-16-cores`, `ubuntu-latest-32-cores`, `windows-latest`, or `macos-latest`
- replace `self-hosted` runners with GitHub-hosted runners for expensive jobs
- add long-running scheduled jobs
- add paid third-party CI or action services
- increase expected Actions minutes materially

## Required Bypass Explanation

When `ALLOW_GITHUB_ACTIONS_COST_INCREASE=true` is present, explain:

- why the cost increase is necessary
- which workflows and jobs are affected
- estimated additional runner minutes
- whether the increase is temporary or permanent

## Reviewer Checklist

- [ ] PR and push triggers are branch- and path-scoped.
- [ ] PR workflows use `concurrency.cancel-in-progress: true`.
- [ ] Fast required checks are separate from expensive optional checks.
- [ ] Expensive checks run only on `main`, `release/*`, manual dispatch, or labelled PRs.
- [ ] No larger GitHub-hosted runners are introduced.
- [ ] No broad scheduled jobs are introduced.
- [ ] Dependency caches are preserved.
- [ ] Any cost increase has the explicit bypass token and required explanation.
