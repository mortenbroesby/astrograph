# Windows Watch and Refresh Reliability Delivery Checklist

> Migrated from [the legacy planned tracker](../../../specs-legacy/implementation/planned/3_5_windows-watch-refresh-delivery-checklist.md). The checkbox state below is authoritative going forward.
> References below to `pointer.md` or `specs/` are historical; update this OpenSpec change instead and keep `specs-legacy/` read-only.

## Preserved Plan

> **Story:** 6 of the Remaining Delivery Epic
>
> **Status:** Deferred.

**Goal:** Preserve correct indexing and freshness after Windows create, edit,
rename, delete, and failed-probe events.

## Tasks

- [ ] Run the focused backend and boundary suites.
- [ ] Add host-independent backslash and ignored-sidecar event fixtures.
- [ ] Verify debounce emits one refresh for a burst and retains fresh diagnostics.
- [ ] Record Story 7's native Windows command: `pnpm exec vitest run
  tests/watch-backend.test.ts tests/watch-boundary.test.ts`.
- [ ] Run type lint, version policy, commit, push, review, and CI-gated merge.
