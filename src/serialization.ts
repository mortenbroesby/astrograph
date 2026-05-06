import fastJson from "fast-json-stringify";
import type {
  ContextBundle,
  DependencyGraphResult,
  DiagnosticsResult,
  FindFilesMatch,
  FileTreeEntry,
  FileSummaryResult,
  IndexSummary,
  ProjectStatusResult,
  QueryCodeResult,
  RankedContextResult,
  RepoOutline,
  SearchTextMatch,
  SymbolSummary,
} from "./types.ts";

interface SerializeOptions {
  pretty?: boolean;
  detailLevel?: DetailLevel;
}

export type DetailLevel = "full" | "compact" | "auto";

const nullableStringSchema = { type: ["string", "null"] } as const;
const nullableNumberSchema = { type: ["number", "null"] } as const;

const indexSummarySchema = {
  type: "object",
  properties: {
    indexedFiles: { type: "integer" },
    indexedSymbols: { type: "integer" },
    staleStatus: { type: "string" },
  },
} as const;

const watchDiagnosticsSchema = {
  type: "object",
  properties: {
    status: { type: "string" },
    backend: nullableStringSchema,
    debounceMs: nullableNumberSchema,
    pollMs: nullableNumberSchema,
    startedAt: nullableStringSchema,
    lastEvent: nullableStringSchema,
    lastEventAt: nullableStringSchema,
    lastChangedPaths: {
      type: "array",
      items: { type: "string" },
    },
    reindexCount: { type: "integer" },
    lastError: nullableStringSchema,
    lastSummary: {
      anyOf: [
        indexSummarySchema,
        { type: "null" },
      ],
    },
  },
} as const;

const readinessSchema = {
  type: "object",
  properties: {
    stage: { type: "string" },
    discoveryReady: { type: "boolean" },
    deepRetrievalReady: { type: "boolean" },
    deepening: { type: "boolean" },
    discoveredFiles: { type: "integer" },
    deepIndexedFiles: { type: "integer" },
    pendingDeepIndexedFiles: { type: "integer" },
  },
} as const;

