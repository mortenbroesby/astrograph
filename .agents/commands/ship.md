---
description: Check release readiness before pushing live
---

Use the `engineering-workflow` and `shipping-and-launch` skills.

Before shipping or deployment:

1. Confirm lint, type-check, tests, build, or deployment checks relevant to the
   changed surface.
2. Confirm docs, rules, or vault memory were updated when behavior or workflow
   changed.
3. Check for secrets, debug logs, TODOs that block release, and generated-output
   churn.
4. Identify rollback shape and any monitoring/manual validation needed.
5. Report failures before proceeding.

Do not imply production readiness if a relevant check was skipped.
