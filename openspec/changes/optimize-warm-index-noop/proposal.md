## Why

Astrograph's matched jCodeMunch benchmark spends about 5.4 seconds on a warm no-op index, versus about 0.46 seconds for jCodeMunch. A direct Astrograph profile attributes 6,398 of 6,537 milliseconds to the no-op analysis phase because every already-discovered file repeats a synchronous Git ignore check.

## What Changes

- Remove redundant per-file Git ignore subprocess checks after folder discovery or focused refresh has already validated the path.
- Preserve repository-boundary, symlink, language, ignore, size, edit, delete, and checkout freshness behavior.
- Re-run equivalent three-sample index and jCodeMunch comparisons and record the measured result.
- Non-goals: cold-parser optimization, daemon redesign, a new cache or dependency, relaxed freshness checks, and broader retrieval or schema changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is an implementation optimization under the existing `development-feedback-loop` measurement contract and does not change the `index_folder` result contract.

## Impact

- `src/storage.ts` no-op and focused-refresh validation path.
- Focused indexing/freshness tests and performance evidence.
- No public API, persisted schema, dependency, or default configuration change.
