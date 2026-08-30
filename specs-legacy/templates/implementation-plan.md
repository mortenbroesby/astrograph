# Feature Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One sentence describing what this builds.

**Architecture:** Two or three sentences describing the implementation approach and boundaries.

**Tech Stack:** TypeScript, Node 24, Vitest, and any task-specific libraries.

---

## Task 1: Task Name

**Files:**
- Modify: `path/to/file.ts`
- Create: `path/to/new-file.ts`
- Test: `tests/path.test.ts`

- [ ] **Step 1: Establish baseline**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/path.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Make the smallest behavior-preserving change**

Describe the exact change. Include code snippets when the implementation must
not make design decisions.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm type-lint
pnpm exec vitest run tests/path.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit**

Run:

```bash
git add path/to/file.ts path/to/new-file.ts tests/path.test.ts package.json
pnpm check:version-bump
git commit -m "Short imperative commit message"
```

Expected: version policy passes before commit.
