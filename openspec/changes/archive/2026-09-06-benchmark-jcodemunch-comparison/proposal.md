## Why

Astrograph and jCodeMunch make similar token-efficiency claims, but their existing numbers use different repositories, workflows, and accounting. A pinned local setup and neutral protocol are needed to compare retrieval quality, payload tokens, latency, and agent input tokens on the same Astrograph commit.

## What Changes

- Install an exact jCodeMunch release in a device-owned `uv` tool environment and register its resolved binary globally with Codex alongside Astrograph.
- Configure the Astrograph test checkout for local, deterministic jCodeMunch indexing without remote summaries or shared telemetry, then verify both MCP servers through fresh client sessions.
- Reuse the existing benchmark corpus, exact `cl100k_base` accounting, and report conventions for matched cold and warm comparison runs.
- Record tool-schema cost, equivalent retrieval payloads, task success, tool calls, latency, model input tokens, versions, repository commit, and raw-evidence locations without accepting either product's self-reported savings as the cross-product authority.
- Publish concise setup, reproduction, interpretation, and uninstall guidance in the benchmark documentation after the test-branch evidence is reviewed.
- Do not add jCodeMunch as an Astrograph dependency, change Astrograph runtime behavior, add CI, publish a release, enable paid/remote summarization, or advertise a winner from an unmatched run.

## Capabilities

### New Capabilities

None. This change adds local comparison tooling and documentation; it does not change Astrograph's product contract.

### Modified Capabilities

None.

## Impact

- Repository: benchmark scripts or task data only if the existing runner cannot express both servers; benchmark guide, review evidence, and OpenSpec artifacts.
- Local system: one pinned jCodeMunch `uv` tool install, one global Codex MCP registration, and jCodeMunch's local index/config storage.
- External systems: PyPI/GitHub are read for the pinned package and source metadata; no provider API, paid service, production system, or repository secret is required.
