# P1 session-flow performance evidence

Measured on Node.js `v22.23.1` from the `codex/resumable-workflow` candidate
based on `944a25a`. Each run used a fresh isolated daemon runtime and cleared
only this checkout's global index before calling status, hydrate, status,
symbol search, and diagnostics. The repository config used global storage,
file concurrency 4, and worker-pool concurrency 3.

| Metric | Before (median of 3) | After (median of 3) |
| --- | ---: | ---: |
| `index_folder` client duration | 52,289 ms | 21,350 ms |
| Profile total | 51,514 ms | 20,756 ms |
| Discovery | 147 ms | 104 ms |
| Analysis | 26,268 ms | 19,749 ms |
| Persistence | 25,188 ms | 819 ms |
| Finalization | 72 ms | 65 ms |

All six runs completed with zero failed or incomplete operations. After the
change, status retry took 286-309 ms, search took 508-566 ms, and diagnostics
took 271-332 ms. The cold hydration median improved by 59%. The fix registers
the checkout once per full index instead of running the four-command Git probe
for every indexed file; a focused regression test enforces that invariant.

The local, privacy-sanitized event log was
`/Users/macbook/.astrograph/cache/repos/41bc2544ed3cfb7d986807db611d6c1fcd6513172cde909783f87565f929fe80/events.jsonl`.
Raw bounded-run output remains generated local evidence under `.benchmarks/`,
which is intentionally ignored because it contains machine-specific paths.
