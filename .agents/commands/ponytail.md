---
description: Build or simplify with the repository's Ponytail policy
---

Use the `ponytail` skill in full mode.

1. Read the task and the affected code path before changing anything.
2. Climb the Ponytail ladder: skip, reuse local code, standard library, native
   platform, installed dependency, then minimal new code.
3. Fix shared causes, preserve explicit requirements and safety boundaries, and
   avoid speculative abstractions.
4. Verify the smallest behavior that would fail if the change regressed.
5. Report the completed change and any intentional non-goal in three short
   lines or fewer.