const tierToolAvailabilitySchema = {
  type: "object",
  properties: {
    discovery: {
      type: "array",
      items: { type: "string" },
    },
    structured: {
      type: "array",
      items: { type: "string" },
    },
    graph: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const languageSupportDescriptorSchema = {
  type: "object",
  properties: {
    language: { type: "string" },
    extensions: {
      type: "array",
      items: { type: "string" },
    },
    tiers: {
      type: "array",
      items: { type: "string" },
    },
    summaryStrategies: {
      type: "array",
      items: { type: "string" },
    },
    toolAvailability: tierToolAvailabilitySchema,
  },
} as const;

const fallbackSupportDescriptorSchema = {
  type: "object",
  properties: {
    extension: { type: "string" },
    tiers: {
      type: "array",
      items: { type: "string" },
    },
    summarySource: { type: "string" },
    toolAvailability: tierToolAvailabilitySchema,
  },
} as const;

const diagnosticsSchema = {
  type: "object",
  properties: {
    engineVersion: { type: "string" },
    engineVersionParts: {
      type: "object",
      properties: {
        major: { type: "integer" },
        minor: { type: "integer" },
        patch: { type: "integer" },
        increment: { type: "integer" },
      },
    },
    storageDir: { type: "string" },
    databasePath: { type: "string" },
    storageVersion: { type: "integer" },
    schemaVersion: { type: "integer" },
    storageMode: { type: "string" },
    storageBackend: { type: "string" },
    staleStatus: { type: "string" },
    freshnessMode: { type: "string" },
    freshnessScanned: { type: "boolean" },
    summaryStrategy: { type: "string" },
    summarySources: {
      type: "object",
      additionalProperties: { type: "integer" },
    },
    indexedAt: nullableStringSchema,
    indexAgeMs: nullableNumberSchema,
    indexedFiles: { type: "integer" },
    indexedSymbols: { type: "integer" },
    currentFiles: { type: "integer" },
    missingFiles: { type: "integer" },
    changedFiles: { type: "integer" },
    extraFiles: { type: "integer" },
    indexedSnapshotHash: nullableStringSchema,
    currentSnapshotHash: nullableStringSchema,
    staleReasons: {
      type: "array",
      items: { type: "string" },
    },
    readiness: readinessSchema,
    parser: {
      type: "object",
      properties: {
        primaryBackend: { type: "string" },
        fallbackBackend: nullableStringSchema,
        indexedFileCount: { type: "integer" },
        fallbackFileCount: { type: "integer" },
        fallbackRate: nullableNumberSchema,
        unknownFileCount: { type: "integer" },
        fallbackReasons: {
          type: "object",
          additionalProperties: { type: "integer" },
        },
      },
    },
    dependencyGraph: {
      type: "object",
      properties: {
        brokenRelativeImportCount: { type: "integer" },
        brokenRelativeSymbolImportCount: { type: "integer" },
        affectedImporterCount: { type: "integer" },
        sampleImporterPaths: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    languageRegistry: {
      type: "object",
      properties: {
        byLanguage: {
          type: "array",
          items: languageSupportDescriptorSchema,
        },
        byFallbackExtension: {
          type: "array",
          items: fallbackSupportDescriptorSchema,
        },
      },
    },
    watch: watchDiagnosticsSchema,
  },
} as const;

const repoOutlineSchema = {
  type: "object",
  properties: {
    totalFiles: { type: "integer" },
    totalSymbols: { type: "integer" },
    languages: {
      type: "object",
      additionalProperties: { type: "integer" },
    },
  },
} as const;

const fileTreeSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      path: { type: "string" },
      language: { type: "string" },
      symbolCount: { type: "integer" },
    },
  },
} as const;

const findFilesSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      filePath: { type: "string" },
      fileName: { type: "string" },
      language: { type: ["string", "null"] },
      supportTier: { type: "string" },
      indexed: { type: "boolean" },
      matchReason: { type: "string" },
    },
  },
} as const;

const searchTextSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      filePath: { type: "string" },
      line: { type: "integer" },
      preview: { type: "string" },
      source: { type: ["string", "null"] },
      reason: { type: ["string", "null"] },
    },
  },
} as const;

const fileSummarySchema = {
  type: "object",
  properties: {
    filePath: { type: "string" },
    fileName: { type: "string" },
    language: { type: ["string", "null"] },
    supportTier: { type: "string" },
    support: {
      type: "object",
      properties: {
        activeTier: { type: "string" },
        availableTiers: {
          type: "array",
          items: { type: "string" },
        },
        reason: { type: "string" },
      },
    },
    indexed: { type: "boolean" },
    summarySource: { type: "string" },
    summary: { type: "string" },
    confidence: { type: "string" },
    symbolCount: { type: "integer" },
    topSymbols: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          kind: { type: "string" },
          line: { type: "integer" },
        },
      },
    },
    hints: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const projectStatusSchema = {
  type: "object",
  properties: {
    repoRoot: { type: "string" },
    summary: { type: "string" },
    readiness: readinessSchema,
    freshness: {
      type: "object",
      properties: {
        staleStatus: { type: "string" },
        staleReasons: {
          type: "array",
          items: { type: "string" },
        },
        indexedFiles: { type: "integer" },
        indexedSymbols: { type: "integer" },
        changedFiles: { type: "integer" },
        missingFiles: { type: "integer" },
        extraFiles: { type: "integer" },
      },
    },
    supportTiers: {
      type: "object",
      properties: {
        discovery: {
          type: "object",
          properties: {
            languages: { type: "array", items: { type: "string" } },
            fallbackExtensions: { type: "array", items: { type: "string" } },
            summarySources: { type: "array", items: { type: "string" } },
          },
        },
        structured: {
          type: "object",
          properties: {
            languages: { type: "array", items: { type: "string" } },
          },
        },
        graph: {
          type: "object",
          properties: {
            languages: { type: "array", items: { type: "string" } },
          },
        },
        byLanguage: {
          type: "array",
          items: {
            ...languageSupportDescriptorSchema,
          },
        },
        byFallbackExtension: {
          type: "array",
          items: {
            ...fallbackSupportDescriptorSchema,
          },
        },
      },
    },
    watch: watchDiagnosticsSchema,
  },
} as const;

