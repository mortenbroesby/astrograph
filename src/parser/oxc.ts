import { parseSync as parseOxcSync } from "oxc-parser";

import type { ImportSpecifier, SummaryStrategy, SymbolKind } from "../types.ts";
import {
  buildLineOffsets,
  buildParsedFile,
  buildSymbolId,
  lineFromOffset,
  nodeText,
  normalizeWhitespace,
  type ParserComment,
  type ParsedFile,
  type ParsedImport,
  type ParsedSymbol,
  type ParseSourceInput,
} from "./shared.ts";

type OxcKey = Partial<OxcNodeBase> & {
  type?: string;
  name?: string;
  value?: string;
};

type OxcNodeBase = {
  type?: string;
  start: number;
  end: number;
};

type OxcDeclarationNode = OxcNodeBase & {
  name?: string;
  value?: string;
  key?: OxcKey | null;
  kind?: string;
  id?: OxcKey | null;
  body?: { body?: OxcStatement[] | OxcClassMember[] } | null;
  declarations?: Array<{
    id?: OxcKey | null;
    init?: OxcObjectExpression | null;
  }>;
};

type OxcObjectExpression = OxcNodeBase & {
  properties?: OxcObjectMember[];
};

type OxcObjectMember = OxcNodeBase & {
  type?: "Property" | "ObjectMethod" | string;
  key?: OxcKey | null;
  method?: boolean;
  value?: { type?: string } | null;
};

type OxcClassMember = OxcNodeBase & {
  type?: "MethodDefinition" | "PropertyDefinition" | "AccessorProperty" | string;
  kind?: string;
  key?: OxcKey | null;
};

type OxcImportEntrySpecifier = {
  importName?: { kind?: string; name?: string } | null;
  localName?: { value?: string; name?: string } | null;
};

type OxcModuleInfo = {
  staticImports?: Array<{
    moduleRequest?: { value?: string } | null;
    entries?: OxcImportEntrySpecifier[];
  }>;
};

type OxcExportSpecifier = OxcNodeBase & {
  local?: OxcKey | null;
  exported?: OxcKey | null;
};

type OxcStatement = OxcDeclarationNode & {
  declaration?: OxcDeclarationNode | null;
  source?: { value?: string } | null;
  specifiers?: OxcExportSpecifier[];
};

type OxcParseResult = {
  comments?: ParserComment[];
  module?: OxcModuleInfo;
  program?: { body?: OxcStatement[] };
};

function identifierName(node: OxcKey | null | undefined): string | null {
  return node?.type === "Identifier" && typeof node.name === "string"
    ? node.name
    : null;
}

function bindingName(node: OxcKey | null | undefined): string | null {
  return typeof node?.name === "string"
    ? node.name
    : typeof node?.value === "string"
      ? node.value
      : null;
}

function parseCommentSummaryFromValue(
  comment: Pick<ParserComment, "type" | "value">,
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
  comments: ParserComment[];
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
  comments: ParserComment[];
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
  comments: ParserComment[];
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
  node: OxcDeclarationNode;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: ParserComment[];
  lineOffsets: number[];
  className: string;
}): ParsedSymbol[] {
  const members = input.node?.body?.body as OxcClassMember[] | undefined;
  if (!Array.isArray(members)) {
    return [];
  }

  return members.flatMap((member) => {
    const keyName = identifierName(member.key);
    if (member?.type === "MethodDefinition" && keyName) {
      const memberName =
        member.kind === "constructor"
          ? "constructor"
          : keyName;
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
      && keyName
    ) {
      return [
        createOxcSymbol({
          sourceText: input.sourceText,
          relativePath: input.relativePath,
          kind: "constant",
          name: keyName,
          qualifiedName: `${input.className}.${keyName}`,
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
  objectNode: OxcObjectExpression;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: ParserComment[];
  lineOffsets: number[];
  exported: boolean;
}): ParsedSymbol[] {
  const properties = input.objectNode?.properties;
  if (!Array.isArray(properties)) {
    return [];
  }

  return properties.flatMap((property) => {
    const propertyName = identifierName(property.key);
    if (!propertyName) {
      return [];
    }

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
  node: OxcDeclarationNode;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: ParserComment[];
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
    const name = identifierName(declarator.id);
    if (!name) {
      return [];
    }

    const variableSymbol = createOxcSymbol({
      sourceText: input.sourceText,
      relativePath: input.relativePath,
      kind: "constant",
      name,
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
            objectName: name,
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

function collectOxcImports(moduleInfo: OxcModuleInfo | undefined): ParsedImport[] {
  const staticImports = moduleInfo?.staticImports;
  if (!Array.isArray(staticImports)) {
    return [];
  }

  return staticImports.map((entry) => ({
    source: entry.moduleRequest?.value ?? "",
    specifiers: Array.isArray(entry.entries)
      ? entry.entries
          .map((specifier: OxcImportEntrySpecifier) => {
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
  statement: OxcStatement,
) {
  const source = statement?.source?.value;
  if (typeof source !== "string" || source.length === 0) {
    return;
  }

  const specifiers = Array.isArray(statement?.specifiers)
    ? statement.specifiers
        .map((specifier: OxcExportSpecifier) =>
          ({
            kind: "named",
            importedName:
              bindingName(specifier.local)
              ?? bindingName(specifier.exported)
              ?? "",
            localName:
              bindingName(specifier.exported)
              ?? bindingName(specifier.local)
              ?? null,
          }) satisfies ImportSpecifier,
        )
        .filter((specifier: ImportSpecifier) => specifier.importedName.length > 0)
    : [];

  imports.push({ source, specifiers });
}

function collectOxcDeclarationSymbols(input: {
  node: OxcDeclarationNode;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: ParserComment[];
  lineOffsets: number[];
  exported: boolean;
  rangeStart: number;
  rangeEnd: number;
}): ParsedSymbol[] {
  switch (input.node?.type) {
    case "FunctionDeclaration": {
      const name = identifierName(input.node.id);
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
      const name = identifierName(input.node.id);
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
      const name = identifierName(input.node.id);
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
      const name = bindingName(input.node.id);
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
      const bodyStatements = input.node.body?.body as OxcStatement[] | undefined;
      const nested = Array.isArray(bodyStatements)
        ? bodyStatements.flatMap((statement) => {
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
  statement: OxcStatement;
  sourceText: string;
  relativePath: string;
  summaryStrategy: SummaryStrategy;
  comments: ParserComment[];
  lineOffsets: number[];
  symbols: ParsedSymbol[];
}): ParsedSymbol[] {
  const specifiers = Array.isArray(input.statement?.specifiers)
    ? input.statement.specifiers
    : [];
  const syntheticSymbols: ParsedSymbol[] = [];
  const isReExport = Boolean(input.statement?.source);

  for (const specifier of specifiers) {
    const localName = bindingName(specifier.local);
    const exportedName = bindingName(specifier.exported) ?? localName;

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

export function parseWithOxc(input: ParseSourceInput): ParsedFile {
  const result = parseOxcSync(input.relativePath, input.content) as OxcParseResult;
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
            const declarationName = bindingName(statement.declaration);
            if (declarationName && !updateExportedSymbol(symbols, declarationName)) {
              symbols.push(
                createSyntheticOxcExportSymbol({
                  sourceText: input.content,
                  relativePath: input.relativePath,
                  name: declarationName,
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

  return buildParsedFile({
    language: input.language,
    content: input.content,
    symbols,
    imports,
    backend: "oxc",
    fallbackUsed: false,
    fallbackReason: null,
  });
}
