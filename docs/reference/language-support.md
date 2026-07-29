# Language Support

Astrograph uses static, pinned Tree-sitter WebAssembly grammars. A language is
exposed only after its packaged grammar loads without a native addon and a
fixture proves deterministic symbols and ranges.

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

JSON emits top-level keys only to avoid noisy duplicate configuration symbols.
ERB/EJS parsing is currently structure-only; embedded template text does not
produce invented symbols.

## Deliberate exclusions

Tree-sitter's upstream parser catalog is not a blanket promise that every
grammar has a useful Astrograph file contract. Astrograph currently excludes:

- **Agda** and **Verilog:** they are outside the selected product language set;
  do not add them without a package-size review and fixture-backed contract.
- **Regex** and **JSDoc:** they parse in isolation but do not have a stable,
  standalone file-extension contract in Astrograph; JSDoc is normally embedded
  in JavaScript-family comments.
- **OCaml**, **Haskell**, and **Julia:** intentionally excluded from the
  default Java/.NET/React-oriented product set. They can be reconsidered as
  separate specialist language packs after a package-size and fixture review.

These exclusions are recorded in the active implementation checklist and can
be reconsidered only with compatible runtime evidence and a user-facing file
contract.
