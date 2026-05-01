import type { ReadinessStatus } from "./types.ts";

export interface RepoMetaReadinessRecord {
  discoveryIndexedAt: string | null;
  discoveredFiles: number;
  deepIndexedAt: string | null;
  deepening: {
    startedAt: string;
    totalFiles: number;
    processedFiles: number;
    pendingFiles: number;
  } | null;
}

export function normalizeRepoReadiness(value: unknown): RepoMetaReadinessRecord {
  if (typeof value !== "object" || value === null) {
    return {
      discoveryIndexedAt: null,
      discoveredFiles: 0,
      deepIndexedAt: null,
      deepening: null,
    };
  }

  const candidate = value as Partial<RepoMetaReadinessRecord>;
  const deepeningCandidate =
    typeof candidate.deepening === "object" && candidate.deepening !== null
      ? candidate.deepening
      : null;

  return {
    discoveryIndexedAt:
      typeof candidate.discoveryIndexedAt === "string"
        ? candidate.discoveryIndexedAt
        : null,
    discoveredFiles:
      typeof candidate.discoveredFiles === "number" && Number.isFinite(candidate.discoveredFiles)
        ? Math.max(0, Math.floor(candidate.discoveredFiles))
        : 0,
    deepIndexedAt:
      typeof candidate.deepIndexedAt === "string" ? candidate.deepIndexedAt : null,
    deepening:
      deepeningCandidate
      && typeof deepeningCandidate.startedAt === "string"
      && typeof deepeningCandidate.totalFiles === "number"
      && typeof deepeningCandidate.processedFiles === "number"
      && typeof deepeningCandidate.pendingFiles === "number"
        ? {
            startedAt: deepeningCandidate.startedAt,
            totalFiles: Math.max(0, Math.floor(deepeningCandidate.totalFiles)),
            processedFiles: Math.max(0, Math.floor(deepeningCandidate.processedFiles)),
            pendingFiles: Math.max(0, Math.floor(deepeningCandidate.pendingFiles)),
          }
        : null,
  };
}

export function summarizeReadiness(
  discoveryReady: boolean,
  deepRetrievalReady: boolean,
): string {
  if (deepRetrievalReady) {
    return "discovery-ready and deep-retrieval-ready";
  }
  if (discoveryReady) {
    return "discovery-ready but still deepening structured retrieval";
  }
  return "not discovery-ready yet";
}

export function buildReadinessStatus(input: {
  readiness?: RepoMetaReadinessRecord | null;
  indexedFiles: number;
}): ReadinessStatus {
  const readiness = input.readiness ?? normalizeRepoReadiness(null);
  const discoveryReady = readiness.discoveredFiles > 0;
  const deepRetrievalReady = readiness.deepIndexedAt !== null || input.indexedFiles > 0;
  const pendingDeepIndexedFiles = readiness.deepening?.pendingFiles ?? 0;
  const deepening = readiness.deepening !== null && pendingDeepIndexedFiles > 0;
  const stage =
    deepening
      ? "deepening"
      : deepRetrievalReady
        ? "deep-retrieval-ready"
        : discoveryReady
          ? "discovery-ready"
          : "not-ready";

  return {
    stage,
    discoveryReady,
    deepRetrievalReady,
    deepening,
    discoveredFiles: readiness.discoveredFiles,
    deepIndexedFiles: input.indexedFiles,
    pendingDeepIndexedFiles,
  };
}
