import { createHash } from "node:crypto";

import Parser from "tree-sitter";
import javascript from "tree-sitter-javascript";
import tsLanguages from "tree-sitter-typescript";
import { parseSync as parseOxcSync } from "oxc-parser";

import { hashString } from "./hash.ts";
import {
  getLanguageSupport,
  supportedLanguageForFile as supportedLanguageForFileFromRegistry,
} from "./language-registry.ts";
import type {
  ImportSpecifier,
  SummarySource,
  SummaryStrategy,
  SupportedLanguage,
  SymbolKind,
} from "./types.ts";

interface ParsedImport {
  source: string;
  specifiers: ImportSpecifier[];
}

interface ParsedSymbol {
  id: string;
  name: string;
  qualifiedName: string | null;
  kind: SymbolKind;
  signature: string;
  summary: string;
  summarySource: SummarySource;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
  exported: boolean;
}

export interface ParsedFile {
  language: SupportedLanguage;
  contentHash: string;
  integrityHash: string;
  symbols: ParsedSymbol[];
  imports: ParsedImport[];
  backend: "oxc" | "tree-sitter";
  fallbackUsed: boolean;
  fallbackReason: string | null;
}

const parser = new Parser();
const MAX_PARSE_BYTES = 24_000;
const TARGET_CHUNK_BYTES = 16_000;
const CHUNK_OVERLAP_BYTES = 8_000;

interface ParseOffset {
  byte: number;
  line: number;
}

interface OwnedLineRange {
  start: number;
  end: number;
}

interface SourceChunk extends ParseOffset, OwnedLineRange {
  content: string;
}

function isRecoverableParseFailure(error: unknown): boolean {
  return error instanceof Error && error.message === "Invalid argument";
}

