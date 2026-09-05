---
alwaysApply: true
---

# Worktree Policy

Repository-changing work uses an isolated linked Git worktree by default.

1. Inspect the primary checkout without changing it.
2. Reuse a task's existing worktree when it is cleanly scoped to that task.
3. Otherwise follow `.skills/using-git-worktrees/SKILL.md` and create a branch
   under the repository's ignored `.worktrees/` directory.
4. Confirm the linked worktree's root, branch, base commit, and clean baseline
   before implementation.
5. Commit and push from the linked worktree. Preserve unrelated work and do not
   prune or remove other worktrees as incidental cleanup.

The primary checkout may be changed only when the user explicitly requests it
or when worktree administration or recovery cannot be performed elsewhere.
State that reason before editing.
