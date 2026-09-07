# agent-retrieval-efficiency Specification

## Purpose

Make Astrograph materially reduce the context and retries consumed by coding agents while preserving exact source retrieval when it is explicitly needed.

## Requirements

### Requirement: Structural responses exclude implementation bodies

Astrograph SHALL represent indexed symbol signatures as structural declarations without function bodies or variable initializers and SHALL preserve the complete symbol byte range for explicit source retrieval.

#### Scenario: Agent inspects a file outline
- **WHEN** a function, method, or class contains an implementation body
- **THEN** its outline and symbol-search signature excludes that body
- **AND** `get_symbol_source` can still return the complete indexed symbol source

#### Scenario: Agent searches near a large exported constant
- **WHEN** a variable declaration has an object, array, or expression initializer
- **THEN** its indexed signature excludes the initializer
- **AND** its exact source range still includes the complete declaration

### Requirement: MCP JSON is token-efficient and semantically compatible

Astrograph SHALL serialize ordinary MCP JSON without presentation-only whitespace while preserving the parsed v1 envelope and validation behavior.

#### Scenario: Client requests ordinary JSON
- **WHEN** an MCP tool returns a validated v1 response
- **THEN** the response contains the same parsed fields and values as before
- **AND** does not include indentation or line breaks used only for human presentation

### Requirement: Client guidance avoids self-induced daemon queue failures

Astrograph SHALL tell agents to issue operations for the same repository sequentially while allowing independent repositories to be queried concurrently.

#### Scenario: Agent needs several results from one repository
- **WHEN** a client plans multiple Astrograph calls against the same repository root
- **THEN** it sends those calls sequentially
- **AND** does not create a parallel burst that can expire behind the repository safety queue

#### Scenario: Agent works across distinct repositories
- **WHEN** calls target different canonical repository roots
- **THEN** the guidance does not prohibit concurrent calls

### Requirement: Client guidance starts with bounded retrieval

Astrograph SHALL tell agents to start exact or file-scoped symbol discovery with at most 5 results, task-context assembly with a 1,200-token payload budget, and exact-source retrieval with at most two symbols, then increase those bounds only after refining the query.

#### Scenario: Agent begins broad code discovery
- **WHEN** an agent does not yet know the exact symbol or file
- **THEN** it starts `search_symbols` with an exact or file-scoped query and limit 5
- **AND** starts `get_task_context` with a 1,200-token payload budget
- **AND** retrieves source for at most two exact symbols initially
- **AND** refines the query before requesting more results or context

### Requirement: Real-client efficiency is regression tested

The performance workflow SHALL support bounded read-only Copilot CLI trials that report client usage and Astrograph call measurements without committing prompts, source, session identifiers, or raw client logs.

#### Scenario: Maintainer runs a Copilot efficiency comparison
- **WHEN** equivalent before and after trials are run
- **THEN** the evidence includes elapsed time, tool-call count, failed-call count, response bytes, and available model usage totals
- **AND** raw source-bearing artifacts remain outside the repository

### Requirement: Optional content-reference hints do not block retrieval

Astrograph SHALL accept valid client session identifiers of at least eight characters and SHALL ignore malformed optional known-content identifiers within the existing count and byte limits.

#### Scenario: Copilot sends an imperfect cache hint
- **WHEN** a retrieval call has a valid content-reference session and one malformed known-content identifier
- **THEN** Astrograph ignores that identifier
- **AND** executes the requested retrieval normally

### Requirement: Routine project status is concise

The MCP `get_project_status` result SHALL omit verbose language support matrices by default and SHALL return them when `includeSupportTiers` is true.

#### Scenario: Agent checks whether retrieval is ready
- **WHEN** an agent calls `get_project_status` without requesting support tiers
- **THEN** the response includes readiness, retrieval health, freshness, and watcher health
- **AND** omits the language-by-language support matrix

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

### Requirement: Assembled source matches indexed UTF-8 ranges

Astrograph SHALL return the exact indexed symbol text from task-context and
context-bundle operations, and SHALL keep its source hashes, byte ranges, line
ranges, and token accounting consistent with that text.

#### Scenario: Multibyte text precedes or occurs inside a symbol

- **WHEN** an indexed file contains Unicode or emoji before or inside a selected symbol
- **THEN** task context and context bundles return the complete selected symbol without shifted or truncated characters
- **AND** their provenance byte range addresses exactly the returned source in the indexed file

#### Scenario: Indexed source uses CRLF or shares a line with another symbol

- **WHEN** a selected symbol is stored with CRLF line endings or begins or ends on a line shared with other source
- **THEN** assembled retrieval returns only the indexed symbol range
- **AND** its source hash and token count are calculated from that exact returned source

#### Scenario: Existing clients consume corrected retrieval

- **WHEN** a CLI or MCP client requests the corrected context operation
- **THEN** the existing response schema and tool contract remain compatible
