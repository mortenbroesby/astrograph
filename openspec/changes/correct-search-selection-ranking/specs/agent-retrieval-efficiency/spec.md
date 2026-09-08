## ADDED Requirements

### Requirement: Symbol search applies scope before candidate bounds

Astrograph SHALL apply requested file, language, and symbol-kind scope before a
bounded candidate set can exclude matching symbols.

#### Scenario: Scoped target falls beyond the unscoped candidate prefix

- **WHEN** a symbol matching the query and requested file scope ranks beyond the
  unscoped full-text candidate bound
- **THEN** scoped symbol search returns that symbol
- **AND** no out-of-scope symbol consumes the scoped candidate bound

### Requirement: Symbol search preserves deterministic lexical recall

Astrograph SHALL retain lexical candidates that satisfy the query and scope
when indexed full-text selection returns a non-empty but incomplete candidate
set, and SHALL return the same ordered result for repeated equivalent calls.

#### Scenario: Full-text selection omits a lexical match

- **WHEN** a scoped symbol satisfies Astrograph's lexical matching rules but is
  absent from the full-text candidate set
- **THEN** symbol search still considers that symbol for the response
- **AND** repeated calls return a stable order

### Requirement: Strong lexical evidence precedes weaker full-text evidence

Astrograph SHALL rank exact and heuristic lexical evidence before using
full-text relevance as a tie-breaker.

#### Scenario: Exact name competes with a weaker full-text match

- **WHEN** one candidate exactly matches the requested symbol name and another
  has stronger full-text relevance but weaker lexical evidence
- **THEN** the exact-name candidate appears first

#### Scenario: Lexically equivalent candidates need a tie-breaker

- **WHEN** candidates have equal lexical ranking evidence
- **THEN** full-text relevance, export status, path, line, and name produce a
  deterministic order

### Requirement: Ranking changes produce comparable evidence

The performance workflow SHALL record correctness before cost for symbol
selection and ranking changes.

#### Scenario: Maintainer evaluates the ranking change

- **WHEN** the before and after fixtures are run on the same repository revision
- **THEN** the evidence reports target recall, first-relevant rank, false
  positives, scoped recall, response tokens, and retrieval latency
- **AND** source-bearing raw output remains outside the repository
