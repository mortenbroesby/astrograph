# Language Support

Astrograph uses static, pinned Tree-sitter WebAssembly grammars. A language is
exposed only after its packaged grammar loads without a native addon and a
fixture proves deterministic symbols and ranges.

The runtime is `web-tree-sitter@0.25.10` and its static assets come from
`tree-sitter-wasm@1.0.7` (both MIT). Grammar identities below are the pinned
asset names resolved by Astrograph; they are not network downloads or a promise
to support every upstream Tree-sitter grammar.

## Support tiers

- **Graph:** JavaScript and TypeScript family files support Astrograph's full
  symbol, outline, and dependency-graph retrieval.
- **Structured:** the language is discovered and parsed into deterministic
  symbols for file summaries, but Astrograph does not claim import/relation
  graph support. Use text search when cross-file relations matter.
- **Discovery:** unsupported or fallback files remain searchable as text.

## Supported languages

| Tier | Language | Extensions | Grammar asset |
| --- | --- | --- | --- |
| Graph | TypeScript | `.ts` | `typescript` |
| Graph | TSX | `.tsx` | `tsx` |
| Graph | JavaScript | `.js`, `.cjs`, `.mjs` | `javascript` |
| Graph | JSX | `.jsx` | `javascript` |
| Structured | Python | `.py`, `.pyi` | `python` |
| Structured | Bash | `.sh`, `.bash`, `.zsh` | `bash` |
| Structured | PowerShell | `.ps1`, `.psm1`, `.psd1` | `powershell` |
| Structured | C# | `.cs` | `c_sharp` |
| Structured | Java | `.java` | `java` |
| Structured | Go | `.go` | `go` |
| Structured | Rust | `.rs` | `rust` |
| Structured | JSON | `.json` | `json` |
| Structured | HTML | `.html`, `.htm` | `html` |
| Structured | CSS | `.css` | `css` |
| Structured | C | `.c`, `.h` | `c` |
| Structured | C++ | `.cc`, `.cpp`, `.cxx`, `.hh`, `.hpp`, `.hxx` | `cpp` |
| Structured | PHP | `.php` | `php` |
| Structured | Ruby | `.rb`, `.rake`, `.gemspec` | `ruby` |
| Structured | ERB/EJS | `.erb`, `.ejs` | `embedded_template` |
| Structured | Scala | `.scala`, `.sc` | `scala` |

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

These exclusions are recorded in the completed
[legacy polyglot support contract](../../specs-legacy/implementation/closed/tree-sitter-polyglot-support-contract.md)
and can be reconsidered only with compatible runtime evidence and a user-facing
file contract.
