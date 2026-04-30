import { hashString } from "./hash.ts";
import { parseSourceFile } from "./parser.ts";
import type { ParsedFile } from "./parser.ts";
import type { ImportSpecifier, SummaryStrategy, SupportedLanguage } from "./types.ts";

export interface FileAnalysisTaskInput {
  relativePath: string;
  language: SupportedLanguage;
  content: string;
  summaryStrategy?: SummaryStrategy;
}

export interface FileAnalysisTaskOutput {
  parsed: ParsedFile;
  symbolSignatureHash: string;
  importHash: string;
}

function hashSymbolSignatures(
  symbols: Array<{
    id: string;
    signature: string;
  }>,
): string {
  return hashString(
    JSON.stringify(symbols.map((symbol) => [symbol.id, symbol.signature])),
    "symbol_signature",
  );
}

function hashImports(
  imports: Array<{
    source: string;
    specifiers: ImportSpecifier[];
  }>,
): string {
  return hashString(
    JSON.stringify(
      imports.map((entry) => [
        entry.source,
        [...entry.specifiers]
          .map((specifier) => [
            specifier.kind,
            specifier.importedName,
            specifier.localName,
          ])
          .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
      ]),
    ),
    "import_graph",
  );
}

export function analyzeFileContent(
  input: FileAnalysisTaskInput,
): FileAnalysisTaskOutput {
  const parsed = parseSourceFile({
    relativePath: input.relativePath,
    content: input.content,
    language: input.language,
    summaryStrategy: input.summaryStrategy,
  });

  return {
    parsed,
    symbolSignatureHash: hashSymbolSignatures(parsed.symbols),
    importHash: hashImports(parsed.imports),
  };
}
