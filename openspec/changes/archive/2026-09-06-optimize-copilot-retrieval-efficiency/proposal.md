## Why

A real Astrograph-only Copilot CLI trial spent 181 seconds on 38 calls, including 11 same-repository daemon timeouts, while a bounded sequential trial still consumed 53,129 model input tokens for four calls and overflowed a 35.4 KB file outline. Astrograph should reduce day-to-day development context instead of causing retries or returning function bodies as structural metadata.

## What Changes

- Make indexed symbol signatures structural declarations rather than normalized full symbol bodies while preserving full source retrieval by byte range.
- Make ordinary MCP JSON responses compact on the wire without changing their parsed v1 envelope.
- Tell MCP clients and generated Copilot/Codex guidance to sequence requests for one repository so the existing per-repository daemon safety queue does not turn parallel bursts into timeouts.
- Guide clients to begin with small search/context bounds, make routine MCP project status omit the verbose support matrix, and tolerate imperfect optional content-reference cache hints.
- Invalidate persisted indexes when a release changes their stored symbol representation so an upgraded runtime cannot keep serving legacy full-body signatures.
- Keep npm install and native rebuild subprocesses on the managed Node selected for the device, including when Codex and Copilot launch setup from different Node environments.
- Recover a structurally managed Codex runtime block when another config writer drops or moves Astrograph's comment markers, without requiring a destructive reset.
- Add a repeatable, privacy-safe Copilot CLI trial that records usage, latency, failures, and response size without retaining source text or raw prompts in the repository.
- Keep the 14-tool surface, shared daemon, result validation, source provenance, and explicit token budgets unchanged.

## Capabilities

### New Capabilities

- `agent-retrieval-efficiency`: Bounded, measurable agent-facing response size and same-repository request behavior for Copilot and Codex.

### Modified Capabilities

- `development-feedback-loop`: Extend bounded performance evidence to real client usage and response-size measurements.
- `device-runtime`: Prevent avoidable same-repository parallel bursts from exhausting ordinary daemon request deadlines.
- `repository-index-hydration`: Stop treating a fully indexed but dependency-degraded repository as if repeating hydration could repair it.

## Impact

The change affects parser signature extraction, persisted-index compatibility, MCP JSON serialization, MCP initialization and generated agent guidance, focused parser/MCP/installer tests, and performance documentation. It adds no dependency, removes no tool, does not change source byte ranges, and does not replace the daemon.
