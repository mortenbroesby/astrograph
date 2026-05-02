import path from "node:path";
import { createHash } from "node:crypto";

import { createPathMatcher } from "./path-matcher.ts";
import { hashString } from "./hash.ts";
import type {
  IndexBackendConnection,
  IndexBackendValue,
} from "./index-backend.ts";
import {
  mapSymbolRow,
  typedAll,
  typedGet,
} from "./storage-queries.ts";
import type {
  DbFileContentRow,
  DbSymbolRow,
} from "./storage-queries.ts";
import {
  validateContextBundleOptions,
  validateRankedContextOptions,
  validateSearchTextOptions,
  validateSymbolSourceOptions,
} from "./validation.ts";
import type {
  ContextBundle,
  ContextBundleItem,
  ContextBundleItemRole,
  ContextBundleOptions,
  EngineConfig,
  FileContentResult,
  ImportSpecifier,
  QueryCodeAssembleResult,
  QueryCodeDiscoverResult,
  QueryCodeIntent,
  QueryCodeMatchReason,
  QueryCodeOptions,
  QueryCodeResult,
  QueryCodeSourceResult,
  QueryCodeSymbolMatch,
  QueryCodeTextMatch,
  RankedContextCandidate,
  RankedContextResult,
  RankingWeights,
  SearchSymbolsOptions,
  SearchTextMatch,
  SearchTextOptions,
  SymbolSourceItem,
  SymbolSourceResult,
  SymbolSummary,
} from "./types.ts";

export interface RetrievalContext {
  config: EngineConfig;
  db: IndexBackendConnection;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeRepoRelativePath(repoRoot: string, filePath: string) {
  if (!filePath || filePath.trim().length === 0) {
    throw new Error("File path is required");
  }

  const normalizedPath = path.normalize(filePath);
  if (
    path.isAbsolute(filePath) ||
    normalizedPath === ".." ||
    normalizedPath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`File path escapes repository root: ${filePath}`);
  }

  const absolutePath = path.resolve(repoRoot, normalizedPath);
  const relativePath = path.relative(repoRoot, absolutePath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`File path escapes repository root: ${filePath}`);
  }

  return {
    absolutePath,
    relativePath,
  };
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function queryTokens(value: string): string[] {
  return normalizeQuery(value)
    .split(/[^a-z0-9_]+/g)
    .filter(Boolean);
}

function uniqueQueryTerms(value: string): string[] {
  return [...new Set([
    normalizeQuery(value),
    ...queryTokens(value),
  ].filter(Boolean))];
}

