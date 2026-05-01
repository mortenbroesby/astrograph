---
name: spec-maintenance
description: Use when updating Astrograph spec indexes, moving specs, checking doc links, reconciling docs with tests, or keeping specs aligned after implementation
---

# Spec Maintenance

## Overview

Specs are useful only when indexes, links, and verification pointers stay
current.

## Checklist

When changing specs:

1. Update the nearest section README.
2. Update `specs/README.md` for top-level or roadmap changes.
3. Keep templates generic and examples Astrograph-specific.
4. Link implementation plans to architecture or API specs they depend on.
5. Link public API specs to tests that prove the contract.
6. Remove or rewrite stale docs instead of leaving duplicate sources of truth.

## Migration Rules

- Prefer moving old plan docs into `specs/implementation/`.
- Keep release docs in `docs/release.md`.
- Keep performance workflow docs in `docs/performance.md`.
- Do not move README user-facing installation guidance into specs.

## Verification

For documentation-only changes, run:

```bash
git diff --check
find specs .agents/skills -type f -name '*.md' -print
```

If package metadata, source, tests, or scripts changed, run the relevant project
checks and `pnpm check:version-bump`.
