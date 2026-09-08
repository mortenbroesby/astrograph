## ADDED Requirements

### Requirement: Relation results state their evidence scope and confidence

Astrograph SHALL attach evidence scope, evidence kind, and confidence to every graph-derived relation returned by discovery, context-bundle, and task-context operations.

#### Scenario: Import proves only a file relationship
- **WHEN** an indexed file imports a target module but the evidence does not identify a referencing symbol
- **THEN** Astrograph reports the relationship as file-scoped import evidence
- **AND** does not label an arbitrary symbol from the importer as a symbol reference

#### Scenario: Import evidence identifies a referencing symbol
- **WHEN** an import specifier identifies a local binding and that binding occurs within an indexed symbol in the importer
- **THEN** Astrograph may report that symbol as a symbol-scoped reference
- **AND** states the import-specifier and identifier evidence with its confidence

### Requirement: Relation selection preserves aliases and re-export meaning

Astrograph SHALL use the local binding from an aliased import when identifying symbol references and SHALL distinguish actual re-export statements from ordinary imports regardless of whether their module specifier is relative.

#### Scenario: Aliased import is used by one of several symbols
- **WHEN** a file imports a target under an alias and contains multiple symbols
- **THEN** only symbols containing the aliased local binding are promoted to symbol references
- **AND** unrelated or merely first-ordered symbols remain excluded from symbol-reference results

#### Scenario: Module is re-exported through a barrel
- **WHEN** a file uses an export-from statement for a target symbol
- **THEN** Astrograph reports re-export evidence for that relationship
- **AND** an ordinary non-relative import is not reported as a re-export

### Requirement: Relationship changes produce comparable evidence

The performance workflow SHALL measure graph correctness before response cost using a deterministic fixture and exact token accounting.

#### Scenario: Maintainer evaluates relationship evidence
- **WHEN** equivalent before and after runs use the same fixture, task outcome, tokenizer, and privacy rules
- **THEN** at least three valid runs report relation recall, precision, false symbol claims, evidence coverage, confidence coverage, response tokens, and latency
- **AND** unstable ordering or an invalid task outcome rejects the run
- **AND** committed results contain no source-bearing payloads, prompts, raw client logs, or session identifiers