function quoteFtsTerm(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

function buildFtsMatchQuery(value: string): string | null {
  const terms = uniqueQueryTerms(value)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  if (terms.length === 0) {
    return null;
  }

  return terms
    .map((term) => `${quoteFtsTerm(term)}*`)
    .join(" OR ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesFilePattern(filePath: string, pattern?: string): boolean {
  return createPathMatcher({ include: pattern ? [pattern] : undefined }).matches(
    filePath,
  );
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function rowText(row: DbSymbolRow): string {
  return [
    row.name,
    row.qualified_name ?? "",
    row.signature,
    row.summary,
    row.summary_source,
    row.file_path,
    row.kind,
  ]
    .join(" ")
    .toLowerCase();
}

function scoreSymbolRow(
  row: DbSymbolRow,
  query: string,
  weights: RankingWeights,
): number {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return 0;
  }

  const name = row.name.toLowerCase();
  const qualifiedName = row.qualified_name?.toLowerCase() ?? "";
  const signature = row.signature.toLowerCase();
  const summary = row.summary.toLowerCase();
  const filePath = row.file_path.toLowerCase();
  const haystack = rowText(row);
  const tokens = queryTokens(query);
  let score = 0;

  if (name === normalized) {
    score += weights.exactName;
  }
  if (qualifiedName === normalized) {
    score += weights.exactQualifiedName;
  }
  if (name.startsWith(normalized)) {
    score += weights.prefixName;
  }
  if (qualifiedName.startsWith(normalized)) {
    score += weights.prefixQualifiedName;
  }
  if (name.includes(normalized)) {
    score += weights.containsName;
  }
  if (qualifiedName.includes(normalized)) {
    score += weights.containsQualifiedName;
  }
  if (signature.includes(normalized)) {
    score += weights.signatureContains;
  }
  if (summary.includes(normalized)) {
    score += weights.summaryContains;
  }
  if (filePath.includes(normalized)) {
    score += weights.filePathContains;
  }

  const exactWord = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i");
  if (exactWord.test(rowText(row))) {
    score += weights.exactWord;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += weights.tokenMatch;
    }
  }

  if (score > 0 && row.exported) {
    score += weights.exportedBonus;
  }

  return score;
}

function loadSymbolRows(
  db: IndexBackendConnection,
  input: {
    query?: string;
    kind?: SearchSymbolsOptions["kind"];
    language?: SearchSymbolsOptions["language"];
    filePattern?: SearchSymbolsOptions["filePattern"];
  } = {},
): DbSymbolRow[] {
  const whereClauses: string[] = [];
  const params: IndexBackendValue[] = [];
  const ftsQuery = buildFtsMatchQuery(input.query ?? "");
  let candidateIds: string[] | null = null;

  if (input.kind) {
    whereClauses.push("symbols.kind = ?");
    params.push(input.kind);
  }

  if (input.language) {
    whereClauses.push("files.language = ?");
    params.push(input.language);
  }

  const queryTerms = uniqueQueryTerms(input.query ?? "");

  if (ftsQuery) {
    const ftsParams: IndexBackendValue[] = [ftsQuery, ...params];

    const ftsRows = typedAll<{ symbol_id: string }>(
      db.prepare(
        `
          SELECT DISTINCT symbol_search.symbol_id
          FROM symbol_search
          INNER JOIN symbols ON symbols.id = symbol_search.symbol_id
          INNER JOIN files ON files.id = symbols.file_id
          WHERE symbol_search MATCH ?
          ${whereClauses.length > 0 ? `AND ${whereClauses.join(" AND ")}` : ""}
          LIMIT 400
        `,
      ),
      ...ftsParams,
    );

    candidateIds = ftsRows
      .map((row) => row.symbol_id)
      .filter(Boolean);
  }

  if (queryTerms.length > 0) {
    const tokenClauses = queryTerms.map(() =>
      `(
        lower(symbols.name) LIKE ?
        OR lower(COALESCE(symbols.qualified_name, '')) LIKE ?
        OR lower(symbols.signature) LIKE ?
        OR lower(symbols.summary) LIKE ?
        OR lower(symbols.file_path) LIKE ?
      )`,
    );
    whereClauses.push(`(${tokenClauses.join(" OR ")})`);

    for (const term of queryTerms) {
      const wildcard = `%${term}%`;
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }
  }

  if (candidateIds && candidateIds.length > 0) {
    const placeholders = candidateIds.map(() => "?").join(", ");
    whereClauses.push(`symbols.id IN (${placeholders})`);
    params.push(...candidateIds);
  }

  const rows = typedAll<DbSymbolRow>(
    db.prepare(
      `
        SELECT
          symbols.id, symbols.name, symbols.qualified_name, symbols.kind,
          symbols.file_path, symbols.signature, symbols.summary,
          symbols.summary_source,
          symbols.start_line, symbols.end_line, symbols.start_byte,
          symbols.end_byte, symbols.exported
        FROM symbols
        INNER JOIN files ON files.id = symbols.file_id
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
      `,
    ),
    ...params,
  );

  return rows
    .filter((row) => matchesFilePattern(row.file_path, input.filePattern));
}

function loadSymbolSourceRow(
  db: IndexBackendConnection,
  symbolId: string,
) {
  return typedGet<DbFileContentRow>(
    db.prepare(
      `
        SELECT
          symbols.id, symbols.name, symbols.qualified_name, symbols.kind, symbols.file_path,
          symbols.signature, symbols.summary, symbols.summary_source,
          symbols.start_line, symbols.end_line, symbols.start_byte, symbols.end_byte,
          symbols.exported,
          files.content_hash, files.integrity_hash, content_blobs.content
        FROM symbols
        INNER JOIN files ON files.id = symbols.file_id
        INNER JOIN content_blobs ON content_blobs.file_id = files.id
        WHERE symbols.id = ?
      `,
    ),
    symbolId,
  );
}

function normalizeImportSpecifier(
  value: unknown,
): ImportSpecifier | null {
  if (typeof value === "string") {
    const importedName = value.trim();
    return importedName
      ? {
          kind: "unknown",
          importedName,
          localName: null,
        }
      : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const kind = "kind" in value ? value.kind : null;
  const importedName = "importedName" in value ? value.importedName : null;
  const localName = "localName" in value ? value.localName : null;

  if (
    (kind !== "named" && kind !== "default" && kind !== "namespace" && kind !== "unknown")
    || typeof importedName !== "string"
    || importedName.trim().length === 0
  ) {
    return null;
  }

  return {
    kind,
    importedName: importedName.trim(),
    localName: typeof localName === "string" && localName.trim().length > 0
      ? localName.trim()
      : null,
  };
}

function parseStoredImportSpecifiers(serialized: string): ImportSpecifier[] {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizeImportSpecifier(entry))
      .filter((entry): entry is ImportSpecifier => entry !== null);
  } catch {
    return [];
  }
}