function languageFor(language: SupportedLanguage) {
  switch (getLanguageSupport(language).language) {
    case "ts":
      return tsLanguages.typescript;
    case "tsx":
      return tsLanguages.tsx;
    case "js":
    case "jsx":
      return javascript;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function nodeText(sourceText: string, startByte: number, endByte: number): string {
  return sourceText.slice(startByte, endByte);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseCommentSummary(comment: string): string | null {
  const normalized = comment.startsWith("/*")
    ? comment
        .replace(/^\/\*+\s?/, "")
        .replace(/\*\/$/, "")
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, "").trim())
        .filter(Boolean)
    : comment
        .split("\n")
        .map((line) => line.replace(/^\s*\/\/+\s?/, "").trim())
        .filter(Boolean);

  const firstLine = normalized[0];
  return firstLine ? normalizeWhitespace(firstLine) : null;
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

function extractIdentifierName(node: Parser.SyntaxNode, sourceText: string): string | null {
  const nameNode =
    node.childForFieldName("name") ??
    node.namedChildren.find((child) =>
      [
        "identifier",
        "property_identifier",
        "type_identifier",
      ].includes(child.type),
    ) ??
    null;

  if (!nameNode) {
    return null;
  }

  return nodeText(sourceText, nameNode.startIndex, nameNode.endIndex);
}

function buildSymbolId(
  relativePath: string,
  kind: SymbolKind,
  name: string,
  startByte: number,
): string {
  return sha256(`${relativePath}:${kind}:${name}:${startByte}`).slice(0, 16);
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

  return {
    id: buildSymbolId(relativePath, kind, qualifiedName, offset.byte + node.startIndex),
    name,
    qualifiedName,
    kind,
    signature,
    summary,
    summarySource,
    startLine: offset.line + rangeNode.startPosition.row + 1,
    endLine: offset.line + rangeNode.endPosition.row + 1,
    startByte: offset.byte + rangeNode.startIndex,
    endByte: offset.byte + rangeNode.endIndex,
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
  const clauseMatch = statementText.match(/^\s*import\s+([\s\S]+?)\s+from\s+['"]/u);
  const specifiers = clauseMatch
    ? parseImportClauseSpecifiers(clauseMatch[1] ?? "")
    : [];

  return {
    source,
    specifiers,
  };
}

function parseNamedImportSpecifiers(value: string): ImportSpecifier[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^type\s+/u, "").trim())
    .filter(Boolean)
    .map((entry) => {
      const aliasMatch = entry.match(/^(.+?)\s+as\s+(.+)$/u);
      if (aliasMatch) {
        return {
          kind: "named",
          importedName: aliasMatch[1]!.trim(),
          localName: aliasMatch[2]!.trim(),
        } satisfies ImportSpecifier;
      }

      return {
        kind: "named",
        importedName: entry,
        localName: entry,
      } satisfies ImportSpecifier;
    });
}

function parseImportClauseSpecifiers(clause: string): ImportSpecifier[] {
  const trimmedClause = clause.trim().replace(/^type\s+/u, "");
  if (!trimmedClause) {
    return [];
  }

  const namedStart = trimmedClause.indexOf("{");
  const namedEnd = trimmedClause.lastIndexOf("}");
  const specifiers: ImportSpecifier[] = [];

  if (namedStart >= 0 && namedEnd > namedStart) {
    const namedClause = trimmedClause.slice(namedStart + 1, namedEnd);
    specifiers.push(...parseNamedImportSpecifiers(namedClause));
  }

  const namespaceMatch = trimmedClause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/u);
  if (namespaceMatch) {
    specifiers.push({
      kind: "namespace",
      importedName: "*",
      localName: namespaceMatch[1] ?? null,
    });
  }

  const defaultClause = trimmedClause
    .split(",")[0]
    ?.trim()
    .replace(/^type\s+/u, "");
  if (
    defaultClause
    && !defaultClause.startsWith("{")
    && !defaultClause.startsWith("*")
  ) {
    specifiers.unshift({
      kind: "default",
      importedName: "default",
      localName: defaultClause,
    });
  }

  return specifiers;
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
  const body = node.childForFieldName("body");
  if (!body) {
    return;
  }

  for (const child of body.namedChildren) {
    if (child.type === "method_definition") {
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
    case "function_declaration": {
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
    case "class_declaration": {
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
    case "interface_declaration":
    case "type_alias_declaration":
    case "enum_declaration": {
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

function splitSourceIntoChunks(sourceText: string): SourceChunk[] {
  const lines = sourceText.split("\n");

  if (sourceText.length <= MAX_PARSE_BYTES) {
    return [
      {
        content: sourceText,
        byte: 0,
        line: 0,
        start: 0,
        end: lines.length,
      },
    ];
  }

  const lineOffsets: number[] = [];
  let totalBytes = 0;
  for (let index = 0; index < lines.length; index += 1) {
    lineOffsets.push(totalBytes);
    totalBytes += lines[index].length + (index < lines.length - 1 ? 1 : 0);
  }

  const bytesBetween = (startLine: number, endLine: number) => {
    if (startLine >= endLine) {
      return 0;
    }
    const startByte = lineOffsets[startLine] ?? totalBytes;
    const endByte = endLine < lines.length ? lineOffsets[endLine] : totalBytes;
    return endByte - startByte;
  };

  const chunks: SourceChunk[] = [];
  let ownedStart = 0;

  while (ownedStart < lines.length) {
    let ownedEnd = ownedStart + 1;
    while (
      ownedEnd < lines.length &&
      bytesBetween(ownedStart, ownedEnd) < TARGET_CHUNK_BYTES
    ) {
      ownedEnd += 1;
    }

    let parseStart = ownedStart;
    while (
      parseStart > 0 &&
      bytesBetween(parseStart - 1, ownedEnd) <= MAX_PARSE_BYTES &&
      bytesBetween(parseStart - 1, ownedStart) <= CHUNK_OVERLAP_BYTES
    ) {
      parseStart -= 1;
    }

    let parseEnd = ownedEnd;
    while (
      parseEnd < lines.length &&
      bytesBetween(parseStart, parseEnd + 1) <= MAX_PARSE_BYTES &&
      bytesBetween(ownedEnd, parseEnd + 1) <= CHUNK_OVERLAP_BYTES
    ) {
      parseEnd += 1;
    }

    const content = lines.slice(parseStart, parseEnd).join("\n");
    if (content.length > 0) {
      chunks.push({
        content,
        byte: lineOffsets[parseStart] ?? 0,
        line: parseStart,
        start: ownedStart,
        end: ownedEnd,
      });
    }

    ownedStart = ownedEnd;
  }

  return chunks;
}

function buildLineOffsets(sourceText: string): number[] {
  const offsets = [0];
  for (let index = 0; index < sourceText.length; index += 1) {
    if (sourceText[index] === "\n") {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function lineFromOffset(lineOffsets: number[], offset: number): number {
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const current = lineOffsets[middle];
    const next = lineOffsets[middle + 1] ?? Number.POSITIVE_INFINITY;

    if (offset < current) {
      high = middle - 1;
      continue;
    }

    if (offset >= next) {
      low = middle + 1;
      continue;
    }

    return middle + 1;
  }

  return lineOffsets.length;
}

function parseCommentSummaryFromValue(
  comment: { type: "Line" | "Block"; value: string },
): string | null {
  const normalized = comment.type === "Block"
    ? comment.value
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, "").trim())
        .filter(Boolean)
    : comment.value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

  const firstLine = normalized[0];
  return firstLine ? normalizeWhitespace(firstLine) : null;
}

function extractLeadingOxcCommentSummary(input: {
  comments: Array<{ type: "Line" | "Block"; value: string; start: number; end: number }>;
  sourceText: string;
  startByte: number;
}): string | null {
  const candidate = input.comments
    .filter((comment) => comment.end <= input.startByte)
    .at(-1);

  if (!candidate) {
    return null;
  }

  const between = input.sourceText.slice(candidate.end, input.startByte);
  if (between.trim().length > 0) {
    return null;
  }

  const beforeComment = input.sourceText.slice(0, candidate.start);
  const lastNewline = beforeComment.lastIndexOf("\n");
  const separator = beforeComment.slice(lastNewline + 1);
  if (separator.trim().length > 0) {
    return null;
  }

  return parseCommentSummaryFromValue(candidate);
}

function createOxcSymbol(input: {
  sourceText: string;
  relativePath: string;
  kind: SymbolKind;
  name: string;
  startByte: number;
  endByte: number;
  exported: boolean;
  lineOffsets: number[];
  summaryStrategy: SummaryStrategy;
  comments: Array<{ type: "Line" | "Block"; value: string; start: number; end: number }>;
  qualifiedName?: string | null;
}): ParsedSymbol {
  const signature = normalizeWhitespace(
    nodeText(input.sourceText, input.startByte, input.endByte),
  );
  const commentSummary = input.summaryStrategy === "doc-comments-first"
    ? extractLeadingOxcCommentSummary({
        comments: input.comments,
        sourceText: input.sourceText,
        startByte: input.startByte,
      })
    : null;

  return {
    id: buildSymbolId(
      input.relativePath,
      input.kind,
      input.qualifiedName ?? input.name,
      input.startByte,
    ),
    name: input.name,
    qualifiedName: input.qualifiedName ?? null,
    kind: input.kind,
    signature,
    summary: commentSummary ?? signature,
    summarySource: commentSummary ? "doc-comment" : "signature",
    startLine: lineFromOffset(input.lineOffsets, input.startByte),
    endLine: lineFromOffset(
      input.lineOffsets,
      Math.max(input.startByte, input.endByte - 1),
    ),
    startByte: input.startByte,
    endByte: input.endByte,
    exported: input.exported,
  };
}

function updateExportedSymbol(
  symbols: ParsedSymbol[],
  localName: string,
): boolean {
  let updated = false;
  for (const symbol of symbols) {
    if (symbol.name === localName || symbol.qualifiedName === localName) {
      symbol.exported = true;
      updated = true;
    }
  }
  return updated;
}

function createSyntheticOxcExportSymbol(input: {
  sourceText: string;
  relativePath: string;
  name: string;
  exportedName?: string | null;
  kind?: SymbolKind;
  startByte: number;
  endByte: number;
  lineOffsets: number[];
  summaryStrategy: SummaryStrategy;
  comments: Array<{ type: "Line" | "Block"; value: string; start: number; end: number }>;
}): ParsedSymbol {
  const exportedName = input.exportedName ?? input.name;
  return createOxcSymbol({
    sourceText: input.sourceText,
    relativePath: input.relativePath,
    kind: input.kind ?? "constant",
    name: exportedName,
    qualifiedName: exportedName,
    startByte: input.startByte,
    endByte: input.endByte,
    exported: true,
    lineOffsets: input.lineOffsets,
    summaryStrategy: input.summaryStrategy,
    comments: input.comments,
  });
}

function collectOxcClassMembers(input: {
  node: any;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: Array<{ type: "Line" | "Block"; value: string; start: number; end: number }>;
  lineOffsets: number[];
  className: string;
}): ParsedSymbol[] {
  const members = input.node?.body?.body;
  if (!Array.isArray(members)) {
    return [];
  }

  return members.flatMap((member) => {
    if (member?.type === "MethodDefinition" && member.key?.type === "Identifier") {
      const memberName =
        member.kind === "constructor"
          ? "constructor"
          : member.key.name;
      return [
        createOxcSymbol({
          sourceText: input.sourceText,
          relativePath: input.relativePath,
          kind: "method",
          name: memberName,
          qualifiedName: `${input.className}.${memberName}`,
          startByte: member.start,
          endByte: member.end,
          exported: false,
          lineOffsets: input.lineOffsets,
          summaryStrategy: input.summaryStrategy,
          comments: input.comments,
        }),
      ];
    }

    if (
      (member?.type === "PropertyDefinition" || member?.type === "AccessorProperty")
      && member.key?.type === "Identifier"
    ) {
      return [
        createOxcSymbol({
          sourceText: input.sourceText,
          relativePath: input.relativePath,
          kind: "constant",
          name: member.key.name,
          qualifiedName: `${input.className}.${member.key.name}`,
          startByte: member.start,
          endByte: member.end,
          exported: false,
          lineOffsets: input.lineOffsets,
          summaryStrategy: input.summaryStrategy,
          comments: input.comments,
        }),
      ];
    }

    return [];
  });
}

function collectOxcObjectMembers(input: {
  objectName: string;
  objectNode: any;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: Array<{ type: "Line" | "Block"; value: string; start: number; end: number }>;
  lineOffsets: number[];
  exported: boolean;
}): ParsedSymbol[] {
  const properties = input.objectNode?.properties;
  if (!Array.isArray(properties)) {
    return [];
  }

  return properties.flatMap((property) => {
    if (property?.key?.type !== "Identifier") {
      return [];
    }

    const propertyName = property.key.name;
    const isMethod =
      property.type === "Property"
        ? property.method === true
          || property.value?.type === "ArrowFunctionExpression"
          || property.value?.type === "FunctionExpression"
        : property.type === "ObjectMethod";

    if (!isMethod) {
      return [];
    }

    return [
      createOxcSymbol({
        sourceText: input.sourceText,
        relativePath: input.relativePath,
        kind: "method",
        name: propertyName,
        qualifiedName: `${input.objectName}.${propertyName}`,
        startByte: property.start,
        endByte: property.end,
        exported: input.exported,
        lineOffsets: input.lineOffsets,
        summaryStrategy: input.summaryStrategy,
        comments: input.comments,
      }),
    ];
  });
}

function collectOxcVariableSymbols(input: {
  node: any;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: Array<{ type: "Line" | "Block"; value: string; start: number; end: number }>;
  lineOffsets: number[];
  exported: boolean;
  rangeStart: number;
  rangeEnd: number;
}): ParsedSymbol[] {
  const declarations = input.node?.declarations;
  if (!Array.isArray(declarations)) {
    return [];
  }

  return declarations.flatMap((declarator) => {
    if (declarator?.id?.type !== "Identifier") {
      return [];
    }

    const variableSymbol = createOxcSymbol({
      sourceText: input.sourceText,
      relativePath: input.relativePath,
      kind: "constant",
      name: declarator.id.name,
      startByte: input.rangeStart,
      endByte: input.rangeEnd,
      exported: input.exported,
      lineOffsets: input.lineOffsets,
      summaryStrategy: input.summaryStrategy,
      comments: input.comments,
    });
    const objectMembers =
      declarator.init?.type === "ObjectExpression"
        ? collectOxcObjectMembers({
            objectName: declarator.id.name,
            objectNode: declarator.init,
            sourceText: input.sourceText,
            relativePath: input.relativePath,
            summaryStrategy: input.summaryStrategy,
            comments: input.comments,
            lineOffsets: input.lineOffsets,
            exported: input.exported,
          })
        : [];

    return [
      variableSymbol,
      ...objectMembers,
    ];
  });
}

function collectOxcImports(moduleInfo: any): ParsedImport[] {
  const staticImports = moduleInfo?.staticImports;
  if (!Array.isArray(staticImports)) {
    return [];
  }

  return staticImports.map((entry) => ({
    source: entry.moduleRequest?.value ?? "",
    specifiers: Array.isArray(entry.entries)
      ? entry.entries
          .map((specifier: any) => {
            const kind = specifier.importName?.kind;
            if (kind === "Name") {
              return {
                kind: "named",
                importedName: specifier.importName?.name ?? "",
                localName: specifier.localName?.value ?? specifier.localName?.name ?? null,
              } satisfies ImportSpecifier;
            }
            if (kind === "Default") {
              return {
                kind: "default",
                importedName: "default",
                localName: specifier.localName?.value ?? specifier.localName?.name ?? null,
              } satisfies ImportSpecifier;
            }
            if (kind === "NamespaceObject") {
              return {
                kind: "namespace",
                importedName: "*",
                localName: specifier.localName?.value ?? specifier.localName?.name ?? null,
              } satisfies ImportSpecifier;
            }
            return {
              kind: "unknown",
              importedName:
                specifier.importName?.name
                ?? specifier.localName?.value
                ?? specifier.localName?.name
                ?? "",
              localName: specifier.localName?.value ?? specifier.localName?.name ?? null,
            } satisfies ImportSpecifier;
          })
          .filter((specifier: ImportSpecifier) => specifier.importedName.length > 0)
      : [],
  }));
}

function appendOxcReExportImport(
  imports: ParsedImport[],
  statement: any,
) {
  const source = statement?.source?.value;
  if (typeof source !== "string" || source.length === 0) {
    return;
  }

  const specifiers = Array.isArray(statement?.specifiers)
    ? statement.specifiers
        .map((specifier: any) =>
          ({
            kind: "named",
            importedName:
              specifier.local?.name
              ?? specifier.local?.value
              ?? specifier.exported?.name
              ?? specifier.exported?.value
              ?? "",
            localName:
              specifier.exported?.name
              ?? specifier.exported?.value
              ?? specifier.local?.name
              ?? specifier.local?.value
              ?? null,
          }) satisfies ImportSpecifier,
        )
        .filter((specifier: ImportSpecifier) => specifier.importedName.length > 0)
    : [];

  imports.push({ source, specifiers });
}

function collectOxcDeclarationSymbols(input: {
  node: any;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: Array<{ type: "Line" | "Block"; value: string; start: number; end: number }>;
  lineOffsets: number[];
  exported: boolean;
  rangeStart: number;
  rangeEnd: number;
}): ParsedSymbol[] {
  switch (input.node?.type) {
    case "FunctionDeclaration": {
      const name = input.node.id?.name;
      if (!name) {
        return [];
      }
      return [
        createOxcSymbol({
          sourceText: input.sourceText,
          relativePath: input.relativePath,
          kind: "function",
          name,
          startByte: input.rangeStart,
          endByte: input.rangeEnd,
          exported: input.exported,
          lineOffsets: input.lineOffsets,
          summaryStrategy: input.summaryStrategy,
          comments: input.comments,
        }),
      ];
    }
    case "ClassDeclaration": {
      const name = input.node.id?.name;
      if (!name) {
        return [];
      }
      const classSymbol = createOxcSymbol({
        sourceText: input.sourceText,
        relativePath: input.relativePath,
        kind: "class",
        name,
        startByte: input.rangeStart,
        endByte: input.rangeEnd,
        exported: input.exported,
        lineOffsets: input.lineOffsets,
        summaryStrategy: input.summaryStrategy,
        comments: input.comments,
      });
      return [
        classSymbol,
        ...collectOxcClassMembers({
          node: input.node,
          sourceText: input.sourceText,
          relativePath: input.relativePath,
          summaryStrategy: input.summaryStrategy,
          comments: input.comments,
          lineOffsets: input.lineOffsets,
          className: name,
        }),
      ];
    }
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
    case "TSEnumDeclaration": {
      const name = input.node.id?.name;
      if (!name) {
        return [];
      }
      return [
        createOxcSymbol({
          sourceText: input.sourceText,
          relativePath: input.relativePath,
          kind: "type",
          name,
          startByte: input.rangeStart,
          endByte: input.rangeEnd,
          exported: input.exported,
          lineOffsets: input.lineOffsets,
          summaryStrategy: input.summaryStrategy,
          comments: input.comments,
        }),
      ];
    }
    case "TSModuleDeclaration": {
      const name =
        input.node.id?.name
        ?? input.node.id?.value;
      if (!name) {
        return [];
      }
      const namespaceSymbol = createOxcSymbol({
        sourceText: input.sourceText,
        relativePath: input.relativePath,
        kind: "type",
        name,
        startByte: input.rangeStart,
        endByte: input.rangeEnd,
        exported: input.exported,
        lineOffsets: input.lineOffsets,
        summaryStrategy: input.summaryStrategy,
        comments: input.comments,
      });
      const bodyStatements = input.node.body?.body;
      const nested = Array.isArray(bodyStatements)
        ? bodyStatements.flatMap((statement: any) => {
            const targetNode =
              statement?.type === "ExportNamedDeclaration" && statement.declaration
                ? statement.declaration
                : statement;
            const nestedSymbols = collectOxcDeclarationSymbols({
              ...input,
              node: targetNode,
              exported: input.exported || statement?.type === "ExportNamedDeclaration",
              rangeStart: statement.start,
              rangeEnd: statement.end,
            });
            return nestedSymbols.map((symbol) => {
              const baseName = symbol.qualifiedName ?? symbol.name;
              return {
                ...symbol,
                qualifiedName: `${name}.${baseName}`,
              };
            });
          })
        : [];
      return [namespaceSymbol, ...nested];
    }
    case "VariableDeclaration":
      return collectOxcVariableSymbols(input);
    default:
      return [];
  }
}

function collectOxcExportSpecifiers(input: {
  statement: any;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: Array<{ type: "Line" | "Block"; value: string; start: number; end: number }>;
  lineOffsets: number[];
  symbols: ParsedSymbol[];
}): ParsedSymbol[] {
  const specifiers = Array.isArray(input.statement?.specifiers)
    ? input.statement.specifiers
    : [];
  const syntheticSymbols: ParsedSymbol[] = [];
  const isReExport = Boolean(input.statement?.source);

  for (const specifier of specifiers) {
    const localName = specifier.local?.name ?? specifier.local?.value;
    const exportedName = specifier.exported?.name ?? specifier.exported?.value ?? localName;

    if (!localName || !exportedName) {
      continue;
    }

    if (!isReExport && updateExportedSymbol(input.symbols, localName)) {
      continue;
    }

    syntheticSymbols.push(
      createSyntheticOxcExportSymbol({
        sourceText: input.sourceText,
        relativePath: input.relativePath,
        name: localName,
        exportedName,
        startByte: specifier.start ?? input.statement.start,
        endByte: specifier.end ?? input.statement.end,
        lineOffsets: input.lineOffsets,
        summaryStrategy: input.summaryStrategy,
        comments: input.comments,
      }),
    );
  }

  return syntheticSymbols;
}

function parseWithOxc(input: {
  relativePath: string;
  content: string;
  language: SupportedLanguage;
  summaryStrategy?: SummaryStrategy;
}): ParsedFile {
  const result = parseOxcSync(input.relativePath, input.content);
  const summaryStrategy = input.summaryStrategy ?? "doc-comments-first";
  const comments = Array.isArray(result.comments) ? result.comments : [];
  const lineOffsets = buildLineOffsets(input.content);
  const symbols: ParsedSymbol[] = [];
  const imports = collectOxcImports(result.module);

  for (const statement of result.program?.body ?? []) {
    switch (statement?.type) {
      case "ImportDeclaration":
        break;
      case "ExportNamedDeclaration": {
        if (statement.declaration) {
          symbols.push(
            ...collectOxcDeclarationSymbols({
              node: statement.declaration,
              sourceText: input.content,
              relativePath: input.relativePath,
              summaryStrategy,
              comments,
              lineOffsets,
              exported: true,
              rangeStart: statement.start,
              rangeEnd: statement.end,
            }),
          );
        } else {
          appendOxcReExportImport(imports, statement);
          symbols.push(
            ...collectOxcExportSpecifiers({
              statement,
              sourceText: input.content,
              relativePath: input.relativePath,
              summaryStrategy,
              comments,
              lineOffsets,
              symbols,
            }),
          );
        }
        break;
      }
      case "ExportAllDeclaration":
        appendOxcReExportImport(imports, statement);
        break;
      case "ExportDefaultDeclaration": {
        if (statement.declaration) {
          const declarationSymbols = collectOxcDeclarationSymbols({
            node: statement.declaration,
            sourceText: input.content,
            relativePath: input.relativePath,
            summaryStrategy,
            comments,
            lineOffsets,
            exported: true,
            rangeStart: statement.start,
            rangeEnd: statement.end,
          });

          if (declarationSymbols.length > 0) {
            symbols.push(...declarationSymbols);
          } else if (statement.declaration.type === "Identifier") {
            if (!updateExportedSymbol(symbols, statement.declaration.name)) {
              symbols.push(
                createSyntheticOxcExportSymbol({
                  sourceText: input.content,
                  relativePath: input.relativePath,
                  name: statement.declaration.name,
                  exportedName: "default",
                  startByte: statement.start,
                  endByte: statement.end,
                  lineOffsets,
                  summaryStrategy,
                  comments,
                }),
              );
            }
          } else {
            const anonymousDefaultKind: SymbolKind =
              statement.declaration.type === "FunctionDeclaration"
                ? "function"
                : statement.declaration.type === "ClassDeclaration"
                  ? "class"
                  : "constant";
            symbols.push(
              createSyntheticOxcExportSymbol({
                sourceText: input.content,
                relativePath: input.relativePath,
                name: "default",
                kind: anonymousDefaultKind,
                startByte: statement.start,
                endByte: statement.end,
                lineOffsets,
                summaryStrategy,
                comments,
              }),
            );
          }
        }
        break;
      }
      default:
        symbols.push(
          ...collectOxcDeclarationSymbols({
            node: statement,
            sourceText: input.content,
            relativePath: input.relativePath,
            summaryStrategy,
            comments,
            lineOffsets,
            exported: false,
            rangeStart: statement.start,
            rangeEnd: statement.end,
          }),
        );
      }
    }

  return {
    language: input.language,
    contentHash: hashString(input.content, "content_fingerprint"),
    integrityHash: hashString(input.content, "integrity"),
    symbols,
    imports,
    backend: "oxc",
    fallbackUsed: false,
    fallbackReason: null,
  };
}

function parseWithTreeSitter(input: {
  relativePath: string;
  content: string;
  language: SupportedLanguage;
  summaryStrategy?: SummaryStrategy;
  fallbackReason?: string;
}): ParsedFile {
  parser.setLanguage(languageFor(input.language));
  const symbols: ParsedSymbol[] = [];
  const imports: ParsedImport[] = [];
  const summaryStrategy = input.summaryStrategy ?? "doc-comments-first";

  try {
    const tree = parser.parse(input.content);
    for (const child of tree.rootNode.namedChildren) {
      visitNode(
        child,
        input.content,
        input.relativePath,
        false,
        summaryStrategy,
        symbols,
        imports,
      );
    }
  } catch (error) {
    if (!isRecoverableParseFailure(error)) {
      throw error;
    }

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

  return {
    language: input.language,
    contentHash: hashString(input.content, "content_fingerprint"),
    integrityHash: hashString(input.content, "integrity"),
    symbols,
    imports,
    backend: "tree-sitter",
    fallbackUsed: true,
    fallbackReason: input.fallbackReason ?? "oxc-parse-failed",
  };
}

export function parseSourceFile(input: {
  relativePath: string;
  content: string;
  language: SupportedLanguage;
  summaryStrategy?: SummaryStrategy;
}): ParsedFile {
  try {
    return parseWithOxc(input);
  } catch (error) {
    return parseWithTreeSitter({
      ...input,
      fallbackReason: error instanceof Error ? error.message : String(error),
    });
  }
}

export function supportedLanguageForFile(filePath: string): SupportedLanguage | null {
  return supportedLanguageForFileFromRegistry(filePath);
}
