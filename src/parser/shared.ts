import { createHash } from "node:crypto";

import { hashString } from "../hash.ts";
import type {
  ImportSpecifier,
  SummarySource,
  SummaryStrategy,
  SupportedLanguage,
  SymbolKind,
} from "../types.ts";

export interface ParsedImport {
  source: string;
  specifiers: ImportSpecifier[];
}

export interface ParsedSymbol {
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

export interface ParseSourceInput {
  relativePath: string;
  content: string;
  language: SupportedLanguage;
  summaryStrategy?: SummaryStrategy;
}

export interface ParseOffset {
  byte: number;
  line: number;
}

export interface OwnedLineRange {
  start: number;
  end: number;
}

export interface SourceChunk extends ParseOffset, OwnedLineRange {
  content: string;
}

export interface ParserComment {
  type: "Line" | "Block";
  value: string;
  start: number;
  end: number;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function nodeText(sourceText: string, startByte: number, endByte: number): string {
  return sourceText.slice(startByte, endByte);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function buildSymbolId(
  relativePath: string,
  kind: SymbolKind,
  name: string,
  startByte: number,
): string {
  return sha256(`${relativePath}:${kind}:${name}:${startByte}`).slice(0, 16);
}

export function buildParsedFile(input: {
  language: SupportedLanguage;
  content: string;
  symbols: ParsedSymbol[];
  imports: ParsedImport[];
  backend: "oxc" | "tree-sitter";
  fallbackUsed: boolean;
  fallbackReason: string | null;
}): ParsedFile {
  return {
    language: input.language,
    contentHash: hashString(input.content, "content_fingerprint"),
    integrityHash: hashString(input.content, "integrity"),
    symbols: input.symbols,
    imports: input.imports,
    backend: input.backend,
    fallbackUsed: input.fallbackUsed,
    fallbackReason: input.fallbackReason,
  };
}

export function parseCommentSummary(comment: string): string | null {
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

export function parseImportClauseSpecifiers(clause: string): ImportSpecifier[] {
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

const MAX_PARSE_BYTES = 24_000;
const TARGET_CHUNK_BYTES = 16_000;
const CHUNK_OVERLAP_BYTES = 8_000;

export function splitSourceIntoChunks(sourceText: string): SourceChunk[] {
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

export function buildLineOffsets(sourceText: string): number[] {
  const offsets = [0];
  for (let index = 0; index < sourceText.length; index += 1) {
    if (sourceText[index] === "\n") {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

export function lineFromOffset(lineOffsets: number[], offset: number): number {
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