const stringifyIndexSummary = fastJson(indexSummarySchema);
const stringifyDiagnostics = fastJson(diagnosticsSchema);
const stringifyRepoOutline = fastJson(repoOutlineSchema);
const stringifyFileTree = fastJson(fileTreeSchema);
const stringifyFindFiles = fastJson(findFilesSchema);
const stringifySearchText = fastJson(searchTextSchema);
const stringifyFileSummary = fastJson(fileSummarySchema);
const stringifyProjectStatus = fastJson(projectStatusSchema);

const COMPACT_SERIALIZERS = new Map<string, (value: unknown) => string>([
  ["init", (value) => stringifyDiagnostics(value as DiagnosticsResult)],
  ["diagnostics", (value) => stringifyDiagnostics(value as DiagnosticsResult)],
  ["index_folder", (value) => stringifyIndexSummary(value as IndexSummary)],
  ["index-folder", (value) => stringifyIndexSummary(value as IndexSummary)],
  ["index_file", (value) => stringifyIndexSummary(value as IndexSummary)],
  ["index-file", (value) => stringifyIndexSummary(value as IndexSummary)],
  ["find_files", (value) => stringifyFindFiles(value as FindFilesMatch[])],
  ["find-files", (value) => stringifyFindFiles(value as FindFilesMatch[])],
  ["search_text", (value) => stringifySearchText(value as SearchTextMatch[])],
  ["search-text", (value) => stringifySearchText(value as SearchTextMatch[])],
  ["get_file_summary", (value) => stringifyFileSummary(value as FileSummaryResult)],
  ["get-file-summary", (value) => stringifyFileSummary(value as FileSummaryResult)],
  ["get_project_status", (value) => stringifyProjectStatus(value as ProjectStatusResult)],
  ["get-project-status", (value) => stringifyProjectStatus(value as ProjectStatusResult)],
  ["get_repo_outline", (value) => stringifyRepoOutline(value as RepoOutline)],
  ["get-repo-outline", (value) => stringifyRepoOutline(value as RepoOutline)],
  ["get_file_tree", (value) => stringifyFileTree(value as FileTreeEntry[])],
  ["get-file-tree", (value) => stringifyFileTree(value as FileTreeEntry[])],
]);

function normalizeToolName(toolName: string): string {
  return toolName.replaceAll("-", "_");
}

function compactSymbolSummary(symbol: SymbolSummary) {
  return {
    id: symbol.id,
    stableId: symbol.stableId,
    name: symbol.name,
    qualifiedName: symbol.qualifiedName,
    kind: symbol.kind,
    filePath: symbol.filePath,
    startLine: symbol.startLine,
    endLine: symbol.endLine,
    exported: symbol.exported,
  };
}

function compactContextBundle(bundle: ContextBundle) {
  return {
    repoRoot: bundle.repoRoot,
    query: bundle.query,
    tokenBudget: bundle.tokenBudget,
    estimatedTokens: bundle.estimatedTokens,
    usedTokens: bundle.usedTokens,
    truncated: bundle.truncated,
    itemCount: bundle.items.length,
    items: bundle.items.map((item) => ({
      role: item.role,
      reason: item.reason,
      tokenCount: item.tokenCount,
      symbol: compactSymbolSummary(item.symbol),
    })),
  };
}

