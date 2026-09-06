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

## Published Runtime Upgrade Observation

The first immutable `0.14.1-alpha.237` proof connected through the managed
Copilot CLI registration and completed four sequential calls without a timeout
or re-index. It used 35,750 model input tokens in 23,898 ms, but symbol search
and file outline still overflowed at 37,231 and 41,641 bytes. The installed
runtime had reused version-1 index records created before structural signatures,
so the release could still serve legacy full-body metadata.

The follow-up increments the existing persisted-storage compatibility marker to
version 2. Opening a version-1 cache now uses the established reversible archive
path before the upgraded runtime rebuilds and serves retrieval. Raw proof output
remains in temporary storage.

Installing that follow-up from two client environments exposed a second runtime
boundary: the descriptor selected Node 22 (ABI 127), while an ambient Node 24
package lifecycle rebuilt `better-sqlite3` for ABI 137. The final follow-up keeps
the active managed Node across upgrades and places its bin directory first on
`PATH` for every npm install and rebuild before runtime verification.

After storage-v2 hydration, the six-call recovery proof completed without a
timeout but `search_symbols` still overflowed at 33,966 bytes because the large
`MCP_TOOL_DEFINITIONS` constant retained its full array initializer. The final
parser boundary therefore excludes variable initializers as well as function
and class bodies, retains the exact source range, and advances persisted storage
compatibility to version 3.

## Immutable Runtime Closeout

Pull requests #141, #142, and #143 merged with exact-head required CI green.
The release workflow published and verified `astrograph@0.14.1-alpha.239`, and
both Copilot and Codex now select that immutable managed entrypoint. A Codex
upgrade launched under Node 24 retained the active Node 22 runtime; its
`better-sqlite3` dependency loaded successfully with ABI 127.

The fresh Copilot recovery session used `gpt-5.6-luna` and made the required six
sequential Astrograph calls. Storage v2 was rejected and rebuilt as v3 with 215
files and 1,754 symbols. All six calls succeeded without timeout or overflow in
75,176 ms wall time and 12,272 ms API time, using 55,241 input tokens. The
formerly overflowing exact symbol search returned 787 bytes, 97.7% below the
33,966-byte v2 result; the file outline returned 9,508 bytes.

The next fresh steady-state session made four sequential calls with zero
failures, timeouts, overflows, or code changes. It used 29,515 input tokens,
5,881 ms API time, and 20,722 ms wall time; its four tool results totaled 15,924
bytes. That input total is 44.4% below the 53,129-token historical baseline,
but Copilot auto-selected `mai-code-1.1-flash`, so the controlled three-run
candidate result above remains the attribution-quality comparison.

As a review agent, Copilot found the correct status and MCP implementation
areas. It also called the required one-time compatibility rebuild, intentional
1,200-token context truncation, and reported unresolved imports "inefficiency";
those are expected recovery, budgeting, and repository-health signals rather
than evidence for more Astrograph code. This bounded pass therefore stops here.
Raw prompts, logs, source-bearing output, and session identifiers remain only in
temporary storage.
