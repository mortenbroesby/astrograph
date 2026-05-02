# Performance Checklist

## Baseline

- Measure before optimizing when possible.
- Prefer targeted fixes over speculative tuning.
- Keep shared interfaces small to avoid unnecessary rendering or coupling cost.

## Frontend checks

- Verify layouts remain stable across common states and breakpoints.
- Avoid introducing unnecessary re-renders, oversized bundles, or duplicated
  abstractions.
- For user-facing changes, pair code review with browser verification when
  performance claims are made.

## Workflow checks

- Keep diffs incremental so regressions are easier to isolate.
- Prefer workspace-scoped verification before broad repo-wide runs.

## Red flags

- Performance claims without measurement or runtime evidence
- Broad refactors justified only by assumed speed wins
- Heavy new dependencies with no explicit benefit
