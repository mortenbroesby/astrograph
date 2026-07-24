---
alwaysApply: true
---

# Ponytail

Ponytail is the default implementation posture for this repository: solve the
actual problem with the smallest reliable change. It is an agent-workflow rule,
not an Astrograph runtime dependency.

For code, configuration, docs, tests, or workflow changes, load
`.skills/ponytail/SKILL.md` in **full** mode before implementing. Do not use it
for a request that is only conversation, translation, or general knowledge.

Apply the ladder in order:

1. Skip speculative work that does not need to exist.
2. Reuse a proven local pattern before adding one.
3. Prefer the standard library, platform, then an installed dependency.
4. Add only the smallest clear implementation that satisfies the stated need.

Do not simplify away validation, error handling, security, accessibility, or
explicitly requested behavior. Fix the shared root cause rather than adding
symptom guards at call sites. When a deliberate shortcut has a known ceiling,
leave a `ponytail:` comment that names both the ceiling and the upgrade path.

Run the narrowest check that proves non-trivial changed behavior. Keep the
handoff compact: state what changed, what was intentionally not built, and the
condition that would justify expanding it.
