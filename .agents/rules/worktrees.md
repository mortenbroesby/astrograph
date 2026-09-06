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
5. Record active work in the current priority's `BACKLOG.md` manifest with its
   goal, state, branch, worktree, base, verification, and next action.
6. Commit and push from the linked worktree. Preserve unrelated work and do not
   prune or remove other worktrees as incidental cleanup.

## Interruption and cleanup

- When coherent work is interrupted, check it for secrets and unrelated files,
  commit it with clear unfinished status, push its named branch, and update the
  backlog entry with verification gaps and the next action. Do not use a stash
  as the normal session handoff.
- If work cannot be committed safely because ownership is unclear, content is
  mixed or sensitive, or generated residue is unresolved, leave the worktree
  intact and record the exact blocker and recovery path in `BACKLOG.md`.
- When a task is complete, verify its intended state is pushed or merged and
  that the worktree has no unique files. Then remove that task's linked
  worktree, prune stale metadata, and update or remove its backlog entry.
- Never remove another task's dirty worktree, branch, or stash merely to make an
  inventory look clean. A cleanup task must classify and preserve it first.

Example interrupted handoff: `BACKLOG.md` points to a pushed `wip:` commit and
names the failing or unrun checks plus the next command. Example completed
handoff: the remote branch or merge commit is verified, `git status --short` is
empty, the task worktree is removed, and its manifest entry is closed.

The primary checkout may be changed only when the user explicitly requests it
or when worktree administration or recovery cannot be performed elsewhere.
State that reason before editing.
