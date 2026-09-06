## 1. Hydration-first exploration policy

- [ ] 1.1 Update the shared Codex and Copilot agent-policy blocks to require readiness check, `index_folder`, completion, and retry before fallback; verify both generated-policy previews in `tests/engine-contract.test.ts`.
- [ ] 1.2 Update Astrograph's repository exploration policy to match the generated contract; verify the policy does not permit fallback solely because an index is absent.

## 2. Verification and delivery

- [ ] 2.1 Run `pnpm exec vitest run tests/engine-contract.test.ts --testTimeout=20000`, `pnpm type-lint`, `pnpm build`, and `git diff --check`; verify all exit successfully.
- [ ] 2.2 Use `.skills/release-decision/SKILL.md` to determine the version impact, then run `pnpm check:version-bump --base origin/main` before committing the source behavior change.
