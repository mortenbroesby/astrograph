---
name: ponytail
description: >
  Implement or simplify repository changes using the smallest reliable solution.
  Use for any coding, configuration, workflow, documentation, testing, design,
  or refactoring task, especially when the user asks for a simple, minimal,
  lazy, YAGNI, or less-bloated solution. Default intensity is full.
argument-hint: "[lite|full|ultra]"
---

# Ponytail

Ponytail means efficient rather than careless: understand the path first, then
choose the smallest solution that fully meets the request. It is repository
guidance only; never add it to Astrograph's production dependencies.

## Intensity

- **lite**: implement the request and name the simpler alternative.
- **full**: enforce the ladder below. This is the repository default.
- **ultra**: reject speculative scope and prefer deletion or a one-line native
  solution when it genuinely satisfies the request.

## The ladder

Stop at the first rung that works after understanding the behavior and callers:

1. Does this need to exist? Skip speculative work.
2. Is there a local helper, type, or established pattern? Reuse it.
3. Does the standard library cover it? Use that.
4. Does the platform cover it natively? Prefer it over custom code.
5. Does an installed dependency already solve it? Reuse it; do not add a new
   dependency for a few clear lines.
6. Can the correct solution be one clear line? Keep it one line.
7. Otherwise, write the minimum maintainable code.

## Guardrails

- Trace the relevant flow before editing. Small but misplaced changes are not
  simpler.
- Fix root causes in shared code after checking its callers; do not paste
  symptom guards into each caller.
- Do not add an abstraction with one implementation, future-only configuration,
  factories for one product, or boilerplate for hypothetical reuse.
- Prefer deletion and boring names over clever compression.
- Never remove validation at trust boundaries, recovery from data loss,
  security controls, accessibility basics, or explicit user requirements.
- For a deliberate shortcut with a real ceiling, add a `ponytail:` comment that
  records the ceiling and the upgrade condition.
- Non-trivial new logic needs one focused runnable proof. Trivial one-liners do
  not need ceremonial tests.

## Workflow

1. Read the task, affected implementation, callers, and existing checks.
2. State the smallest viable approach before broadening scope.
3. Implement one coherent slice.
4. Run the narrowest relevant verification.
5. Keep the final explanation to: what changed, what was skipped, and when to
   add more.

## Examples

- A cache request: use an existing cache or the platform cache first; add a
  custom cache only when its missing behavior is concrete and measured.
- A parsing bug: correct the shared parser after checking callers, then add one
  regression test at the parser boundary.
- A new dependency: prefer an installed dependency or native API unless the
  new package removes substantial, verified complexity.
