---
name: readme-authoring
description: Use when writing, restructuring, or reviewing a project README, especially when onboarding is weak, setup steps are unclear, sections are missing, or repo-maintenance work includes README refreshes. Trigger on requests to improve documentation, add missing README sections, standardize project front-door docs, or turn scattered setup notes into a usable README.
---

# README Authoring

## Overview

A README is the repo's front door, not the whole manual. Use it to help a
reader understand what the project is, why it exists, how to run it, and where
to go next.

This skill turns broad README advice into a practical editing workflow. Favor a
clear structure, accurate commands, and links to deeper docs over bloated
one-file documentation.

## When to Use

- The user asks to write, refresh, or clean up a `README.md`
- A repo has setup instructions scattered across issues, comments, or nested
  docs
- A project works locally, but the README does not explain how
- A README exists but is missing core orientation sections
- A package/app/subproject needs a local README that matches the repo standard

Do not use this skill when the task is mainly an ADR, API reference, or deep
internal design doc. In those cases, update the README only as the entry point
and link out to the durable source.

## Core Principle

Treat the README as a structured landing page:

1. Lead with orientation
2. Show the most important capabilities
3. Explain how to get running
4. Point to deeper documentation for everything else

Not every README needs every section. Small packages can collapse sections.
Complex apps usually need most of them.

## Section Checklist

Use this as the default section set, adapted from common open-source README
practice:

| Section | Purpose | Usually Required |
| --- | --- | --- |
| Title and introduction | State what the project is and why it matters | Yes |
| Table of contents | Improve navigation for longer READMEs | For medium/large READMEs |
| About | Explain scope, users, and problem solved | Yes |
| Features | Summarize major capabilities | Usually |
| Tech stack | Name key technologies and runtime assumptions | Usually |
| Architecture | Give a high-level system view | For non-trivial systems |
| Project structure | Explain important folders/files | For repos with multiple moving parts |
| Getting started | Show clone, install, and run steps | Yes |
| Configuration | Document env vars and setup knobs | When configuration exists |
| Security | Explain reporting, secrets, and safety expectations | When relevant |
| Contributing | Tell others how to contribute | For shared or open repos |
| What's next | Capture roadmap or known next steps | Optional but useful |
| License | State licensing clearly | If distributed/shared |
| Acknowledgements | Credit important dependencies/influences | Optional |
| Author | Identify maintainer/owner when useful | Optional |

## Process

1. Identify the README's audience.
   Internal monorepo maintainers need fast orientation and accurate commands.
   Open-source readers need adoption and contribution guidance.

2. Audit the current document and adjacent docs.
   Check what already exists in `README.md`, app/package READMEs, `docs/`,
   `AGENTS.md`, and setup scripts before inventing new wording.

3. Pick the minimum complete structure.
   For a small package, combine `About`, `Features`, and `Tech stack`.
   For a larger app or monorepo, keep sections separate.

4. Draft sections in reader order.
   Start with identity and purpose, then capabilities, then setup, then deeper
   operational detail.

5. Keep the README shallow where it should be shallow.
   Link to deeper docs for architecture, ADRs, security policy, or extensive
   configuration instead of dumping everything inline.

6. Verify every command, path, and claim.
   README quality is mostly credibility. Stale setup commands destroy trust
   quickly.

## Writing Rules

- Use plain, direct language
- Prefer concrete commands over vague setup prose
- Prefer bullets and short sections over dense walls of text
- Keep implementation detail out of feature summaries unless it changes usage
- Use architecture diagrams or folder maps only when they improve comprehension
- Make links actionable and specific
- Keep examples synchronized with the actual scripts, ports, env vars, and file
  names in the repo

## README Review Pass

When reviewing or rewriting a README, check these in order:

1. Can a new reader tell what this project is within the first screen?
2. Is there a reliable path to install and run it?
3. Are important commands accurate right now?
4. Are missing details linked from the README instead of silently omitted?
5. Does the structure fit the project size, or is it overbuilt/underbuilt?

## Common Mistakes

| Mistake | Better move |
| --- | --- |
| README tries to be the full manual | Keep README as entry point and link deeper docs |
| Large repo has no table of contents | Add one once navigation starts to cost scrolling |
| Features describe implementation internals | Rewrite around user-facing capability |
| Setup steps are untested | Run them or confirm against scripts before shipping |
| Project structure dumps every file | Mention only meaningful folders and files |
| Configuration is hand-wavy | List required env vars, defaults, and where they matter |
| Architecture section is absent for a complex system | Add a compact high-level explanation or diagram |

## Output Shape

When the user asks for README help, aim to produce one of these:

- A revised `README.md`
- A targeted section rewrite for an existing README
- A README outline before full drafting
- A review checklist with concrete missing sections and stale content

## Verification

- [ ] The README states what the project is and who it is for
- [ ] Setup commands and paths match the repo today
- [ ] The section structure fits the repo's actual complexity
- [ ] Deeper docs are linked instead of duplicated
- [ ] Missing sections were added only when they materially help the reader
