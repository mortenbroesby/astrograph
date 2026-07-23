# Current Codex Goal

This tracked file is the single entry point for a bare `/goal` request in the
Astrograph repository. Read it before choosing work; do not revive a closed or
deferred story merely because it appears earlier in repository history.
For the full active/ready/parked/descoped/idea/done map, read the
[Delivery Roadmap](./specs/implementation/roadmap.md).

## Current goal

Execute the active [Package-Confidence CI Cost Review
Checklist](./specs/implementation/active/4_npm-module-package-confidence-cost-review-checklist.md),
starting with the successful merged-main Fast CI and package-smoke baseline.

## Required outcome

Decide whether one package-confidence story can be selected without materially
increasing GitHub-hosted Actions minutes. Produce a bounded evidence record;
do not add a dependency or change a workflow until the cost gate is explicit.

## Hard boundaries

- Do not edit `.github/workflows/**`, add `publint` or
  `@arethetypeswrong/cli`, publish a package, or change package metadata in
  this evidence-gathering checklist.
- Preserve scoped triggers, dependency caching, PR concurrency cancellation,
  the fast-required versus expensive-optional split, and the disabled hosted
  Windows boundary.
- Do not treat a local package command as authorization to increase hosted
  runner minutes. Any material cost increase requires the explicit policy
  bypass and its documented estimate.

## Completion and update rule

When the selected checklist completes, update this file in the same change to
name the next selected checklist. If no next story passes its selection gate,
point to the evidence-gathering checklist rather than guessing.
