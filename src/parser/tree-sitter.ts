import Parser from "tree-sitter";

import type { SummarySource, SummaryStrategy, SymbolKind } from "../types.ts";
import { LANGUAGE_ADAPTERS } from "./language-adapters.ts";
import {
  buildParsedFile,
  buildSymbolId,
  nodeText,
  normalizeWhitespace,
  type OwnedLineRange,
  parseCommentSummary,
  parseImportClauseSpecifiers,
  type ParsedFile,
  type ParsedImport,
  type ParsedSymbol,
  type ParseOffset,
  type ParseSourceInput,
  splitSourceIntoChunks,
} from "./shared.ts";

const parser = new Parser();
const CHUNK_RECOVERY_FALLBACK_REASON = "tree-sitter-chunk-recovery";

function isRecoverableParseFailure(error: unknown): boolean {
  return error instanceof Error && error.message === "Invalid argument";
}

function extractLeadingCommentSummary(
  node: Parser.SyntaxNode,
  sourceText: string,
): string | null {
  const prefix = sourceText.slice(0, node.startIndex);
  const match = prefix.match(
    /(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n[ \t]*\/\/[^\n]*)*)[ \t\r\n]*$/u,
  );

  if (!match) {
    return null;
  }

  const trailingWhitespaceMatch = match[0].match(/[ \t\r\n]*$/u);
  const trailingWhitespaceLength = trailingWhitespaceMatch?.[0].length ?? 0;
  const comment = match[0].slice(0, match[0].length - trailingWhitespaceLength).trim();
  const beforeComment = prefix.slice(0, prefix.length - match[0].length);
  const lastNewline = beforeComment.lastIndexOf("\n");
  const separator = beforeComment.slice(lastNewline + 1);
  if (separator.trim().length > 0) {
    return null;
  }

  return parseCommentSummary(comment);
}

function utf8ByteOffset(sourceText: string, stringOffset: number): number {
  return Buffer.byteLength(sourceText.slice(0, stringOffset), "utf8");
}

function resolveSummary(input: {
  node: Parser.SyntaxNode;
  sourceText: string;
  signature: string;
  summaryStrategy: SummaryStrategy;
}): { summary: string; summarySource: SummarySource } {
  if (input.summaryStrategy === "doc-comments-first") {
    const commentSummary = extractLeadingCommentSummary(input.node, input.sourceText);
    if (commentSummary) {
      return {
        summary: commentSummary,
        summarySource: "doc-comment",
      };
    }
  }

  return {
    summary: input.signature,
    summarySource: "signature",
  };
}

const NAME_NODE_TYPES = new Set([
  "identifier",
  "property_identifier",
  "type_identifier",
  "word",
  "function_name",
  "simple_name",
  "field_identifier",
  "string",
  "tag_name",
  "class_name",
  "name",
  "constant",
  "value_name",
  "variable",
]);

function findIdentifierDescendant(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
  for (const child of node.namedChildren) {
    if (NAME_NODE_TYPES.has(child.type)) return child;
    const nested = findIdentifierDescendant(child);
    if (nested) return nested;
  }
  return null;
}

function extractIdentifierName(node: Parser.SyntaxNode, sourceText: string): string | null {
  if (NAME_NODE_TYPES.has(node.type)) {
    const name = nodeText(sourceText, node.startIndex, node.endIndex);
    return node.type === "string" ? name.replace(/^"|"$/g, "") : name;
  }

  const nameNode =
    node.childForFieldName("name") ??
    node.namedChildren.find((child) =>
      NAME_NODE_TYPES.has(child.type),
    ) ??
    null;

  if (!nameNode) {
    const descendant = findIdentifierDescendant(node);
    return descendant ? extractIdentifierName(descendant, sourceText) : null;
  }

  const name = nodeText(sourceText, nameNode.startIndex, nameNode.endIndex);
  return nameNode.type === "string" ? name.replace(/^"|"$/g, "") : name;
}