function pickDependencyRows(
  db: IndexBackendConnection,
  seedRow: DbSymbolRow,
): Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> {
  const imports = typedAll<{
    target_path: string;
    source: string;
    specifiers: string;
  }>(
    db.prepare(
      `
        SELECT file_dependencies.target_path AS target_path, file_dependencies.source AS source, imports.specifiers AS specifiers
        FROM file_dependencies
        INNER JOIN files ON files.id = file_dependencies.importer_file_id
        INNER JOIN imports ON imports.file_id = files.id AND imports.source = file_dependencies.source
        WHERE file_dependencies.importer_path = ?
        ORDER BY file_dependencies.target_path ASC, file_dependencies.source ASC
      `,
    ),
    seedRow.file_path,
  );

  const matches: Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> = [];
  const seen = new Set<string>();

  for (const importRow of imports) {
    const specifiers = parseStoredImportSpecifiers(importRow.specifiers);

    const picked: DbSymbolRow[] = [];

    for (const specifier of specifiers) {
      const row = typedGet<DbSymbolRow>(
        db.prepare(
          `
            SELECT
              id, name, qualified_name, kind, file_path, signature, summary,
              summary_source,
              start_line, end_line, start_byte, end_byte, exported
            FROM symbols
            WHERE file_path = ? AND (name = ? OR qualified_name = ?)
            ORDER BY exported DESC, start_line ASC
            LIMIT 1
          `,
        ),
        importRow.target_path,
        specifier.importedName,
        specifier.importedName,
      );
      if (row) {
        picked.push(row);
      }
    }

    if (picked.length === 0) {
      const row = typedGet<DbSymbolRow>(
        db.prepare(
          `
            SELECT
              id, name, qualified_name, kind, file_path, signature, summary,
              summary_source,
              start_line, end_line, start_byte, end_byte, exported
            FROM symbols
            WHERE file_path = ?
            ORDER BY exported DESC, kind = 'class' DESC, kind = 'function' DESC, start_line ASC
            LIMIT 1
          `,
        ),
        importRow.target_path,
      );
      if (row) {
        picked.push(row);
      }
    }

    for (const row of picked) {
      if (seen.has(row.id)) {
        continue;
      }
      seen.add(row.id);
      matches.push({
        row,
        reason: importRow.source.startsWith(".")
          ? "imports_matched_file"
          : "reexport_match",
      });
    }
  }

  return matches;
}

