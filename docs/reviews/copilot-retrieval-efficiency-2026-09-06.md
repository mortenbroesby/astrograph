# Copilot Retrieval Efficiency Review — 2026-09-06

## Outcome

A bounded four-call Copilot CLI trace against the packed candidate used 23.6%
fewer model input tokens than the installed-runtime baseline. Three candidate
runs completed with zero Astrograph failures, daemon timeouts, re-indexes, or
Copilot tool-output overflows.

| Measure | Installed baseline | Packed candidate |
| --- | ---: | ---: |
| Model input tokens | 53,129 | 40,609 median (40,575–40,609) |
| Copilot API time | 12,930 ms | 13,013 ms median |
| Wall time | 22,419 ms | 26,713 ms median (25,866–27,251) |
| Astrograph calls | 4 | 4 per run |
| Astrograph failures/timeouts | 0 / 0 | 0 / 0 across 3 runs |
| Tool-output overflows | 1 | 0 across 3 runs |

Wall time increased 19.2% while model API time remained within 0.7%; the
candidate proof therefore establishes response and token efficiency, not a
wall-clock speedup.

## What Was Inefficient

- A cold unconstrained Copilot run issued 38 same-repository calls in 181.6
  seconds. Parallel bursts queued behind the repository safety boundary and
  caused 11 ordinary request timeouts.
- Parser signatures included complete implementation bodies and then repeated
  them as fallback summaries. A single `src/mcp.ts` outline exceeded Copilot's
  35 KB inline-result limit.
- Routine project status spent 9.5 KB describing every supported language and
  tool. The candidate reduced the result from 10,829 to 1,238 bytes (88.6%) by
  making that matrix opt-in.
- Broad symbol discovery and large task-context budgets were chosen without
  refinement. Candidate instructions produced bounded calls, and a subsequent
  Luna-style review showed that limit 10 could still overflow. Final guidance
  starts with exact or file-scoped limit 5 searches, 1,200 context tokens, and
  one or two exact source symbols.
- Copilot occasionally supplied an 8–15 character session identifier or a
  malformed optional known-content hash. Rejecting those cache hints caused
  avoidable retries before retrieval reached the daemon.
- A disposable package installed under Node 22 and launched under Node 24
  reproduced a native SQLite ABI mismatch. Those invalid runs were discarded;
  all reported candidate evidence used a Node-24-installed packed artifact.

## Result Sizes

- `get_project_status`: 10,829 to 1,238 bytes (88.6% smaller).
- `search_symbols` for two exact results: 4,758 to 790 bytes (83.4% smaller).
- `get_file_outline` for `src/mcp.ts`: over 35 KB to 10,911 bytes, with no
  overflow (at least 69% smaller).
- `get_task_context` at 1,200 tokens: 4,398 to 3,859 bytes (12.3% smaller).

## Boundaries

The pass keeps the shared daemon, per-repository safety queue, 14-tool surface,
exact source ranges, output validation, and explicit larger retrieval requests.
Raw prompts, source-bearing outputs, logs, temporary paths, and session
identifiers remain outside the repository.

## Copilot Reviewer Observation

A separate bounded Copilot review used Astrograph as its only repository tool.
It correctly reported no blocking regression, but consumed 112,903 input tokens
across eight calls, repeated five symbol searches, overflowed one broad result,
and cited a neighboring hash helper instead of the parser implementation. This
direct observation caused the final limit-5, exact/file-scoped, one-or-two-source
guidance above; the review itself is not counted in the four-call benchmark.