function createSymbol(
  node: Parser.SyntaxNode,
  sourceText: string,
  relativePath: string,
  kind: SymbolKind,
  exported: boolean,
  summaryStrategy: SummaryStrategy,
  parentName?: string,
  rangeNode: Parser.SyntaxNode = node,
  offset: ParseOffset = { byte: 0, line: 0 },
): ParsedSymbol | null {
  const name = extractIdentifierName(node, sourceText);
  if (!name) {
    return null;
  }

  const signature = normalizeWhitespace(
    nodeText(sourceText, rangeNode.startIndex, rangeNode.endIndex),
  );
  const { summary, summarySource } = resolveSummary({
    node: rangeNode,
    sourceText,
    signature,
    summaryStrategy,
  });
  const qualifiedName = parentName ? `${parentName}.${name}` : name;
  const symbolStartByte = offset.byte + utf8ByteOffset(sourceText, node.startIndex);
  const rangeStartByte = offset.byte + utf8ByteOffset(sourceText, rangeNode.startIndex);
  const rangeEndByte = offset.byte + utf8ByteOffset(sourceText, rangeNode.endIndex);

  return {
    id: buildSymbolId(relativePath, kind, qualifiedName, symbolStartByte),
    name,
    qualifiedName,
    kind,
    signature,
    summary,
    summarySource,
    startLine: offset.line + rangeNode.startPosition.row + 1,
    endLine: offset.line + rangeNode.endPosition.row + 1,
    startByte: rangeStartByte,
    endByte: rangeEndByte,
    exported,
  };
}

