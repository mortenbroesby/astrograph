## Context

See `proposal.md` for motivation. The measured cold Copilot trial issued 38 Astrograph calls in 181 seconds; six-call parallel bursts against one repository produced 11 ordinary 10-second request timeouts. A warm sequential four-call trial finished in 22 seconds but consumed 53,129 model input tokens. Its 35.4 KB `get_file_outline` overflowed Copilot's inline tool-result limit, and `search_symbols` returned complete function bodies duplicated as signatures and fallback summaries.

The per-repository queue in `src/daemon-tenants.ts` is an intentional storage-safety boundary, and `openspec/specs/device-runtime/spec.md` deliberately keeps ordinary retrieval deadlines shorter than hydration deadlines.

## Goals / Non-Goals

**Goals:**

- Reduce structural response size at the shared parser boundary.
- Remove presentation whitespace from MCP JSON without changing parsed data.
- Prevent Copilot's normal parallel tool behavior from fighting the per-repository queue.
- Compare the same bounded client scenario before and after the packaged change.

**Non-Goals:**

- Do not remove tools, add a router, change token budgets, weaken validation, or capture source-bearing telemetry.
- Do not replace the daemon or make SQLite concurrency assumptions in this pass.
- Do not change symbol byte ranges or the exact-source retrieval contract.

## Decisions

1. **Derive signatures from the declaration before the syntax-tree body or variable initializer.** `src/parser/tree-sitter.ts` will keep the original range for provenance and source retrieval but build `signature` from the declaration prefix when a direct declaration body or initializer exists. This fixes every search and outline caller once. Truncating responses later was rejected because it would hide valid structure and leave ranking polluted by implementation bodies.

2. **Minify the ordinary MCP JSON representation.** `src/compact-mcp.ts` will use semantic JSON rather than pretty-printed JSON. The parsed v1 envelope remains identical, so callers and validators need no version negotiation. Extending `agc1` to carry content references was rejected because it would introduce a new compatibility surface before the simpler lossless saving is measured.

3. **Document same-repository sequencing and health-aware hydration at both runtime and generated-policy boundaries.** `src/mcp.ts` will advertise concise server instructions, and `src/scripts/install.ts` will generate the same durable rules for clients that ignore MCP initialization instructions. A deep-ready index degraded only by unresolved imports remains useful for discovery and source retrieval, so guidance follows `retrievalHealth.safeOperations` and `recommendedAction` instead of blindly re-indexing. Relaxing `src/daemon-tenants.ts` was rejected because its safety invariant spans indexing, refresh, watcher, and cached connection state.

4. **Keep raw trials ephemeral.** Copilot JSONL, debug logs, and usage files remain under a temporary directory. `docs/reviews/` receives only aggregate counts and conclusions; `docs/guides/performance.md` receives the reproducible bounded command pattern without raw prompts or identifiers.

5. **Guide clients to small initial retrieval bounds instead of silently capping valid requests.** `search_symbols` starts with an exact or file-scoped query at limit 5, `get_task_context` at 1,200 payload tokens, and `get_symbol_source` with one or two ids in tool, server, and generated-policy guidance. Hard server caps were rejected because callers may deliberately need larger responses after refinement.

6. **Treat content-reference identifiers as optional cache hints.** Accept eight-character-or-longer session identifiers and discard malformed known-content identifiers after enforcing the existing count and byte limits. Failing the retrieval was rejected because a client-generated cache hint must not make source access unavailable.

7. **Keep routine MCP status focused on readiness.** Omit the 9.5 KB language support matrix unless `includeSupportTiers` is explicitly true. Changing the engine result was rejected because the CLI and library retain the complete diagnostic contract.

8. **Version persisted parser semantics with the existing storage compatibility marker.** Increment the storage version when structural signatures replace legacy full-body and full-initializer signatures. The existing reversible obsolete-storage path archives the prior cache and creates a clean index, so every caller receives the new representation after a runtime upgrade. Leaving the marker unchanged was rejected after published-runtime proofs reused old records and overflowed otherwise bounded Copilot calls.

9. **Pin package lifecycle commands to the managed Node.** Reuse the active descriptor's real Node path during upgrades and prepend its bin directory to npm subprocess `PATH`. This keeps package install scripts and native rebuilds on the same ABI as runtime verification even when setup is launched from a client using another Node version. Keying one package directory to whichever Node happens to invoke setup was rejected after `better-sqlite3` was rebuilt for ABI 137 while the descriptor selected ABI 127.

10. **Recognize managed Codex registrations structurally, not only by comments.** When the Astrograph command and entrypoint select an immutable version under the managed runtime root, setup may restore missing or displaced comment markers and replace that block without `--reset`, while preserving unrelated MCP configuration. Treating every markerless block as user-owned remains the default for npx, local, or otherwise unrecognized commands.

Focused verification links:

- Structural signature requirement: parser regression plus search/outline/source assertions in `tests/parser.golden.test.ts` or the narrowest existing parser boundary.
- JSON compatibility requirement: `tests/compact-mcp.test.ts` parsed equality plus serialized-whitespace assertion.
- Sequencing requirement: MCP initialize assertion in `tests/interface.test.ts` and generated policy assertions in `tests/engine-contract.test.ts`.
- Health-aware hydration requirement: generated policy assertions plus a real deep-ready/degraded candidate status that does not trigger repeated indexing.
- Client evidence requirement: three equivalent packaged-runtime Copilot runs summarized in a privacy-safe review; `pnpm verify:fast`, `pnpm check:version-bump --base origin/main`, and strict OpenSpec validation.
- Upgrade compatibility requirement: a storage-version regression proves prior cache records are archived before the upgraded runtime serves retrieval.

## Risks / Trade-offs

- [Some languages expose bodies through nonstandard syntax-tree fields] -> Apply declaration-prefix extraction only when a direct body node is present and retain current behavior otherwise; cover representative TypeScript, Python, and class/method cases.
- [Implementation-text symbol searches may return fewer results] -> This is intentional separation: `search_symbols` searches symbol metadata, while `search_text` remains the body-text fallback. Validate existing retrieval benchmarks before delivery.
- [Some clients ignore MCP server instructions] -> Mirror the sequencing rule in generated agent policy.
- [An index can be stale for either content drift or degraded dependency health] -> Tell the agent to use readiness, safe operations, and recommended action rather than interpreting the word `stale` alone.
- [Minified JSON is less pleasant for humans reading raw MCP frames] -> CLI commands remain the human-readable surface; parsed MCP compatibility is unchanged.
- [A storage-version bump causes a one-time rebuild] -> Reuse the existing reversible archive flow; the rebuild cost is preferable to silently serving incompatible persisted semantics.
- [The previously selected Node may be removed] -> Fail verification with the existing actionable repair path rather than silently switching ABI underneath another configured client.

## Migration Plan

Ship through the existing package workflow, run the same Copilot scenario against the installed immutable artifact, then merge and publish only after exact-head CI and real-client evidence pass. The upgraded runtime archives pre-version-3 indexes and rebuilds them as version 3. Rollback selects the previous immutable device runtime; archived prior indexes remain recoverable through the existing cache receipt.
