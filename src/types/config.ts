export type SupportedLanguage = "ts" | "tsx" | "js" | "jsx";

export type StorageMode = "wal";
export type IndexBackendName = "sqlite";

export type StaleStatus = "unknown" | "fresh" | "stale";

export const SUMMARY_STRATEGIES = ["doc-comments-first", "signature-only"] as const;
export type SummaryStrategy = (typeof SUMMARY_STRATEGIES)[number];

export interface RankingWeights {
  exactName: number;
  exactQualifiedName: number;
  prefixName: number;
  prefixQualifiedName: number;
  containsName: number;
  containsQualifiedName: number;
  signatureContains: number;
  summaryContains: number;
  filePathContains: number;
  exactWord: number;
  tokenMatch: number;
  exportedBonus: number;
}

export interface EnginePaths {
  storageDir: string;
  databasePath: string;
  repoMetaPath: string;
  integrityPath: string;
  storageVersionPath: string;
  rawCacheDir: string;
  eventsPath: string;
}

export interface EngineConfig {
  repoRoot: string;
  languages: SupportedLanguage[];
  respectGitIgnore: boolean;
  storageMode: StorageMode;
  staleStatus: StaleStatus;
  summaryStrategy: SummaryStrategy;
  indexInclude: string[];
  indexExclude: string[];
  fileProcessingConcurrency: number;
  workerPoolEnabled: boolean;
  workerPoolMaxWorkers: number;
  maxFilesDiscovered: number;
  maxFileBytes: number;
  maxSymbolsPerFile: number;
  maxSymbolResults: number;
  maxTextResults: number;
  maxChildProcessOutputBytes: number;
  maxLiveSearchMatches: number;
  rankingWeights: RankingWeights;
  paths: EnginePaths;
}

export interface RepoObservabilityConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  recentLimit?: number;
  retentionDays?: number;
  snapshotIntervalMs?: number;
  redactSourceText?: boolean;
}

export interface RepoPerformanceConfig {
  include?: string[];
  exclude?: string[];
  fileProcessingConcurrency?: number | "auto";
  workerPool?: {
    enabled?: boolean;
    maxWorkers?: number | "auto";
  };
}

export interface RepoWatchConfig {
  backend?: "auto" | "parcel" | "node-fs-watch" | "polling";
  debounceMs?: number;
}

export interface RepoRankingConfig {
  exactName?: number;
  exactQualifiedName?: number;
  prefixName?: number;
  prefixQualifiedName?: number;
  containsName?: number;
  containsQualifiedName?: number;
  signatureContains?: number;
  summaryContains?: number;
  filePathContains?: number;
  exactWord?: number;
  tokenMatch?: number;
  exportedBonus?: number;
}

export interface RepoEngineConfig {
  summaryStrategy?: SummaryStrategy;
  storageMode?: StorageMode;
  observability?: RepoObservabilityConfig;
  performance?: RepoPerformanceConfig;
  ranking?: RepoRankingConfig;
  watch?: RepoWatchConfig;
  limits?: {
    maxFilesDiscovered?: number;
    maxFileBytes?: number;
    maxSymbolsPerFile?: number;
    maxSymbolResults?: number;
    maxTextResults?: number;
    maxChildProcessOutputBytes?: number;
    maxLiveSearchMatches?: number;
  };
}

export interface ResolvedObservabilityConfig {
  enabled: boolean;
  host: string;
  port: number;
  recentLimit: number;
  retentionDays: number;
  snapshotIntervalMs: number;
  redactSourceText: boolean;
}

export interface ResolvedPerformanceConfig {
  include: string[];
  exclude: string[];
  fileProcessingConcurrency: number;
  workerPool: {
    enabled: boolean;
    maxWorkers: number;
  };
}

export interface ResolvedWatchConfig {
  backend: "auto" | "parcel" | "node-fs-watch" | "polling";
  debounceMs: number;
}

export interface ResolvedRankingConfig extends RankingWeights {}

export interface ResolvedLimitsConfig {
  maxFilesDiscovered: number;
  maxFileBytes: number;
  maxSymbolsPerFile: number;
  maxSymbolResults: number;
  maxTextResults: number;
  maxChildProcessOutputBytes: number;
  maxLiveSearchMatches: number;
}

export interface ResolvedRepoEngineConfig {
  configPath: string | null;
  repoRoot: string;
  summaryStrategy: SummaryStrategy;
  storageMode: StorageMode;
  observability: ResolvedObservabilityConfig;
  performance: ResolvedPerformanceConfig;
  ranking: ResolvedRankingConfig;
  watch: ResolvedWatchConfig;
  limits: ResolvedLimitsConfig;
}

export type EngineToolName =
  | "init"
  | "index_folder"
  | "index_file"
  | "find_files"
  | "search_text"
  | "get_file_summary"
  | "get_project_status"
  | "get_repo_outline"
  | "get_file_tree"
  | "get_file_outline"
  | "suggest_initial_queries"
  | "query_code"
  | "diagnostics";
