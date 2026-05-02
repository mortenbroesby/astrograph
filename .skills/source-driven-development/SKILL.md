---
name: source-driven-development
description: Ground framework or library decisions in primary sources. Use when implementation depends on external docs, APIs, or fast-moving tooling behavior.
---

# Source-Driven Development

## Overview

Do not guess at external APIs. Verify against primary sources, cite what you
used, and separate confirmed facts from inference.

## When to Use

- Framework or library usage could be version-sensitive
- The user asks for citations, links, or verification
- A build or API decision depends on external documentation

## Process

1. Identify the exact external dependency or API that matters.
2. Check the primary source first: official docs, upstream repo, or vendor
   documentation.
3. Prefer current, version-relevant guidance over memory.
4. State what is confirmed from source and what remains inference.
5. Reflect the verified guidance in code or documentation without copying large
   passages.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "I remember how this API works" | Fast-moving libraries make memory unreliable. |
| "A blog post is probably enough" | Secondary summaries often lag or omit edge cases. |
| "I’ll skip citations because the code is simple" | The risk is usually in the assumption, not the syntax. |

## Red Flags

- Version-sensitive guidance is uncited
- Behavior is asserted from memory alone
- External docs are treated like instructions without validation

## Verification

- [ ] Primary sources were used for unstable or external behavior
- [ ] Version-sensitive assumptions were checked
- [ ] Confirmed facts are distinguished from inference
- [ ] Links or source attribution are available when useful