function parseImport(
  node: Parser.SyntaxNode,
  sourceText: string,
): ParsedImport | null {
  const sourceNode = node.childForFieldName("source");
  if (!sourceNode) {
    return null;
  }

  const source = nodeText(sourceText, sourceNode.startIndex, sourceNode.endIndex)
    .replace(/^['"]|['"]$/g, "");
  const statementText = nodeText(sourceText, node.startIndex, node.endIndex);
  const clauseMatch =
    statementText.match(/^\s*import\s+([\s\S]+?)\s+from\s+['"]/u)
    ?? statementText.match(/^\s*export\s+([\s\S]+?)\s+from\s+['"]/u);
  const specifiers = clauseMatch
    ? parseImportClauseSpecifiers(clauseMatch[1] ?? "")
    : [];

  return {
    source,
    specifiers,
  };
}

function ownsNode(
  node: Parser.SyntaxNode,
  offset: ParseOffset,
  ownedLines?: OwnedLineRange,
): boolean {
  if (!ownedLines) {
    return true;
  }

  const startLine = offset.line + node.startPosition.row;
  return startLine >= ownedLines.start && startLine < ownedLines.end;
}

function pushVariableSymbols(
  node: Parser.SyntaxNode,
  sourceText: string,
  relativePath: string,
  exported: boolean,
  summaryStrategy: SummaryStrategy,
  symbols: ParsedSymbol[],
  rangeNode: Parser.SyntaxNode = node,
  offset: ParseOffset = { byte: 0, line: 0 },
  ownedLines?: OwnedLineRange,
) {
  for (const declarator of node.namedChildren.filter(
    (child) => child.type === "variable_declarator",
  )) {
    if (!ownsNode(declarator, offset, ownedLines)) {
      continue;
    }
    const symbol = createSymbol(
      declarator,
      sourceText,
      relativePath,
      "constant",
      exported,
      summaryStrategy,
      undefined,
      rangeNode,
      offset,
    );
    if (symbol) {
      symbols.push(symbol);
    }
  }
}

function pushClassMembers(
  node: Parser.SyntaxNode,
  sourceText: string,
  relativePath: string,
  className: string,
  summaryStrategy: SummaryStrategy,
  symbols: ParsedSymbol[],
  offset: ParseOffset = { byte: 0, line: 0 },
  ownedLines?: OwnedLineRange,
) {
  const body = node.childForFieldName("body") ?? node;

  for (const child of body.namedChildren) {
    if (
      [
        "method_definition",
        "function_definition",
        "class_method_definition",
        "method_declaration",
        "method",
      ].includes(child.type)
    ) {
      if (!ownsNode(child, offset, ownedLines)) {
        continue;
      }
      const symbol = createSymbol(
        child,
        sourceText,
        relativePath,
        "method",
        false,
        summaryStrategy,
        className,
        child,
        offset,
      );
      if (symbol) {
        symbols.push(symbol);
      }
    }
  }
}

function visitDeclarationNode(
  node: Parser.SyntaxNode,
  sourceText: string,
  relativePath: string,
  exported: boolean,
  summaryStrategy: SummaryStrategy,
  symbols: ParsedSymbol[],
  imports: ParsedImport[],
  rangeNode: Parser.SyntaxNode = node,
  offset: ParseOffset = { byte: 0, line: 0 },
  ownedLines?: OwnedLineRange,
) {
  switch (node.type) {
    case "function_declaration":
    case "function_definition":
    case "function_statement":
    case "function_item": {
      if (!ownsNode(node, offset, ownedLines)) {
        return;
      }
      const symbol = createSymbol(
        node,
        sourceText,
        relativePath,
        "function",
        exported,
        summaryStrategy,
        undefined,
        rangeNode,
        offset,
      );
      if (symbol) {
        symbols.push(symbol);
      }
      return;
    }
    case "value_definition":
    case "bind": {
      if (!ownsNode(node, offset, ownedLines)) return;
      const symbol = createSymbol(node, sourceText, relativePath, "function", exported, summaryStrategy, undefined, rangeNode, offset);
      if (symbol) symbols.push(symbol);
      return;
    }
    case "method": {
      if (!ownsNode(node, offset, ownedLines)) return;
      const symbol = createSymbol(node, sourceText, relativePath, "method", exported, summaryStrategy, undefined, rangeNode, offset);
      if (symbol) symbols.push(symbol);
      return;
    }
    case "class": {
      if (!ownsNode(node, offset, ownedLines)) return;
      const symbol = createSymbol(node, sourceText, relativePath, "class", exported, summaryStrategy, undefined, rangeNode, offset);
      if (symbol) {
        symbols.push(symbol);
        pushClassMembers(node, sourceText, relativePath, symbol.name, summaryStrategy, symbols, offset, ownedLines);
      }
      return;
    }
    case "class_specifier":
    case "struct_specifier": {
      if (!ownsNode(node, offset, ownedLines)) return;
      const symbol = createSymbol(node, sourceText, relativePath, "class", exported, summaryStrategy, undefined, rangeNode, offset);
      if (symbol) {
        symbols.push(symbol);
        pushClassMembers(node, sourceText, relativePath, symbol.name, summaryStrategy, symbols, offset, ownedLines);
      }
      return;
    }
    case "rule_set":
    case "element": {
      if (!ownsNode(node, offset, ownedLines)) return;
      const symbol = createSymbol(node, sourceText, relativePath, "constant", exported, summaryStrategy, undefined, rangeNode, offset);
      if (symbol) symbols.push(symbol);
      return;
    }
    case "class_declaration":
    case "class_definition":
    case "class_statement": {
      if (!ownsNode(node, offset, ownedLines)) {
        return;
      }
      const symbol = createSymbol(
        node,
        sourceText,
        relativePath,
        "class",
        exported,
        summaryStrategy,
        undefined,
        rangeNode,
        offset,
      );
      if (symbol) {
        symbols.push(symbol);
        pushClassMembers(
          node,
          sourceText,
          relativePath,
          symbol.name,
          summaryStrategy,
          symbols,
          offset,
          ownedLines,
        );
      }
      return;
    }
    case "struct_item": {
      if (!ownsNode(node, offset, ownedLines)) {
        return;
      }
      const symbol = createSymbol(
        node,
        sourceText,
        relativePath,
        "class",
        exported,
        summaryStrategy,
        undefined,
        rangeNode,
        offset,
      );
      if (symbol) {
        symbols.push(symbol);
      }
      return;
    }
    case "method_declaration": {
      if (!ownsNode(node, offset, ownedLines)) {
        return;
      }
      const symbol = createSymbol(
        node,
        sourceText,
        relativePath,
        "method",
        exported,
        summaryStrategy,
        undefined,
        rangeNode,
        offset,
      );
      if (symbol) {
        symbols.push(symbol);
      }
      return;
    }
    case "pair": {
      if (!ownsNode(node, offset, ownedLines)) {
        return;
      }
      const symbol = createSymbol(
        node,
        sourceText,
        relativePath,
        "constant",
        exported,
        summaryStrategy,
        undefined,
        rangeNode,
        offset,
      );
      if (symbol) {
        symbols.push(symbol);
      }
      return;
    }
    case "interface_declaration":
    case "type_alias_declaration":
    case "enum_declaration":
    case "struct_declaration": {
      if (!ownsNode(node, offset, ownedLines)) {
        return;
      }
      const symbol = createSymbol(
        node,
        sourceText,
        relativePath,
        "type",
        exported,
        summaryStrategy,
        undefined,
        rangeNode,
        offset,
      );
      if (symbol) {
        symbols.push(symbol);
      }
      return;
    }
    case "lexical_declaration":
    case "variable_declaration": {
      pushVariableSymbols(
        node,
        sourceText,
        relativePath,
        exported,
        summaryStrategy,
        symbols,
        rangeNode,
        offset,
        ownedLines,
      );
      return;
    }
    case "import_statement": {
      if (!ownsNode(node, offset, ownedLines)) {
        return;
      }
      const parsedImport = parseImport(node, sourceText);
      if (parsedImport) {
        imports.push(parsedImport);
      }
      return;
    }
    default:
      return;
  }
}

function visitNode(
  node: Parser.SyntaxNode,
  sourceText: string,
  relativePath: string,
  exported: boolean,
  summaryStrategy: SummaryStrategy,
  symbols: ParsedSymbol[],
  imports: ParsedImport[],
  offset: ParseOffset = { byte: 0, line: 0 },
  ownedLines?: OwnedLineRange,
) {
  switch (node.type) {
    case "export_statement": {
      const parsedImport = parseImport(node, sourceText);
      if (parsedImport) {
        imports.push(parsedImport);
      }
      for (const child of node.namedChildren) {
        visitDeclarationNode(
          child,
          sourceText,
          relativePath,
          true,
          summaryStrategy,
          symbols,
          imports,
          node,
          offset,
          ownedLines,
        );
      }
      return;
    }
    default:
      visitDeclarationNode(
        node,
        sourceText,
        relativePath,
        exported,
        summaryStrategy,
        symbols,
        imports,
        node,
        offset,
        ownedLines,
      );
  }
}

const STRUCTURED_DECLARATION_NODE_TYPES = new Set([
  "function_definition",
  "function_statement",
  "function_declaration",
  "function_item",
  "class_declaration",
  "class_definition",
  "class_statement",
  "interface_declaration",
  "enum_declaration",
  "struct_declaration",
  "struct_item",
  "method_declaration",
  "pair",
  "class_specifier",
  "struct_specifier",
  "rule_set",
  "element",
  "class",
  "method",
  "value_definition",
  "bind",
]);

function visitStructuredNode(
  node: Parser.SyntaxNode,
  sourceText: string,
  relativePath: string,
  summaryStrategy: SummaryStrategy,
  symbols: ParsedSymbol[],
  imports: ParsedImport[],
) {
  if (STRUCTURED_DECLARATION_NODE_TYPES.has(node.type)) {
    visitDeclarationNode(
      node,
      sourceText,
      relativePath,
      false,
      summaryStrategy,
      symbols,
      imports,
    );
    return;
  }

  for (const child of node.namedChildren) {
    visitStructuredNode(child, sourceText, relativePath, summaryStrategy, symbols, imports);
  }
}

export function parseWithTreeSitter(input: ParseSourceInput): ParsedFile {
  const adapter = LANGUAGE_ADAPTERS[input.language];
  parser.setLanguage(adapter.grammar);
  const symbols: ParsedSymbol[] = [];
  const imports: ParsedImport[] = [];
  const summaryStrategy = input.summaryStrategy ?? "doc-comments-first";
  let chunkRecoveryUsed = false;

  try {
    const tree = parser.parse(input.content);
    for (const child of tree.rootNode.namedChildren) {
      if (adapter.traversal === "javascript") {
        visitNode(
          child,
          input.content,
          input.relativePath,
          false,
          summaryStrategy,
          symbols,
          imports,
        );
      } else {
        visitStructuredNode(
          child,
          input.content,
          input.relativePath,
          summaryStrategy,
          symbols,
          imports,
        );
      }
    }
  } catch (error) {
    if (!isRecoverableParseFailure(error)) {
      throw error;
    }

    chunkRecoveryUsed = true;
    for (const chunk of splitSourceIntoChunks(input.content)) {
      try {
        const tree = parser.parse(chunk.content);
        for (const child of tree.rootNode.namedChildren) {
          visitNode(
            child,
            chunk.content,
            input.relativePath,
            false,
            summaryStrategy,
            symbols,
            imports,
            {
              byte: chunk.byte,
              line: chunk.line,
            },
            {
              start: chunk.start,
              end: chunk.end,
            },
          );
        }
      } catch (chunkError) {
        if (!isRecoverableParseFailure(chunkError)) {
          throw chunkError;
        }
      }
    }
  }

  return buildParsedFile({
    language: input.language,
    content: input.content,
    symbols,
    imports,
    backend: "tree-sitter",
    fallbackUsed: chunkRecoveryUsed,
    fallbackReason: chunkRecoveryUsed ? CHUNK_RECOVERY_FALLBACK_REASON : null,
  });
}
