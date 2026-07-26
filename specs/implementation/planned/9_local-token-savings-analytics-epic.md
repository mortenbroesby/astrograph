# Local Token-Savings Analytics Epic

> **Status:** Active — selected by the user on 2026-07-26.

**Goal:** Let a user inspect the token savings Astrograph can prove locally,
across all local repositories by default for global storage or for the current
repository by default for repository-local storage, with negligible effect on
ordinary tool latency and a stable JSON shape that a future explicit exporter
may consume.

**Architecture:** Reuse the existing repository-local event sink and
`astrograph report` command. Record only already-known response
metadata; do not tokenize, serialize, write, or call the network additionally
on a tool request. The report aggregates exact savings when the serving path
already supplies them and labels other values as unavailable rather than
estimating them. No account, endpoint, SDK, daemon, background upload, or
export configuration is part of this epic.

**Default scope:** `report --repo /abs/repo` always reports that
repository. Without `--repo`, repository-local storage reports the resolved
current repository; global storage aggregates every registered local repository
with retained Astrograph data. This is automatic scope selection, not a new
flag, profile, or tracking configuration.

**Tech Stack:** TypeScript, Node.js 22, the existing event sink, CLI, local
storage, `cl100k_base` metrics already used by serving paths, and Vitest.

## Story map

| Order | Story | Outcome | Gate |
| --- | --- | --- | --- |
| 1 | Audit current local report | Map which existing events can prove savings without new hot-path work. | Baseline command and focused event tests. |
| 2 | Exact local savings aggregate | Extend the JSON report only for exact, source-free savings fields already available at response formatting. | No added tokenization or synchronous I/O per request. |
| 3 | Stable handoff boundary | Version and document the report so a later user-selected exporter can read it. | No transport implementation or tracking configuration. |

## Boundaries

- Local only; no network request, telemetry SDK, account, identifier, or
  background collector.
- No source, path, prompt, raw query, session ID, symbol name, or response body
  in the report or retained analytics event data.
- Do not add a second event log or database; reuse the existing local event
  sink.
- Do not scan arbitrary directories: global aggregation reads only existing
  Astrograph repository storage records.
- Do not calculate new token counts on normal tool requests. If a serving path
  does not already know an exact saving, report it as unavailable.
- A later exporter requires a separate user decision and contract review.

## Acceptance evidence

- `astrograph report` is local and machine-readable: it defaults to
  all registered local repositories under global storage and the current
  repository under repository-local storage; `--repo` narrows it explicitly.
- Its schema distinguishes exact savings, unavailable values, and
  reference/full response counts without leaking excluded fields.
- Focused tests prove no network API is imported or invoked, and benchmark or
  timing evidence shows no new per-request tokenization or persistence work.
- The report schema is documented as an offline handoff format, not an active
  telemetry service.

**Delivery:** See the [active checklist](../active/6_local-token-savings-analytics-delivery-checklist.md).
