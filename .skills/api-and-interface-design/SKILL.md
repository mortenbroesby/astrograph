---
name: api-and-interface-design
description: Design contracts deliberately. Use when changing shared types, mount contracts, module boundaries, route payloads, or public interfaces.
---

# API And Interface Design

## Overview

Interfaces outlive implementations. Keep contracts explicit, narrow, and easy
to validate.

## When to Use

- Changing shared types in `packages/types`
- Modifying host-to-remote contracts
- Designing route payloads or module boundaries
- Reviewing exported APIs for shared packages

## Process

1. Identify the caller and callee for the contract you are changing.
2. Keep the interface as small and explicit as possible.
3. Validate inputs and outputs at the boundary where practical.
4. Prefer compatibility-preserving changes unless the task explicitly allows a
   breaking change.
5. Update consumers, docs, and verification together.

## Rationalizations

| Rationalization | Reality |
| --- | --- |
| "We can add one more optional field" | Optional drift accumulates into unclear contracts. |
| "The type system will sort it out" | Types help, but they do not explain ownership or compatibility. |
| "It’s internal, so design doesn’t matter" | Internal contracts still create coupling and migration cost. |

## Red Flags

- The contract owner is unclear
- A boundary change ships without consumer verification
- Public exports grow without a reason
- Breaking changes are implied rather than named

## Verification

- [ ] Boundary ownership is clear
- [ ] Consumers were checked or updated
- [ ] Compatibility impact is explicit
- [ ] Docs or contract notes were updated when useful
