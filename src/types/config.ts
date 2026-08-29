export type SupportedLanguage =
  | "ts"
  | "tsx"
  | "js"
  | "jsx"
  | "python"
  | "bash"
  | "powershell"
  | "csharp"
  | "java"
  | "go"
  | "rust"
  | "json"
  | "html"
  | "css"
  | "c"
  | "cpp"
  | "php"
  | "ruby"
  | "template"
  | "scala";

export type StorageMode = "wal";
export type IndexBackendName = "sqlite";
export type StorageLocation = "repo-local" | "global";

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

export const RANKING_PATH_PRESET_CATEGORIES = [
  "generationCode",
  "appCode",
  "sharedRuntime",
] as const;
export type RankingPathPresetCategory = (typeof RANKING_PATH_PRESET_CATEGORIES)[number];
export type RankingPathPresets = Partial<Record<RankingPathPresetCategory, string[]>>;

export interface EnginePaths {
  storageDir: string;
  databasePath: string;
  repoMetaPath: string;
  integrityPath: string;
  storageVersionPath: string;
  eventsPath: string;
}

export interface StoragePathEnvironment {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: () => string;
}

export interface EngineConfig {
  repoRoot: string;
  languages: SupportedLanguage[];
  respectGitIgnore: boolean;
  storageMode: StorageMode;
  storageLocation: StorageLocation;
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
  rankingPathPresets: Record<RankingPathPresetCategory, string[]>;
  paths: EnginePaths;
}

export interface RepoObservabilityConfig {
  /** Days to retain local, non-source observability events before pruning them. */
  retentionDays?: number;
  /** Excludes source excerpts from locally stored observability events. */
  redactSourceText?: boolean;
}

export interface RepoOutputPrivacyConfig {
  /** Replaces values that look like secrets in Astrograph tool output. */
  redactSecretLikeValues?: boolean;
}

export interface RepoPerformanceConfig {
  /** Glob patterns to include when discovering files. Defaults to all supported files. */
  include?: string[];
  /** Glob patterns to exclude when discovering files. */
  exclude?: string[];
  /** Concurrent file-processing work, or "auto" to use the default for this machine. */
  fileProcessingConcurrency?: number | "auto";
  /** Optional worker-pool settings for parsing and indexing work. */
  workerPool?: {
    /** Enables the parser worker pool. */
    enabled?: boolean;
    /** Maximum workers to start, or "auto" to choose a safe default. */
    maxWorkers?: number | "auto";
  };
}

export interface RepoWatchConfig {
  /** File-watch implementation. "auto" selects the most suitable available backend. */
  backend?: "auto" | "parcel" | "node-fs-watch" | "polling";
  /** Milliseconds to wait after a change before refreshing the index. */
  debounceMs?: number;
}

export interface RepoRankingConfig {
  /** Score awarded for an exact symbol-name match. */
  exactName?: number;
  /** Score awarded for an exact qualified-symbol-name match. */
  exactQualifiedName?: number;
  /** Score awarded when a symbol name begins with the query. */
  prefixName?: number;
  /** Score awarded when a qualified symbol name begins with the query. */
  prefixQualifiedName?: number;
  /** Score awarded when a symbol name contains the query. */
  containsName?: number;
  /** Score awarded when a qualified symbol name contains the query. */
  containsQualifiedName?: number;
  /** Score awarded when a signature contains the query. */
  signatureContains?: number;
  /** Score awarded when a generated summary contains the query. */
  summaryContains?: number;
  /** Score awarded when a file path contains the query. */
  filePathContains?: number;
  /** Score awarded for each exact word match. */
  exactWord?: number;
  /** Score awarded for each token match. */
  tokenMatch?: number;
  /** Additional score for exported symbols. */
  exportedBonus?: number;
  /** Path globs that identify generated, app, and shared-runtime code. */
  pathPresets?: RankingPathPresets;
}

export interface RepoEngineConfig {
  /** How Astrograph creates source summaries. */
  summaryStrategy?: SummaryStrategy;
  /** SQLite journal mode. The supported mode is "wal". */
  storageMode?: StorageMode;
  /** Stores the index inside this repository or in the user-level Astrograph cache. */
  storageLocation?: StorageLocation;
  /** Retention and source-redaction settings for local observability data. */
  observability?: RepoObservabilityConfig;
  /** Secret-like-value redaction settings for tool responses. */
  outputPrivacy?: RepoOutputPrivacyConfig;
  /** File discovery and indexing-throughput settings. */
  performance?: RepoPerformanceConfig;
  /** Result-ranking weights and path classifications. */
  ranking?: RepoRankingConfig;
  /** File-watch backend and refresh timing. */
  watch?: RepoWatchConfig;
  /** Upper bounds that protect indexing and tool responses from excessive work. */
  limits?: {
    /** Maximum files Astrograph may discover during one index operation. */
    maxFilesDiscovered?: number;
    /** Largest source file, in bytes, Astrograph will process. */
    maxFileBytes?: number;
    /** Maximum symbols Astrograph records from one source file. */
    maxSymbolsPerFile?: number;
    /** Maximum symbols a symbol-search response may include. */
    maxSymbolResults?: number;
    /** Maximum text matches a text-search response may include. */
    maxTextResults?: number;
    /** Maximum captured output, in bytes, from an invoked child process. */
    maxChildProcessOutputBytes?: number;
    /** Maximum matches returned by a live, unindexed text search. */
    maxLiveSearchMatches?: number;
  };
}

export interface GlobalEngineConfig {
  storageLocation?: StorageLocation;
  /** Default local-only observability retention and redaction for this device. */
  observability?: RepoObservabilityConfig;
}

export interface ResolvedObservabilityConfig {
  retentionDays: number;
  redactSourceText: boolean;
}

export interface ResolvedOutputPrivacyConfig {
  redactSecretLikeValues: boolean;
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

export interface ResolvedRankingConfig extends RankingWeights {
  pathPresets: Record<RankingPathPresetCategory, string[]>;
}

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
  globalConfigPath: string | null;
  repoRoot: string;
  summaryStrategy: SummaryStrategy;
  storageMode: StorageMode;
  storageLocation: StorageLocation;
  observability: ResolvedObservabilityConfig;
  outputPrivacy: ResolvedOutputPrivacyConfig;
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
  | "search_symbols"
  | "get_symbol_source"
  | "get_task_context"
  | "diagnostics";
