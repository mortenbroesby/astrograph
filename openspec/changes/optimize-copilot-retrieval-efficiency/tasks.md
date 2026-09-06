## 1. Baseline and contracts

- [x] 1.1 Run a cold, Astrograph-only Copilot CLI exploration and record aggregate elapsed time, calls, failures, response sizes, and daemon profile evidence outside the repository
- [x] 1.2 Run a warm sequential Copilot CLI exploration with client usage output and record the oversized structural responses and model-token baseline outside the repository
- [x] 1.3 Add focused failing tests for declaration-only signatures, minified semantically identical MCP JSON, and same-repository sequential guidance; verify the selected tests fail for the intended reasons

## 2. Minimal implementation

- [x] 2.1 Extract structural signatures without implementation bodies while preserving source byte ranges; verify focused parser, retrieval, and source tests pass
- [x] 2.2 Remove presentation whitespace from ordinary MCP JSON; verify compact-MCP and interface tests pass without parsed-envelope changes
- [x] 2.3 Advertise same-repository sequential calls through MCP initialization and generated client policy; verify interface and installer contract tests pass
- [x] 2.4 Make generated and MCP guidance distinguish missing indexes from deep-ready dependency degradation; verify a focused policy test rejects unconditional stale-index hydration
- [x] 2.5 Guide Copilot to start exact/file-scoped symbol search at limit 5, task context at 1,200 payload tokens, and exact source with one or two symbols; verify tool, MCP, and generated-policy descriptions preserve larger explicit requests
- [x] 2.6 Accept Copilot-sized session identifiers and ignore malformed optional content-reference hints within existing resource limits; verify retrieval still executes
- [x] 2.7 Omit verbose support matrices from routine MCP project status unless explicitly requested; verify the CLI/library contract remains complete
- [x] 2.8 Increment persisted-index compatibility after the signature semantic change; verify an old cache is archived and cannot serve legacy full-body signatures after upgrade

## 3. Real-client proof and delivery

- [x] 3.1 Run three equivalent bounded Copilot trials against the candidate packaged runtime and record privacy-safe aggregate before/after evidence in `docs/reviews/`; verify zero same-repository queue timeouts and lower structural response/model input totals
- [x] 3.2 Update the performance guide with the bounded Copilot trial method and explicit ephemeral-artifact rules; verify no prompt, source, raw log, or session identifier is committed
- [x] 3.3 Run relevant retrieval benchmarks, `pnpm verify:fast`, `pnpm check:version-bump --base origin/main`, and `openspec validate optimize-copilot-retrieval-efficiency --strict`; fix or explicitly report every failure
- [x] 3.4 Use Copilot as a bounded Luna-style review agent that relies on Astrograph; assess both its engineering findings and its tool-call efficiency before integration
- [ ] 3.5 Apply the release decision, commit and push the branch, verify exact-head CI, and prove the selected immutable device runtime rebuilds incompatible persisted indexes through a fresh Copilot CLI session before marking the backlog entry complete
