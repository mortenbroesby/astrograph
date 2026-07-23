# Language Support

Astrograph uses static, pinned Tree-sitter grammars. A language is exposed only
after its grammar loads in the supported Node binding and a fixture proves
deterministic symbols and ranges.

## Support tiers

- **Graph:** JavaScript and TypeScript family files support Astrograph's full
  symbol, outline, and dependency-graph retrieval.
- **Structured:** the language is discovered and parsed into deterministic
  symbols for file summaries, but Astrograph does not claim import/relation
  graph support. Use text search when cross-file relations matter.
- **Discovery:** unsupported or fallback files remain searchable as text.

## Supported languages

| Tier | Language | Extensions |
| --- | --- | --- |
| Graph | TypeScript | `.ts` |
| Graph | TSX | `.tsx` |
| Graph | JavaScript | `.js`, `.cjs`, `.mjs` |
| Graph | JSX | `.jsx` |
| Structured | Python | `.py`, `.pyi` |
| Structured | Bash | `.sh`, `.bash`, `.zsh` |
| Structured | PowerShell | `.ps1`, `.psm1`, `.psd1` |
| Structured | C# | `.cs` |
| Structured | Java | `.java` |
| Structured | Go | `.go` |
| Structured | Rust | `.rs` |
| Structured | JSON | `.json` |
| Structured | HTML | `.html`, `.htm` |
| Structured | CSS | `.css` |
| Structured | C | `.c`, `.h` |
| Structured | C++ | `.cc`, `.cpp`, `.cxx`, `.hh`, `.hpp`, `.hxx` |
| Structured | PHP | `.php` |
| Structured | Ruby | `.rb`, `.rake`, `.gemspec` |
| Structured | ERB/EJS | `.erb`, `.ejs` |
| Structured | Scala | `.scala`, `.sc` |
| Structured | OCaml | `.ml` |
| Structured | Haskell | `.hs`, `.lhs` |
| Structured | Julia | `.jl` |

JSON emits top-level keys only to avoid noisy duplicate configuration symbols.
ERB/EJS parsing is currently structure-only; embedded template text does not
produce invented symbols.

## Deliberate exclusions

Tree-sitter's upstream parser catalog is not a blanket promise that every
grammar package will work in every Node binding. Astrograph currently excludes:

- **Agda** and **Verilog:** their tested Node packages were rejected as invalid
  language objects by `tree-sitter@0.25.0`.
- **Regex** and **JSDoc:** they parse in isolation but do not have a stable,
  standalone file-extension contract in Astrograph; JSDoc is normally embedded
  in JavaScript-family comments.

These exclusions are recorded in the active implementation checklist and can
be reconsidered only with compatible runtime evidence and a user-facing file
contract.
