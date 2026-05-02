# Agent Runtimes

Contract-style reference for the agent runtimes this repo wants to support.

## Table Of Contents

- [Shared Contract](./shared-contract.md)
- [Codex](./codex.md)
- [Claude](./claude.md)
- [Copilot CLI](./copilot-cli.md)

Use these files for:

- repo-specific runtime behavior
- adapter boundaries
- runtime-specific gaps worth tracking

Keep runtime adapters thin:

- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`

Shared repo contract:

- `AGENTS.md` is the shared bootstrap
- shared rules live in `.agents/rules/`
- shared references live in `.agents/references/`
- repo-owned skills live in `.skills/`
- skills are loaded on demand with:
  - `pnpm skills:list`
  - `pnpm skills:search <query>`
  - `pnpm skills:read <skill-name>`

Shared surfaces:

- [Shared Contract](./shared-contract.md)

Runtime notes:

- [Codex](./codex.md)
- [Claude](./claude.md)
- [Copilot CLI](./copilot-cli.md)

Read more:

- Codex:
  [Codex runtime note](./codex.md),
  [Codex tool mapping](../../../.skills/using-superpowers/references/codex-tools.md)
- Claude:
  [Claude runtime note](./claude.md),
  [shared rules](../../rules/README.md)
- Copilot CLI:
  [Copilot runtime note](./copilot-cli.md),
  [repo instructions](../../../.github/copilot-instructions.md)
- Shared repo policy:
  [skill routing](../../rules/skill-routing.md),
  [agent infrastructure](../../rules/agent-infrastructure.md)

Related references:

- `.skills/using-superpowers/references/codex-tools.md`
- `.agents/rules/skill-routing.md`
