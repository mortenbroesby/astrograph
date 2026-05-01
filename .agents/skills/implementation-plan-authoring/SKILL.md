---
name: implementation-plan-authoring
description: Use when writing Astrograph implementation plans, refactor plans, execution specs, task checklists, or agent handoff plans
---

# Implementation Plan Authoring

## Overview

Implementation plans live in `specs/implementation/` and must be executable by
an agent without additional design decisions.

## Required Shape

Use `specs/templates/implementation-plan.md`.

Every plan must include:

- goal, architecture, and tech stack header
- exact files to create or modify
- baseline verification commands
- implementation steps
- final verification commands
- commit checkpoint with `pnpm check:version-bump` when source changes

## Astrograph Defaults

- Use isolated worktrees unless the user explicitly asks for direct `main` work.
- Use `pnpm type-lint` for TypeScript verification.
- Use focused `pnpm exec vitest run ...` commands before full-suite checks.
- Treat `src/index.ts` exports, MCP tool names, CLI JSON output, and package bin behavior as compatibility-sensitive.
- Include package version policy in any plan that touches `src/`, `scripts/`, `tests/`, `bench/`, `tsconfig`, or package metadata.

## Common Mistakes

- Do not write vague steps like "add tests" or "handle edge cases".
- Do not bundle unrelated subsystems into one task.
- Do not skip expected command outcomes.
- Do not leave a plan outside the `specs/` index.
