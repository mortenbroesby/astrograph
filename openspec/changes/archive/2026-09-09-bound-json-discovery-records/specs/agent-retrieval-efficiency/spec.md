## ADDED Requirements

### Requirement: JSON discovery records exclude complete values

Astrograph SHALL represent indexed JSON properties with structural signatures whose size does not grow with the complete scalar, object, or array value, while preserving the complete property range for explicit source retrieval.

#### Scenario: Large scalar appears in discovery
- **WHEN** a top-level JSON property contains a large scalar value
- **THEN** symbol search and file outlines identify the property without embedding the complete scalar in its signature
- **AND** the property cannot dominate a bounded five-result discovery response through value size alone

#### Scenario: Large object or array appears in discovery
- **WHEN** a top-level JSON property contains a large object or array value
- **THEN** structural discovery identifies the property without embedding the complete nested value
- **AND** does not introduce nested JSON symbols that were not already part of the public behavior

#### Scenario: Client explicitly retrieves the JSON property
- **WHEN** a client requests exact source for the property symbol
- **THEN** Astrograph returns the complete indexed property source
- **AND** its byte range, line range, source hash, and token count agree with that source

### Requirement: JSON discovery changes produce comparable evidence

The performance workflow SHALL measure JSON discovery size and retrieval correctness with a deterministic large-value fixture and exact token accounting.

#### Scenario: Maintainer evaluates bounded JSON discovery
- **WHEN** equivalent before and after runs use the same fixture, query, result limit, tokenizer, and privacy rules
- **THEN** at least three valid runs report discovery bytes, discovery tokens, target rank, exact-source bytes, exact-source tokens, source fidelity, and latency
- **AND** unstable ordering or failed exact-source fidelity rejects the run
- **AND** committed evidence contains no source-bearing payloads, prompts, raw client logs, or session identifiers
