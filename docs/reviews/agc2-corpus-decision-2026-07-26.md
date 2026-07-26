# AGC2 Corpus Decision — 2026-07-26

## Decision

Reject AGC2 for production. Retain the existing AGC1 compact contract for
`search_symbols`, `get_file_tree`, and `get_file_outline`; use strict JSON for
all other tools and errors. No release, storage/cache version change, or npm
publication is authorized by this research epic.

## Gate results

The required gate is at least 15% weighted exact `cl100k_base` savings over
AGC1, with no representative regression and a 20-token/25%-versus-JSON
requirement for any auto-selected response.

| Candidate | Corpus result | Gate result |
| --- | --- | --- |
| Packed rows | 205 / 5,264 tokens saved (3.90%) across 16 captures; 5 non-wins | Fail |
| Schema rows | Regressed comparable captures | Fail |
| Prefix legend | 108 / 1,808 tokens saved (5.97%) across 5 eligible captures; small fixture tied | Fail |
| Typed rows | Regressed comparable captures | Fail |
| Generic homogeneous rows | Regressed comparable captures | Fail |
| Alias-symbol table | 455 / 1,497 tokens saved (30.39%) across 2 broad symbol captures; deliberately refused every other shape | Not a full replacement |

All candidates round-trip their declared shapes and reject malformed input in
the decoder matrix. Losslessness alone is insufficient: none proves the
required materially better token outcome on the complete representative corpus.
The alias-symbol result is preserved in its [focused research review](./agc2-alias-symbols-research-2026-07-26.md).

## Reproduction

```bash
pnpm bench:compact-output-matrix -- --json
pnpm bench:compact-output-matrix -- --fixture=product-monorepo --summary
```

The first command prints one normalized JSON/AGC1/candidate record per
fixture/query pair. The second form is useful when an interactive terminal
cannot display the complete report.
