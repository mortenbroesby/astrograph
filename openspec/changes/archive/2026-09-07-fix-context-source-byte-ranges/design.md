## Context

See `proposal.md` for motivation. Parser-backed symbol ranges are persisted as
UTF-8 byte offsets. `get_symbol_source` reconstructs line-based context and
reports byte provenance, while task-context and context-bundle assembly directly
pass persisted byte offsets to JavaScript string `slice`, whose indexes are
UTF-16 code units. Several retrieval call sites repeat that unsafe operation.

## Goals / Non-Goals

**Goals:**

- Give all exact-range assembly call sites one UTF-8-aware extraction rule.
- Preserve line endings and ensure provenance and token counts describe the
  returned source.
- Prove the same behavior through task-context and context-bundle public paths.

**Non-Goals:**

- Change parser range production, stored schema, public response shape, ranking,
  relationship inference, or context-budget policy.
- Add a general text abstraction or dependency.

## Decisions

### Decode byte ranges at the shared retrieval boundary

Add one small internal helper in `src/retrieval.ts` that slices a UTF-8 buffer
using the persisted byte offsets and decodes the selected bytes. Route every
exact persisted-range call site in context and task assembly through it.

This reuses Node's `Buffer`; changing stored offsets to UTF-16 would make the
parser/storage contract ambiguous, while per-call conversions would duplicate
the bug surface.

### Keep contextual exact-source behavior separate

Retain `buildSymbolSourceItem`'s line-context behavior, but use the shared exact
range result when no surrounding context is requested. This preserves its
public `contextLines` contract while aligning the zero-context source with the
same indexed byte range used elsewhere.

### Verify public paths with one focused fixture

Extend `tests/engine-behavior.test.ts` with a fixture containing multibyte text,
emoji, CRLF, and same-line declarations. Assert returned source and provenance
for `getSymbolSource`, `getContextBundle`, and `getTaskContext`. Run:

- `pnpm exec vitest run tests/engine-behavior.test.ts -t "UTF-8"`
- `pnpm build`
- `pnpm type-lint`
- `pnpm check:version-bump --base origin/main`
- `pnpm exec openspec validate fix-context-source-byte-ranges --strict`

Compatibility-sensitive files are `src/retrieval.ts`,
`tests/engine-behavior.test.ts`, and the existing
`agent-retrieval-efficiency` contract.

## Risks / Trade-offs

- **Risk:** Byte boundaries from a corrupt or legacy index split a UTF-8 code point.
  **Mitigation:** Keep index-version invalidation authoritative and exercise the
  real parser/index path in the regression fixture rather than fabricating rows.
- **Risk:** Line-context reconstruction and exact-range extraction diverge.
  **Mitigation:** Assert zero-context equality and keep surrounding-line behavior
  unchanged.

## Migration Plan

No data migration is required. Ship as a patch-class behavior correction. If a
regression appears, revert the helper/call-site change; existing indexes remain
readable because their byte-range contract is unchanged.