function compactRankedContext(result: RankedContextResult) {
  return {
    repoRoot: result.repoRoot,
    query: result.query,
    tokenBudget: result.tokenBudget,
    candidateCount: result.candidateCount,
    selectedSeedIds: result.selectedSeedIds,
    candidates: result.candidates.map((candidate) => ({
      rank: candidate.rank,
      score: candidate.score,
      reason: candidate.reason,
      selected: candidate.selected,
      symbol: compactSymbolSummary(candidate.symbol),
    })),
    bundle: compactContextBundle(result.bundle),
  };
}

function compactDependencyGraph(result: DependencyGraphResult) {
  return {
    rootFilePath: result.rootFilePath,
    relationDepth: result.relationDepth,
    direction: result.direction,
    nodeCount: result.nodes.length,
    edgeCount: result.edges.length,
    nodes: result.nodes.map((node) => node.filePath),
    edges: result.edges,
  };
}

function compactQueryCodeResult(result: QueryCodeResult) {
  if (result.intent === "discover") {
    return {
      intent: result.intent,
      query: result.query,
      symbolMatchCount: result.symbolMatches.length,
      textMatchCount: result.textMatches.length,
      graphMatchCount: result.matches.length,
      symbolMatches: result.symbolMatches.map(compactSymbolSummary),
      textMatches: result.textMatches,
      matches: result.matches.map((match) => ({
        symbol: compactSymbolSummary(match.symbol),
        reasons: match.reasons,
        depth: match.depth,
      })),
      textMatchResults: result.textMatchResults,
    };
  }

  if (result.intent === "assemble") {
    return {
      intent: result.intent,
      bundle: compactContextBundle(result.bundle),
      ranked: result.ranked ? compactRankedContext(result.ranked) : null,
    };
  }

  return result;
}

function shouldCompact(toolName: string, value: unknown): boolean {
  const normalizedToolName = normalizeToolName(toolName);

  if (normalizedToolName === "get_context_bundle") {
    const bundle = value as ContextBundle;
    return bundle.items.length > 3 || bundle.usedTokens > 600;
  }

  if (normalizedToolName === "get_ranked_context") {
    const result = value as RankedContextResult;
    return result.candidateCount > 5 || result.bundle.items.length > 3;
  }

  if (normalizedToolName === "get_dependency_graph") {
    const result = value as DependencyGraphResult;
    return result.nodes.length + result.edges.length > 8;
  }

  if (normalizedToolName === "query_code") {
    const result = value as QueryCodeResult;
    if (result.intent === "discover") {
      return result.matches.length + result.textMatches.length > 6;
    }
    if (result.intent === "assemble") {
      return result.bundle.items.length > 3 || (result.ranked?.candidateCount ?? 0) > 5;
    }
  }

  return false;
}

export function shapeToolResult(
  toolName: string,
  value: unknown,
  detailLevel?: DetailLevel,
): unknown {
  if (!detailLevel || detailLevel === "full") {
    return value;
  }

  if (detailLevel === "auto" && !shouldCompact(toolName, value)) {
    return value;
  }

  const normalizedToolName = normalizeToolName(toolName);
  if (normalizedToolName === "get_context_bundle") {
    return compactContextBundle(value as ContextBundle);
  }
  if (normalizedToolName === "get_ranked_context") {
    return compactRankedContext(value as RankedContextResult);
  }
  if (normalizedToolName === "get_dependency_graph") {
    return compactDependencyGraph(value as DependencyGraphResult);
  }
  if (normalizedToolName === "query_code") {
    return compactQueryCodeResult(value as QueryCodeResult);
  }

  return value;
}

export function serializeToolResult(
  toolName: string,
  value: unknown,
  options: SerializeOptions = {},
): string {
  const shapedValue = shapeToolResult(toolName, value, options.detailLevel);

  if (options.pretty) {
    return JSON.stringify(shapedValue, null, 2);
  }

  const serializer = COMPACT_SERIALIZERS.get(toolName);
  if (!serializer) {
    return JSON.stringify(shapedValue);
  }

  try {
    return serializer(shapedValue);
  } catch {
    return JSON.stringify(shapedValue);
  }
}
