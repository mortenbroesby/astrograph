# Tokenizer and Token-Estimator Research — 2026-07-22

## Decision Status

**Research in progress.** Retain the current local split until the measured
comparison in Task 2 proves a material benefit:

- exact payload budgets: `tiktoken` `1.0.22`, `cl100k_base`
- approximate benchmark/observability sidecar: `tokenx` `1.3.0`

This record deliberately does not make a dependency or public-contract change.
The declared `get_task_context.payloadTokenBudget` remains enforced with the
exact tokenizer, not an estimate.

## Reproducible Baseline

The implementation is in `src/tokenizer.ts`; `countTokens()` caches the
`cl100k_base` encoder from `tiktoken`, while `estimateTokens()` delegates to
`tokenx`. `bench/src/tokenizer.ts` re-exports those functions. Exact counts
drive task-context payload budgets and benchmark `retrievedTokens`; estimates
are labelled separately in benchmark reports and tool observability.

The installed manifest pins compatible semver ranges `tiktoken ^1.0.22` and
`tokenx ^1.3.0`. On 2026-07-22, the following metadata was captured with:

```sh
npm view <package>@<version> version license engines dependencies dist.unpackedSize time --json
```

| Package/version | Role | Algorithm/runtime | License | Dependencies | npm unpacked size | Latest selected publish | Node/native risk |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| `tiktoken@1.0.22` | current exact | OpenAI-compatible BPE via WASM | MIT | 0 | 23,587,949 B | 2025-08-09 | Node is supported; WASM is the only runtime-specific component. |
| `tokenx@1.3.0` | current estimate | local heuristic | MIT | 0 | 17,028 B | 2026-01-22 | Pure TypeScript/JavaScript; no native binary. |
| `gpt-tokenizer@3.4.0` | exact candidate | TypeScript OpenAI BPE; must import `cl100k_base` for an apples-to-apples test | MIT | 0 | 53,103,516 B | 2025-11-07 | Pure TypeScript/JavaScript; its merge cache must be bounded or disabled for a fair memory test. |
| `js-tiktoken@1.0.21` | exact candidate | pure-JS port of tiktoken BPE | MIT | `base64-js` | 22,432,828 B | 2025-08-09 | No WASM/native binary; one transitive dependency. |

Primary package documentation confirms that `tiktoken` is a Node-supported
WASM tokenizer and offers `js-tiktoken` for pure-JS runtimes
([tiktoken](https://www.npmjs.com/package/tiktoken),
[js-tiktoken](https://www.npmjs.com/package/js-tiktoken)). `gpt-tokenizer`
documents model/encoding-specific imports and its default `o200k_base`, so the
evaluation must explicitly use `cl100k_base`
([gpt-tokenizer](https://www.npmjs.com/package/gpt-tokenizer)). `tokenx`
documents itself as an approximate, lightweight estimator—not a budget
authority ([tokenx](https://www.npmjs.com/package/tokenx)).

## Candidate Boundary

Evaluate only these two exact-tokenizer candidates:

1. `gpt-tokenizer@3.4.0`: a maintained pure-TypeScript OpenAI BPE option that
   may improve warm counting latency but has a larger published package.
2. `js-tiktoken@1.0.21`: a maintained pure-JS fallback with matching encoding
   lineage, useful for determining whether removing WASM materially improves
   Astrograph's Node workflow.

Do not add an estimator candidate in Task 2 unless the current `tokenx`
measurements show a material accuracy or latency gap. It is already zero-
dependency, tiny, recently published, and explicitly non-exact.

The user-suggested name **Tokenator** is excluded: the npm package
`@babbage/tokenator@1.0.2` is a Bitcoin SV text-token/transfer library under
the Open BSV License, not an LLM tokenizer. It has no role in Astrograph token
counting ([Tokenator](https://www.npmjs.com/package/%40babbage/tokenator)).

## Locked Task-Context Corpus

Task 2 must add a checked-in corpus and run every exact candidate against the
same strings. It must contain:

1. A representative serialized `get_task_context` JSON result with selected
   items, UTF-8 byte provenance, exclusions, and token accounting.
2. Empty result and strict error-envelope JSON.
3. Provenance-heavy JSON with several symbols, ranges, hashes, and relation
   reasons.
4. Source snippets containing CRLF, astral Unicode, CJK, combining marks,
   emoji, escaping, and code punctuation.
5. A large repeated source snippet plus a large diverse snippet, to separate
   warm-cache behavior from worst-case memory and latency.

For every corpus case, record `tiktoken cl100k_base` as the current authority,
candidate exact count agreement, `tokenx` signed/absolute percentage error,
warm median and p95 counting latency, and process memory delta. Run at least
three deterministic repetitions after each candidate's initialization.

## Decision Gate

Replace the exact tokenizer only when a candidate agrees exactly for every
corpus case and shows a material, repeatable operational benefit that outweighs
its package and memory cost. Retain `tokenx` unless a candidate estimator
improves the measured error distribution or warm latency materially without
adding meaningful package or maintenance risk. This is a pre-v1 decision: a
selected replacement must be direct, without a compatibility adapter.

## Task 2 Measurement — 2026-07-22

Run the checked-in benchmark with:

```sh
pnpm bench:tokenizer-research -- --iterations 100
CI=1 pnpm exec vitest run bench/tests/tokenizer.test.ts bench/tests/tokenizer-research.test.ts
```

The benchmark runs each candidate in a fresh Node process, warms it once, then
counts all seven corpus cases 100 times. The table records the median of three
fresh-process runs. RSS deltas are process-local, post-warm samples; package
unpacked size is therefore the more reliable install-footprint comparison.

| Candidate | Exact agreement with `tiktoken cl100k_base` | Warm median / p95 for whole corpus | Median RSS delta | Package cost | Result |
| --- | --- | --- | ---: | ---: | --- |
| `tiktoken@1.0.22` | reference | 22.75 / 23.80 ms | 7.45 MB | 23.59 MB | retain exact authority |
| `gpt-tokenizer@3.4.0` (`cl100k_base`) | 7/7 exact | 8.52 / 9.77 ms | 7.57 MB | 53.10 MB | reject replacement |
| `js-tiktoken@1.0.21` (`cl100k_base`) | 7/7 exact | 23.76 / 31.83 ms | 114.62 MB | 22.43 MB + `base64-js` | reject replacement |
| `tokenx@1.3.0` | estimator, not exact | 4.87 / 5.59 ms | 14.06 MB | 0.017 MB | retain labelled estimator only |

`tokenx` had 17.75% mean absolute percentage error across the seven cases and
41.18% worst-case error (the error envelope); its weighted signed error was
-7.83%. It therefore remains unsuitable for enforcing a task-context budget.

### Decision

**Retain `tiktoken` for exact token budgeting and retain `tokenx` only as the
explicitly approximate benchmark/observability sidecar.** Although
`gpt-tokenizer` is about 2.7× faster for this deliberately large corpus, it
adds about 29.5 MB of unpacked package content. The measured retrieval workflow
spends substantially more time indexing and selecting source than counting a
single serialized payload, so that speed difference is not a material
user-facing benefit at the current boundary. `js-tiktoken` has neither a speed
nor memory advantage. No runtime dependency or token-budget contract changes
are selected.
