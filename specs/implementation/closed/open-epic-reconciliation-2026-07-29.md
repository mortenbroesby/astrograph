# Open Epic Reconciliation — 2026-07-29

> **Status:** Done — documentation-only cleanup completed in one branch.

**Goal:** Replace a misleading eight-item active queue with a truthful view of
delivered evidence, ready follow-ups, and the two product tracks that are
actually in progress.

**Architecture:** This is a status reconciliation, not an implementation
release. It does not check historical implementation boxes without evidence,
change runtime behavior, or merge unrelated product work. Detailed records
stay intact and move to the status directory that matches their next action.

**Tech Stack:** Markdown specifications, Git history, current source-tree
inspection, GitHub pull-request state.

## Story 1: Reconcile the active queue

**Files:** active/planned/closed implementation indexes, delivery roadmap,
`pointer.md`, and the listed implementation records.

- [x] Verify `origin/main`, the working-tree/worktree state, and open pull
  requests before changing the queue. Result: the primary worktree contains
  unrelated WASM-parser WIP, so reconciliation used an isolated worktree; no
  open pull request represented another active delivery.
- [x] Close the completed Runtime Acceleration Epic. Its four tasks contain
  explicit merged verification and benchmark evidence; there are no unchecked
  implementation tasks.
- [x] Archive the Interactive Install Lifecycle Epic as superseded by the
  Pre-v1 Clean Install Contract. The successor intentionally removes the
  legacy migration/compatibility path, so its remaining unchecked items cannot
  truthfully be completed as a separate effort.
- [x] Move Tree-sitter polyglot expansion, local daemon hardening, repository
  structure cleanup, and the publishable workflow benchmark to **Ready**.
  Each has useful design/evidence, but none is currently selected and each has
  a distinct evidence gate.
- [x] Keep exactly two active product tracks: WASM parser runtime migration
  and the Pre-v1 clean-install contract. The former owns Node 20/22/24 package
  proof; the latter owns current installer/configuration reset behavior.
- [x] Update the active, planned, closed, roadmap, and pointer indexes so the
  filesystem and summary views agree.

## Ready follow-up selection gates

| Record | Resume only when |
| --- | --- |
| Tree-sitter polyglot support | The WASM migration has passed package/Node gates, and a language batch has a clear monorepo value, asset-size budget, and fixture/tier contract. |
| Local daemon runtime ownership | A reproduced multi-client lifecycle, lease, tenant-isolation, or platform issue needs product work beyond the delivered runtime reuse path. |
| Repository structure cleanup | One narrow, behavior-preserving file-layout or script-ownership story has a focused baseline and does not require a workflow-cost change. |
| Publishable workflow benchmark | A selected corpus is clean and snapshot-locked, every selected workflow succeeds, and generated results can be checked in with their JSON evidence. |

## Verification

```bash
git diff --check
find specs .skills -type f -name '*.md' -print
```

Expected: Markdown files remain discoverable and the specification diff has no
whitespace errors. No release is required because this change only reconciles
documentation and implementation records.
