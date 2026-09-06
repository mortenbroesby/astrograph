## ADDED Requirements

### Requirement: Exact-source responses support lossless compact output

Astrograph SHALL let MCP clients request `json`, `compact`, or `auto` output for `get_symbol_source`, SHALL preserve ordinary JSON as the default, and SHALL make every successful compact response losslessly decodable to the same validated v1 envelope without repeating the first source item in compatibility fields.

#### Scenario: Existing client omits output format
- **WHEN** a client calls `get_symbol_source` without `format`
- **THEN** Astrograph returns the existing ordinary JSON response
- **AND** preserves its parsed fields and values

#### Scenario: Client requests compact exact source
- **WHEN** a client calls `get_symbol_source` with `format` set to `compact`
- **THEN** Astrograph returns a compact envelope containing each requested symbol once
- **AND** lossless decoding restores symbol identity, exact source, verification state, line range, provenance, and v1 metadata

#### Scenario: Client requests automatic formatting
- **WHEN** a client calls `get_symbol_source` with `format` set to `auto`
- **THEN** Astrograph selects compact output only when the established savings thresholds are met
- **AND** otherwise returns ordinary JSON

### Requirement: Comparison evidence proves successful source retrieval

The jCodeMunch comparison workflow SHALL reject tool-level errors and SHALL count a retrieval as successful only when the requested implementation source is present in the source-producing response.

#### Scenario: Symbol search succeeds but source lookup fails
- **WHEN** symbol discovery contains the target name and the following source-producing call returns an error or omits the requested implementation
- **THEN** the run is recorded as failed
- **AND** its payload is excluded from successful-retrieval aggregates

#### Scenario: Products require different minimum successful workflows
- **WHEN** equivalent source retrieval requires different supported call sequences or encodings
- **THEN** the report measures each minimum successful workflow separately
- **AND** reports isolated exact-source response cost separately
- **AND** discloses the semantic mismatch instead of treating an error payload as a token-saving result
