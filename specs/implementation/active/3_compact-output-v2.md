# Compact Output v2 Implementation Plan

**Goal:** Expand Astrograph's measured compact MCP output with an original,
lossless `agc2` table representation for repetitive discovery results.

**Architecture:** Keep the strict MCP v1 JSON envelope as the default. Replace
`agc1` with one `agc2` decoder and per-tool compact mappings only where real
Astrograph fixtures prove a material exact-token saving. Bump storage and cache
markers to v2: only a valid known v1 marker is archived and rebuilt
automatically; missing, malformed, and future markers are preserved and fail
with explicit recovery guidance.

**Tech Stack:** TypeScript, Node 22+, `tiktoken`, Vitest, and the existing MCP
envelope benchmark.

---

## Task 1: Specify and baseline

- [x] Capture real `find_files` and `search_text` envelopes in the stable
  fixture, including success, empty, and strict error paths.
- [x] Record bytes, exact `cl100k_base` tokens, encode/decode latency, and
  round-trip equivalence for each proposed `agc2` mapping. Success results
  measured 72/149 tokens saved (48.3%) for `find_files` and 74/154 (48.1%)
  for `search_text`; empty results remain below the auto gate.
- [x] Do not implement a mapping that fails the existing `20 tokens + 25%`
  auto-selection gate.

## Task 2: Implement the breaking v2 boundary

- [x] Replace `agc1` with one `agc2` encoder/decoder for every selected tool.
- [x] Preserve JSON default, strict error JSON, Unicode, empty results, and
  reference-decoder round trips.
- [x] Bump storage/cache markers to v2 and archive/rebuild only caches with a
  valid known v1 marker.
- [x] Preserve missing, malformed, and future markers; report explicit
  recovery guidance without altering cache contents.

## Task 3: Verify and publish evidence

- [x] Run focused compact and MCP-interface tests, `pnpm type-lint`, `pnpm
  build`, `pnpm test:package-bin`, and `git diff --check`.
- [x] Run `pnpm check:version-bump` before commit.
- [x] Include benchmark output and any rejected mappings in the pull request.