function pickImporterRows(
  db: IndexBackendConnection,
  seedRow: DbSymbolRow,
): Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> {
  const importers = typedAll<{
    importer_path: string;
  }>(
    db.prepare(
      `
        SELECT importer_path
        FROM file_dependencies
        WHERE target_path = ?
        ORDER BY importer_path ASC
      `,
    ),
    seedRow.file_path,
  );

  const matches: Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> = [];
  const seen = new Set<string>();

  for (const importer of importers) {
    const row = typedGet<DbSymbolRow>(
      db.prepare(
        `
          SELECT
            id, name, qualified_name, kind, file_path, signature, summary,
            summary_source,
            start_line, end_line, start_byte, end_byte, exported
          FROM symbols
          WHERE file_path = ?
          ORDER BY exported DESC, kind = 'class' DESC, kind = 'function' DESC, start_line ASC
          LIMIT 1
        `,
      ),
      importer.importer_path,
    );
    if (!row || seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    matches.push({
      row,
      reason: "imported_by_match",
    });
  }

  return matches;
}

function pickReferenceRows(
  db: IndexBackendConnection,
  seedRow: DbSymbolRow,
): Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> {
  const importers = typedAll<{
    importer_path: string;
    specifiers: string;
  }>(
    db.prepare(
      `
        SELECT file_dependencies.importer_path AS importer_path, imports.specifiers AS specifiers
        FROM file_dependencies
        INNER JOIN files ON files.id = file_dependencies.importer_file_id
        INNER JOIN imports ON imports.file_id = files.id AND imports.source = file_dependencies.source
        WHERE file_dependencies.target_path = ?
        ORDER BY file_dependencies.importer_path ASC
      `,
    ),
    seedRow.file_path,
  );

  const matches: Array<{ row: DbSymbolRow; reason: QueryCodeMatchReason }> = [];
  const seen = new Set<string>();

  for (const importer of importers) {
    const specifiers = parseStoredImportSpecifiers(importer.specifiers);
    if (!specifiers.some((specifier) => specifier.importedName === seedRow.name)) {
      continue;
    }

    const row = typedGet<DbSymbolRow>(
      db.prepare(
        `
          SELECT
            id, name, qualified_name, kind, file_path, signature, summary,
            summary_source,
            start_line, end_line, start_byte, end_byte, exported
          FROM symbols
          WHERE file_path = ?
          ORDER BY exported DESC, kind = 'class' DESC, kind = 'function' DESC, start_line ASC
          LIMIT 1
        `,
      ),
      importer.importer_path,
    );
    if (!row || seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    matches.push({
      row,
      reason: "references_match",
    });
  }

  return matches;
}

function makeContextBundleItem(
  row: DbSymbolRow,
  source: string,
  role: ContextBundleItemRole,
  reason: string,
): ContextBundleItem {
  return {
    role,
    reason,
    symbol: mapSymbolRow(row),
    source,
    tokenCount: estimateTokens(source) + 8,
  };
}

function buildSymbolSourceItem(
  row: DbFileContentRow,
  verify: boolean,
  contextLines = 0,
): SymbolSourceItem {
  const normalizedContextLines = Math.max(0, Math.floor(contextLines));
  const lines = row.content.split("\n");
  const startLine = Math.max(1, row.start_line - normalizedContextLines);
  const endLine = Math.min(lines.length, row.end_line + normalizedContextLines);
  return {
    symbol: mapSymbolRow(row),
    source: lines.slice(startLine - 1, endLine).join("\n"),
    verified: verify
      ? row.integrity_hash === hashString(row.content, "integrity")
        || sha256(row.content) === row.content_hash
      : false,
    startLine,
    endLine,
  };
}

interface RankedSeedCandidate {
  row: DbFileContentRow;
  reason: QueryCodeMatchReason;
  score: number;
}

function sortRankedSymbolEntries(
  left: { row: DbSymbolRow; score: number },
  right: { row: DbSymbolRow; score: number },
) {
  return (
    right.score - left.score ||
    Number(right.row.exported) - Number(left.row.exported) ||
    left.row.file_path.localeCompare(right.row.file_path) ||
    left.row.start_line - right.row.start_line ||
    left.row.name.localeCompare(right.row.name)
  );
}

function resolveRankedSeedCandidates(
  context: RetrievalContext,
  input: ContextBundleOptions,
): RankedSeedCandidate[] {
  if (input.symbolIds?.length) {
    return input.symbolIds
      .map((symbolId) => loadSymbolSourceRow(context.db, symbolId))
      .filter(
        (row): row is DbFileContentRow => Boolean(row),
      )
      .map((row, index) => ({
        row,
        reason: "explicit_symbol_id",
        score: Math.max(1, input.symbolIds!.length - index),
      }));
  }

  if (!input.query) {
    return [];
  }

  return loadSymbolRows(context.db, { query: input.query })
    .map((row) => ({
      row,
      score: scoreSymbolRow(row, input.query ?? "", context.config.rankingWeights),
    }))
    .filter((entry) => entry.score > 0)
    .sort(sortRankedSymbolEntries)
    .slice(0, 5)
    .map((entry) => ({
      row: loadSymbolSourceRow(context.db, entry.row.id),
      reason:
        normalizeQuery(input.query ?? "") === normalizeQuery(entry.row.name)
        || normalizeQuery(input.query ?? "") === normalizeQuery(entry.row.qualified_name ?? "")
          ? "exact_symbol_match"
          : "query_match",
      score: entry.score,
    }))
    .filter(
      (
        entry,
      ): entry is RankedSeedCandidate => Boolean(entry.row),
    );
}

function buildContextBundleFromSeeds(
  db: IndexBackendConnection,
  input: ContextBundleOptions & Pick<QueryCodeOptions, "includeDependencies" | "includeImporters" | "includeReferences" | "relationDepth">,
  seedCandidates: RankedSeedCandidate[],
): ContextBundle {
  const bundleCandidates: Array<ContextBundleItem> = [];
  const seen = new Set<string>();

  for (const seed of seedCandidates) {
    if (seen.has(seed.row.id)) {
      continue;
    }
    seen.add(seed.row.id);
    bundleCandidates.push(
      makeContextBundleItem(
        seed.row,
        seed.row.content.slice(seed.row.start_byte, seed.row.end_byte),
        "target",
        seed.reason,
      ),
    );
  }

  const relationDepth = Math.min(3, Math.max(1, input.relationDepth ?? 1));
  const includeDependencies = input.includeDependencies ?? true;
  const includeImporters = input.includeImporters ?? false;
  const includeReferences = input.includeReferences ?? false;
  let frontier = seedCandidates.map((seed) => seed.row as DbSymbolRow);
  const visited = new Set(frontier.map((row) => row.id));

  for (let depth = 0; depth < relationDepth; depth += 1) {
    const nextFrontier: DbSymbolRow[] = [];

    for (const seedRow of frontier) {
      const relatedRows = [
        ...(includeDependencies ? pickDependencyRows(db, seedRow) : []),
        ...(includeReferences ? pickReferenceRows(db, seedRow) : []),
        ...(includeImporters ? pickImporterRows(db, seedRow) : []),
      ];

      for (const related of relatedRows) {
        if (seen.has(related.row.id)) {
          continue;
        }
        seen.add(related.row.id);
        const sourceRow = loadSymbolSourceRow(db, related.row.id);
        if (!sourceRow) {
          continue;
        }
        bundleCandidates.push(
          makeContextBundleItem(
            related.row,
            sourceRow.content.slice(sourceRow.start_byte, sourceRow.end_byte),
            "dependency",
            related.reason,
          ),
        );
        if (!visited.has(related.row.id)) {
          visited.add(related.row.id);
          nextFrontier.push(related.row);
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) {
      break;
    }
  }

  const tokenBudget = input.tokenBudget ?? 1200;
  const estimatedTokens = bundleCandidates.reduce(
    (total, item) => total + item.tokenCount,
    0,
  );
  const items: ContextBundleItem[] = [];
  let usedTokens = 0;

  for (const item of bundleCandidates) {
    if (usedTokens + item.tokenCount > tokenBudget) {
      break;
    }
    items.push(item);
    usedTokens += item.tokenCount;
  }

  return {
    repoRoot: input.repoRoot,
    query: input.query ?? null,
    tokenBudget,
    estimatedTokens,
    usedTokens,
    truncated: estimatedTokens > tokenBudget,
    items,
  };
}

function buildDiscoverGraphMatches(
  db: IndexBackendConnection,
  seedSymbols: SymbolSummary[],
  input: Pick<QueryCodeOptions, "query" | "includeDependencies" | "includeImporters" | "includeReferences" | "relationDepth" | "includeTextMatches">,
): {
  matches: QueryCodeSymbolMatch[];
  textMatchResults: QueryCodeTextMatch[];
} {
  const matches = new Map<string, QueryCodeSymbolMatch>();
  const query = normalizeQuery(input.query ?? "");
  const seedRows = seedSymbols
    .map((symbol) => loadSymbolSourceRow(db, symbol.id))
    .filter((row): row is DbFileContentRow => Boolean(row));

  for (const symbol of seedSymbols) {
    matches.set(symbol.id, {
      symbol,
      reasons: [
        query === normalizeQuery(symbol.name) || query === normalizeQuery(symbol.qualifiedName ?? "")
          ? "exact_symbol_match"
          : "query_match",
      ],
      depth: 0,
    });
  }

  const relationDepth = Math.min(3, Math.max(1, input.relationDepth ?? 1));
  let frontier = seedRows.map((row) => ({ row: row as DbSymbolRow, depth: 0 }));
  const visited = new Set(frontier.map((entry) => entry.row.id));

  while (frontier.length > 0) {
    const nextFrontier: Array<{ row: DbSymbolRow; depth: number }> = [];

    for (const entry of frontier) {
      if (entry.depth >= relationDepth) {
        continue;
      }

      const relatedRows = [
        ...(input.includeDependencies ? pickDependencyRows(db, entry.row) : []),
        ...(input.includeReferences ? pickReferenceRows(db, entry.row) : []),
        ...(input.includeImporters ? pickImporterRows(db, entry.row) : []),
      ];

      for (const related of relatedRows) {
        const existing = matches.get(related.row.id);
        if (existing) {
          if (!existing.reasons.includes(related.reason)) {
            existing.reasons.push(related.reason);
          }
          existing.depth = Math.min(existing.depth, entry.depth + 1);
        } else {
          matches.set(related.row.id, {
            symbol: mapSymbolRow(related.row),
            reasons: [related.reason],
            depth: entry.depth + 1,
          });
        }

        if (!visited.has(related.row.id)) {
          visited.add(related.row.id);
          nextFrontier.push({
            row: related.row,
            depth: entry.depth + 1,
          });
        }
      }
    }

    frontier = nextFrontier;
  }

  return {
    matches: [...matches.values()].sort(
      (left, right) =>
        left.depth - right.depth ||
        Number(right.symbol.exported) - Number(left.symbol.exported) ||
        left.symbol.filePath.localeCompare(right.symbol.filePath) ||
        left.symbol.startLine - right.symbol.startLine,
    ),
    textMatchResults: [],
  };
}

export function buildTextMatchResults(
  textMatches: SearchTextMatch[],
): QueryCodeTextMatch[] {
  return textMatches.map((match) => ({
    match,
    reasons:
      match.reason === "ripgrep_fallback"
        ? ["ripgrep_fallback"]
        : ["text_match"],
  }));
}

function buildRankedContextResult(
  input: ContextBundleOptions & { query: string },
  seedCandidates: RankedSeedCandidate[],
  bundle: ContextBundle,
): RankedContextResult {
  const selectedSeedIds = bundle.items
    .filter((item) => item.role === "target")
    .map((item) => item.symbol.id);

  const candidates: RankedContextCandidate[] = seedCandidates.map((candidate, index) => ({
    rank: index + 1,
    score: candidate.score,
    reason: candidate.reason,
    symbol: mapSymbolRow(candidate.row),
    selected: selectedSeedIds.includes(candidate.row.id),
  }));

  return {
    repoRoot: input.repoRoot,
    query: input.query,
    tokenBudget: bundle.tokenBudget,
    candidateCount: candidates.length,
    selectedSeedIds,
    candidates,
    bundle,
  };
}

export function searchSymbolsInContext(
  context: RetrievalContext,
  input: SearchSymbolsOptions,
): SymbolSummary[] {
  const resultLimit = Math.min(
    input.limit ?? context.config.maxSymbolResults,
    context.config.maxSymbolResults,
  );
  const rows = loadSymbolRows(context.db, {
    query: input.query,
    kind: input.kind,
    language: input.language,
    filePattern: input.filePattern,
  });
  const normalizedQuery = normalizeQuery(input.query);

  return rows
    .map((row) => ({
      row,
      score: scoreSymbolRow(row, normalizedQuery, context.config.rankingWeights),
    }))
    .filter((entry) => entry.score > 0)
    .sort(sortRankedSymbolEntries)
    .slice(0, resultLimit)
    .map((entry) => mapSymbolRow(entry.row));
}

export function searchTextInContext(
  context: RetrievalContext,
  input: SearchTextOptions,
): SearchTextMatch[] {
  validateSearchTextOptions(input);
  const whereClauses: string[] = [];
  const params: IndexBackendValue[] = [];
  const ftsQuery = buildFtsMatchQuery(input.query);
  const resultLimit = Math.min(
    input.limit ?? context.config.maxTextResults,
    context.config.maxTextResults,
  );

  if (ftsQuery) {
    const ftsRows = typedAll<{ file_id: number }>(
      context.db.prepare(
        `
          SELECT DISTINCT file_id
          FROM content_search
          WHERE content_search MATCH ?
          LIMIT 200
        `,
      ),
      ftsQuery,
    );
    if (ftsRows.length > 0) {
      const placeholders = ftsRows.map(() => "?").join(", ");
      whereClauses.push(`files.id IN (${placeholders})`);
      params.push(...ftsRows.map((row) => row.file_id));
    }
  }

  const rows = typedAll<{ file_path: string; content: string }>(
    context.db.prepare(
      `
        SELECT files.path AS file_path, content_blobs.content AS content
        FROM content_blobs
        INNER JOIN files ON files.id = content_blobs.file_id
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
        ORDER BY files.path ASC
      `,
    ),
    ...params,
  );
  const lowerQuery = input.query.toLowerCase();
  const matches: SearchTextMatch[] = [];

  for (const row of rows) {
    if (!matchesFilePattern(row.file_path, input.filePattern)) {
      continue;
    }
    const lines = row.content.split("\n");
    lines.forEach((line, index) => {
      if (matches.length >= resultLimit) {
        return;
      }
      if (line.toLowerCase().includes(lowerQuery)) {
        matches.push({
          filePath: row.file_path,
          line: index + 1,
          preview: line.trim(),
        });
      }
    });
    if (matches.length >= resultLimit) {
      break;
    }
  }

  return matches;
}

export function getContextBundleFromContext(
  context: RetrievalContext,
  input: ContextBundleOptions,
): ContextBundle {
  const normalizedSeeds = validateContextBundleOptions(input);
  const normalizedInput = {
    ...input,
    repoRoot: context.config.repoRoot,
    ...normalizedSeeds,
  };
  const seedCandidates = resolveRankedSeedCandidates(context, normalizedInput).slice(0, 3);
  return buildContextBundleFromSeeds(context.db, normalizedInput, seedCandidates);
}

export function getRankedContextFromContext(context: RetrievalContext, input: {
  repoRoot: string;
  query: string;
  tokenBudget?: number;
  includeDependencies?: boolean;
  includeImporters?: boolean;
  includeReferences?: boolean;
  relationDepth?: number;
}): RankedContextResult {
  validateRankedContextOptions(input);
  const normalizedInput = {
    ...input,
    repoRoot: context.config.repoRoot,
  };
  const seedCandidates = resolveRankedSeedCandidates(context, normalizedInput);
  const bundle = buildContextBundleFromSeeds(context.db, normalizedInput, seedCandidates.slice(0, 3));
  return buildRankedContextResult(normalizedInput, seedCandidates, bundle);
}

export function getFileContentFromContext(
  context: RetrievalContext,
  filePath: string,
): FileContentResult {
  const { relativePath } = normalizeRepoRelativePath(context.config.repoRoot, filePath);
  const row = context.db.prepare(
      `
        SELECT content_blobs.content AS content
        FROM content_blobs
        INNER JOIN files ON files.id = content_blobs.file_id
        WHERE files.path = ?
      `,
    ).get(relativePath) as { content: string } | undefined;

  if (!row) {
    throw new Error(`File not indexed: ${relativePath}`);
  }

  return {
    filePath: relativePath,
    content: row.content,
  };
}

export function getSymbolSourceFromContext(context: RetrievalContext, input: {
  symbolId?: string;
  symbolIds?: string[];
  verify?: boolean;
  contextLines?: number;
}): SymbolSourceResult {
  validateSymbolSourceOptions(input);
  const requestedIds = [
    ...(input.symbolId ? [input.symbolId] : []),
    ...(input.symbolIds ?? []),
  ];
  const symbolIds = [...new Set(requestedIds.filter(Boolean))];

  if (symbolIds.length === 0) {
    throw new Error("At least one symbol id is required");
  }

  const rows = symbolIds.map((symbolId) => {
    const row = loadSymbolSourceRow(context.db, symbolId);

    if (!row) {
      throw new Error(`Symbol not indexed: ${symbolId}`);
    }
    return row;
  });

  const items = rows.map((row) =>
    buildSymbolSourceItem(row, input.verify === true, input.contextLines),
  );
  const first = items[0];

  return {
    requestedContextLines: Math.max(0, Math.floor(input.contextLines ?? 0)),
    items,
    symbol: first?.symbol,
    source: first?.source,
    verified: first?.verified,
    startLine: first?.startLine,
    endLine: first?.endLine,
  };
}

export function queryCodeInContext(
  context: RetrievalContext,
  input: QueryCodeOptions,
  resolvedIntent: Exclude<QueryCodeIntent, "auto">,
): QueryCodeResult {
  switch (resolvedIntent) {
    case "discover": {
      const symbolMatches = searchSymbolsInContext(context, {
        repoRoot: context.config.repoRoot,
        query: input.query ?? "",
        kind: input.kind,
        language: input.language,
        filePattern: input.filePattern,
        limit: input.limit,
      });
      const textMatches = input.includeTextMatches
        ? searchTextInContext(context, {
            repoRoot: context.config.repoRoot,
            query: input.query ?? "",
            filePattern: input.filePattern,
          })
        : [];
      const graphMatches = buildDiscoverGraphMatches(
        context.db,
        symbolMatches,
        input,
      );

      const result: QueryCodeDiscoverResult = {
        intent: "discover",
        query: input.query ?? "",
        symbolMatches,
        textMatches,
        matches: graphMatches.matches,
        textMatchResults: buildTextMatchResults(textMatches),
      };
      return result;
    }
    case "source": {
      const fileContent = input.filePath
        ? getFileContentFromContext(context, input.filePath)
        : null;
      const hasSymbolRequest = Boolean(input.symbolId) || Boolean(input.symbolIds?.length);
      const symbolSource = hasSymbolRequest
        ? getSymbolSourceFromContext(context, {
            symbolId: input.symbolId,
            symbolIds: input.symbolIds,
            contextLines: input.contextLines,
            verify: input.verify,
          })
        : null;

      const result: QueryCodeSourceResult = {
        intent: "source",
        fileContent,
        symbolSource,
      };
      return result;
    }
    case "assemble": {
      const ranked = input.includeRankedCandidates && input.query
        ? getRankedContextFromContext(context, {
            repoRoot: context.config.repoRoot,
            query: input.query,
            tokenBudget: input.tokenBudget,
            includeDependencies: input.includeDependencies,
            includeImporters: input.includeImporters,
            relationDepth: input.relationDepth,
          })
        : null;
      const bundle = ranked
        ? ranked.bundle
        : getContextBundleFromContext(context, {
            repoRoot: context.config.repoRoot,
            query: input.query,
            symbolIds: input.symbolIds,
            tokenBudget: input.tokenBudget,
            includeDependencies: input.includeDependencies,
            includeImporters: input.includeImporters,
            relationDepth: input.relationDepth,
          });

      const result: QueryCodeAssembleResult = {
        intent: "assemble",
        bundle,
        ranked,
      };
      return result;
    }
    default:
      throw new Error(`Unsupported query_code intent: ${String(input.intent)}`);
  }
}

export function resolveQueryCodeIntent(
  input: Pick<
    QueryCodeOptions,
    "intent" | "symbolId" | "symbolIds" | "filePath" | "tokenBudget" | "includeRankedCandidates"
  >,
): Exclude<QueryCodeIntent, "auto"> {
  if (input.intent && input.intent !== "auto") {
    return input.intent;
  }

  if (input.filePath || input.symbolId) {
    return "source";
  }

  if (input.tokenBudget !== undefined || input.includeRankedCandidates) {
    return "assemble";
  }

  if (input.symbolIds && input.symbolIds.length > 0) {
    return "source";
  }

  return "discover";
}
