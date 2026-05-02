import type {
  IndexBackendName,
  StaleStatus,
  StorageMode,
  SummaryStrategy,
  SupportedLanguage,
} from "./config.ts";
import type {
  FileSummarySource,
  FallbackSupportDescriptor,
  LanguageSupportDescriptor,
  SupportTier,
  TierToolAvailability,
  SummarySource,
} from "./retrieval.ts";
import type { WatchDiagnostics } from "./watch.ts";

export interface DiagnosticsOptions {
  repoRoot: string;
  scanFreshness?: boolean;
}

export type ReadinessStage =
  | "not-ready"
  | "discovery-ready"
  | "deepening"
  | "deep-retrieval-ready";

export interface ReadinessStatus {
  stage: ReadinessStage;
  discoveryReady: boolean;
  deepRetrievalReady: boolean;
  deepening: boolean;
  discoveredFiles: number;
  deepIndexedFiles: number;
  pendingDeepIndexedFiles: number;
}

export interface ParserHealthDiagnostics {
  primaryBackend: "oxc";
  fallbackBackend: "tree-sitter";
  indexedFileCount: number;
  fallbackFileCount: number;
  fallbackRate: number | null;
  unknownFileCount: number;
  fallbackReasons: Record<string, number>;
}

export interface DoctorObservabilityHealth {
  enabled: boolean;
  configuredHost: string;
  configuredPort: number;
  status: "disabled" | "recording";
  url: string | null;
}

export interface DoctorPrivacyHealth {
  secretLikeFileCount: number;
  sampleFilePaths: string[];
}

export interface DoctorDependencyGraphHealth {
  brokenRelativeImportCount: number;
  brokenRelativeSymbolImportCount: number;
  affectedImporterCount: number;
  sampleImporterPaths: string[];
}

export interface DiagnosticsResult {
  engineVersion: string;
  engineVersionParts: AstrographVersionParts;
  storageDir: string;
  databasePath: string;
  storageVersion: number;
  schemaVersion: number;
  storageMode: StorageMode;
  storageBackend: IndexBackendName;
  staleStatus: StaleStatus;
  freshnessMode: "metadata" | "scan";
  freshnessScanned: boolean;
  summaryStrategy: SummaryStrategy;
  summarySources: Partial<Record<SummarySource, number>>;
  indexedAt: string | null;
  indexAgeMs: number | null;
  indexedFiles: number;
  indexedSymbols: number;
  currentFiles: number;
  missingFiles: number;
  changedFiles: number;
  extraFiles: number;
  indexedSnapshotHash: string | null;
  currentSnapshotHash: string | null;
  staleReasons: string[];
  readiness: ReadinessStatus;
  parser: ParserHealthDiagnostics;
  dependencyGraph: DoctorDependencyGraphHealth;
  languageRegistry: {
    byLanguage: LanguageSupportDescriptor[];
    byFallbackExtension: FallbackSupportDescriptor[];
  };
  watch: WatchDiagnostics;
}

export interface ProjectStatusOptions {
  repoRoot: string;
  scanFreshness?: boolean;
}

export interface ProjectStatusResult {
  repoRoot: string;
  summary: string;
  readiness: ReadinessStatus;
  freshness: {
    staleStatus: StaleStatus;
    staleReasons: string[];
    indexedFiles: number;
    indexedSymbols: number;
    changedFiles: number;
    missingFiles: number;
    extraFiles: number;
  };
  supportTiers: {
    discovery: {
      languages: SupportedLanguage[];
      fallbackExtensions: string[];
      summarySources: FileSummarySource[];
    };
    structured: {
      languages: SupportedLanguage[];
    };
    graph: {
      languages: SupportedLanguage[];
    };
    byLanguage: Array<{
      language: SupportedLanguage;
      extensions: string[];
      tiers: SupportTier[];
      summaryStrategies: SummaryStrategy[];
      toolAvailability: TierToolAvailability;
    }>;
    byFallbackExtension: FallbackSupportDescriptor[];
  };
  watch: WatchDiagnostics;
}

export interface DoctorResult {
  repoRoot: string;
  storageDir: string;
  databasePath: string;
  storageVersion: number;
  schemaVersion: number;
  storageBackend: IndexBackendName;
  storageMode: StorageMode;
  indexStatus: "not-indexed" | "indexed" | "stale";
  freshness: {
    status: StaleStatus;
    mode: "metadata" | "scan";
    scanned: boolean;
    indexedAt: string | null;
    indexAgeMs: number | null;
    indexedFiles: number;
    currentFiles: number;
    indexedSymbols: number;
    indexedImports: number;
    missingFiles: number;
    changedFiles: number;
    extraFiles: number;
  };
  parser: ParserHealthDiagnostics;
  dependencyGraph: DoctorDependencyGraphHealth;
  observability: DoctorObservabilityHealth;
  privacy: DoctorPrivacyHealth;
  watch: WatchDiagnostics;
  warnings: string[];
  suggestedActions: string[];
}

export interface AstrographVersionParts {
  major: number;
  minor: number;
  patch: number;
  increment: number;
}

export type EngineEventSource = "mcp" | "watch" | "index-worker" | "health";
export type EngineEventLevel = "debug" | "info" | "warn" | "error";

export interface EngineEventEnvelope {
  id: string;
  ts: string;
  repoRoot: string;
  source: EngineEventSource;
  event: string;
  level: EngineEventLevel;
  correlationId?: string;
  data: Record<string, unknown>;
}
