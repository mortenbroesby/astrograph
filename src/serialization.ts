import fastJson from "fast-json-stringify";
import type {
  DiagnosticsResult,
  FindFilesMatch,
  FileTreeEntry,
  FileSummaryResult,
  IndexSummary,
  ProjectStatusResult,
  RepoOutline,
  SearchTextMatch,
} from "./types.ts";

interface SerializeOptions {
  pretty?: boolean;
}

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

export function serializeToolResult(
  toolName: string,
  value: unknown,
  options: SerializeOptions = {},
): string {
  if (options.pretty) {
    return JSON.stringify(value, null, 2);
  }

  const serializer = COMPACT_SERIALIZERS.get(toolName);
  if (!serializer) {
    return JSON.stringify(value);
  }

  try {
    return serializer(value);
  } catch {
    return JSON.stringify(value);
  }
}
