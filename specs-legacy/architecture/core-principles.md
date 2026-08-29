# Core Principles

Astrograph is local code intelligence for agents. These principles govern
architecture, API design, and implementation plans.

## 1. Source-Backed Retrieval First

Discovery can be fuzzy, but final answers must be grounded in exact files,
symbols, and source spans.

## 2. Local-First Runtime State

Astrograph stores runtime state under `.astrograph/` in the target repo. Runtime
state is disposable and inspectable; source control remains the durable truth.

## 3. Deterministic Contracts

CLI, MCP, and library surfaces should produce stable, bounded, machine-readable
results that are easy for agents to verify.

## 4. Freshness Is Explicit

Fresh, stale, unknown, discovery-ready, deepening, and deep-retrieval-ready are
observable states. Astrograph should report state honestly instead of hiding
drift.

## 5. Privacy-Safe Diagnostics

Retained events are local, bounded, and redacted by default. Diagnostics should
surface risk without persisting unnecessary source text.

## 6. Small Refactor Slices

Large files may be split, but each split must preserve behavior, keep public
exports stable, and ship with focused verification.

## 7. Agentic Workflows Need Written Plans

Complex changes require specs or implementation plans with exact verification
commands before code is changed.
