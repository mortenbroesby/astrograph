import type {
  DiagnosticsResult,
  RetrievalHealth,
  RetrievalOperation,
} from "./types.ts";

type RetrievalHealthInput = Pick<
  DiagnosticsResult,
  "staleReasons" | "staleStatus" | "readiness" | "indexedFiles" | "dependencyGraph"
>;

const ALL_OPERATIONS: RetrievalOperation[] = [
  "discovery",
  "exact_source",
  "ranked_context",
  "dependency_graph",
];
const UNRESOLVED_IMPORT_REASONS = new Set([
  "unresolved relative imports",
  "unresolved relative symbol imports",
]);

function isDependencyOnlyStaleness(diagnostics: RetrievalHealthInput): boolean {
  return diagnostics.staleReasons.length > 0
    && diagnostics.staleReasons.every((reason) => UNRESOLVED_IMPORT_REASONS.has(reason));
}

export function classifyRetrievalHealth(diagnostics: RetrievalHealthInput): RetrievalHealth {
  const hasUnresolvedDependencies = diagnostics.dependencyGraph.brokenRelativeImportCount > 0
    || diagnostics.dependencyGraph.brokenRelativeSymbolImportCount > 0;
  const notIndexed = !diagnostics.readiness.discoveryReady && diagnostics.indexedFiles === 0;

  if (notIndexed) {
    return {
      status: "unsafe",
      affectedCapabilities: [...ALL_OPERATIONS],
      safeOperations: [],
      recommendedAction: "Run index-folder to create the initial index before using retrieval results.",
    };
  }

  if (diagnostics.readiness.deepening) {
    return {
      status: "degraded",
      affectedCapabilities: ["exact_source", "ranked_context", "dependency_graph"],
      safeOperations: ["discovery"],
      recommendedAction: "Wait for initial indexing to finish before relying on source, ranked-context, or graph results.",
    };
  }

  if (hasUnresolvedDependencies && isDependencyOnlyStaleness(diagnostics)) {
    return {
      status: "degraded",
      affectedCapabilities: ["dependency_graph"],
      safeOperations: ["discovery", "exact_source", "ranked_context"],
      recommendedAction: "Fix the unresolved relative imports, then reindex before using dependency or importer expansion.",
    };
  }

  if (diagnostics.staleStatus !== "fresh") {
    return {
      status: "unsafe",
      affectedCapabilities: [...ALL_OPERATIONS],
      safeOperations: [],
      recommendedAction: "Run index-folder to refresh the index before relying on retrieval results.",
    };
  }

  return {
    status: "safe",
    affectedCapabilities: [],
    safeOperations: [...ALL_OPERATIONS],
    recommendedAction: "Continue using the current index; run watch for automatic refresh while editing.",
  };
}
