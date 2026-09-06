## 1. Hydration-first exploration policy

- [x] 1.1 Update the shared Codex and Copilot agent-policy blocks to require readiness check, `index_folder`, completion, and retry before fallback; verify both generated-policy previews in `tests/engine-contract.test.ts`.
- [x] 1.2 Update Astrograph's repository exploration policy to match the generated contract; verify the policy does not permit fallback solely because an index is absent.
- [x] 1.3 Replace the package-root config's runtime self import with a type-only source reference; verify `loadRepoEngineConfig(process.cwd())` succeeds before `pnpm build`.

## 2. Verification and delivery

- [x] 2.1 Run `pnpm exec vitest run tests/engine-contract.test.ts --testTimeout=20000`, `pnpm type-lint`, `pnpm build`, and `git diff --check`; verify all exit successfully.
- [x] 2.2 Use `.skills/release-decision/SKILL.md` to determine the version impact, then run `pnpm check:version-bump --base origin/main` before committing the source behavior change.
