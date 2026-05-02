# Security Checklist

## Baseline

- Do not expose secrets, tokens, or local credentials in code or docs.
- Validate untrusted input at boundaries.
- Keep writes inside the project root and out of generated output.
- Avoid adding permissive escape hatches without explicit justification.

## Repo-specific checks

- Respect `.agents/hooks/` protections for shell commands, file writes, and
  secret scanning.
- Do not weaken `.codex/rules/` escalation policy from markdown docs.
- When changing hooks or command policy, keep behavior deterministic and narrow.

## Red flags

- New environment variable expectations with no docs update
- Broad file write permissions or disabled guardrails
- Runtime or route changes that trust client input without validation
