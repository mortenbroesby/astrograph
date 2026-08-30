# Session Content-Reference Contract Delivery Checklist

> **Status:** Complete — merged in PR #97 as `0.9.0-alpha.180`.

**Goal:** Let a capable MCP client identify a bounded local session and learn a
content-addressed reference for a canonical response, while every call still
receives that complete canonical response.

**Architecture:** Add one optional `session` input recognized by the MCP server
registration wrapper, not by individual engine commands. A process-local
native `Map` stores only opaque session IDs and content IDs, with fixed TTL,
count, and byte limits. Each success response gets a SHA-256 content ID only
when the caller explicitly opts into `content-references-v1`; a known ID only
changes an additive fallback reason. The response stays full JSON, so there is
no delta, no source persistence, no new MCP tool, no daemon protocol change,
and no client without the capability sees a contract change.

**Tech Stack:** TypeScript, Node.js `crypto`, existing MCP SDK/Zod schemas,
Vitest, and existing JSON/AGC1 serializers. No dependency, SQLite table,
network service, embedding store, or background cleanup timer.

---

## Task 1: Define the additive MCP contract

**Files:**

- Create: `src/mcp-session.ts`
- Modify: `src/mcp-contract.ts`, `src/mcp.ts`, `specs/api-design/mcp-tools.md`
- Test: `tests/mcp-session.test.ts`, `tests/interface.test.ts`

- [ ] Establish the current MCP envelope/schema baseline with focused tests.
- [ ] Define `session: { capability: "content-references-v1", id,
  knownContentIds? }` with strict opaque-ID, array-count, and byte limits.
- [ ] Add only additive `meta.contentReference` fields for opted-in successful
  JSON responses: content ID and `full` fallback reason. Missing, malformed,
  expired, or unsupported session input must return the unchanged full response
  or existing invalid-argument envelope.
- [ ] Document capability, privacy boundary, full-response fallback, and that
  compact output remains unavailable for session references in this story.

## Task 2: Implement bounded process-local reference state

**Files:**

- Create: `src/mcp-session.ts`
- Modify: `src/mcp.ts`
- Test: `tests/mcp-session.test.ts`

- [ ] Use SHA-256 of canonical JSON only; retain no full response, source,
  prompt, raw query, repository path, or cross-process state.
- [ ] Bound sessions, known IDs, ID length, aggregate bytes, and lifetime.
  Prune lazily on use; do not add a timer or daemon migration.
- [ ] Return `new_content` or `known_content_no_delta_support` deterministically
  while still serializing the full canonical envelope.
- [ ] Prove malformed/unknown/expired/over-limit sessions neither leak state
  nor alter ordinary no-session or error behavior.

## Task 3: Preserve transport and package behavior

**Files:**

- Modify: `src/mcp.ts`, `tests/compact-mcp.test.ts`, `tests/interface.test.ts`
- Test: `tests/mcp-session.test.ts`

- [ ] Force ordinary JSON when a valid session capability is requested; retain
  existing AGC1 behavior for every non-session compact/auto call.
- [ ] Prove stdio server schema advertises the optional input and exact client
  fallback works after restart/process state loss.
- [ ] Update the epic with measured contract evidence and decide only whether
  Story 3's delta experiment should begin.

## Verification

```bash
pnpm exec vitest run tests/mcp-session.test.ts tests/compact-mcp.test.ts tests/interface.test.ts
pnpm type-lint
pnpm build
pnpm test:package-bin
pnpm check:version-bump
git diff --check
```

Expected: all commands exit `0`; non-session/AGC1 behavior is unchanged;
session-enabled calls always receive a lossless full JSON envelope with bounded,
source-free reference metadata.
