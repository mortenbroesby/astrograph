## ADDED Requirements

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
