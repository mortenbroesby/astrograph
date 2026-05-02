---
alwaysApply: true
---

# Skill Routing

Load skills only when they materially improve the current task. Do not preload
multiple skills just because they exist.

## Default

- Start without loading a skill when the task is tiny, obvious, and local.
- Use `pnpm skills:route "<task>"` when you want a cheap bootstrap classifier
  before reading any full `SKILL.md` bodies.
- Load one primary skill first when the task has a clear dominant mode.
- Load a second skill only when it covers a distinct gap the first one does not.
- Prefer workflow skills before specialist skills when the task is broad or
  underspecified.

## Workflow Triggers

- Load `using-superpowers` when the user explicitly asks for Superpowers or
  wants a stricter process-first skill-selection mode.
- Load `grill-me` before planning or implementation when the main problem is
  unclear requirements, unresolved assumptions, or an untested design.
- Load `engineering-workflow` for multi-step implementation, review, testing,
  simplification, or shipping work.
- Load `spec-driven-development` when the request introduces a new feature,
  boundary, or structural change and the target is not yet crisp.
- Load `planning-and-task-breakdown` when the user wants a plan or when the work
  is large enough to benefit from ordered slices before editing.
- Load `incremental-implementation` when the task spans multiple files or needs
  thin, verifiable slices.
- Load `test-driven-development` for behavior changes, bug fixes, or
  logic-heavy work that needs proof.
- Load `code-review-and-quality` when reviewing changes or validating correctness
  before merge.
- Load `shipping-and-launch` when preparing to push, merge, or release.

## Cross-Cutting Triggers

- Load `context-engineering` when starting a session, changing task focus, or
  when retrieval/context quality is the main risk.
- Load `source-driven-development` when correctness depends on external docs,
  fast-moving APIs, or primary-source verification.
- Load `documentation-and-adrs` when behavior, architecture, workflow, or setup
  expectations change durably.
- Load `doc-coauthoring` when the primary output is a spec, proposal, decision
  doc, or other structured documentation.

## Specialist Triggers

- Load `api-and-interface-design` when changing shared contracts, payloads,
  types, module boundaries, or mount interfaces.
- Load `debugging-and-error-recovery` when reproducing failures or recovering
  from broken tests, builds, or runtime behavior.
- Load `code-simplification` when the main goal is reducing complexity without
  changing behavior.
- Load `frontend-design` for deliberate UI design or visual implementation work.
- Load `browser-testing-with-devtools` or `webapp-testing` when live browser
  evidence matters more than static code inspection.
- Load `mcp-builder` when building or extending MCP servers and tool surfaces.
- Load `skill-creator` when creating or refining a skill.
- Load `gh-stack` when the user wants stacked branches, dependent PRs, or
  explicit `gh stack` workflows.
- Load `using-git-worktrees` only when task isolation from the current workspace
  is worth the extra setup.

## Composition

- `using-superpowers` is a bootstrap/process selector. Follow it by loading the
  concrete workflow or specialist skill it points to.
- Typical discovery flow: `grill-me` first, then `spec-driven-development` or
  `planning-and-task-breakdown` once the decision tree is clearer.
- Typical flow: `engineering-workflow` plus one specialist skill.
- For external-library feature work: `engineering-workflow` plus
  `source-driven-development`.
- For contract changes: `engineering-workflow` plus `api-and-interface-design`.
- For bug fixes: `debugging-and-error-recovery` plus
  `test-driven-development`.
- For architectural docs: `doc-coauthoring` plus `documentation-and-adrs`.
- For stacked PR work: `gh-stack` first, then a workflow skill only if the task
  also needs planning or implementation structure.

## Avoid

- Do not load skills just to restate obvious instructions already covered by
  `AGENTS.md` or repo rules.
- Do not load both `grill-me` and `planning-and-task-breakdown` at the same
  time unless the open questions are still blocking a useful plan.
- Do not load both `browser-testing-with-devtools` and `webapp-testing` unless
  both toolsets are actually needed.
- Do not load both `gh-stack` and `using-git-worktrees` unless the user
  explicitly wants both stacked branches and separate worktree isolation.
- Do not chain many workflow skills together when one primary workflow skill and
  one specialist skill would do.
