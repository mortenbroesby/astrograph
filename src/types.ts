export type SupportedLanguage = "ts" | "tsx" | "js" | "jsx";

export type StorageMode = "wal";
export type IndexBackendName = "sqlite";

export type StaleStatus = "unknown" | "fresh" | "stale";

export const SUMMARY_STRATEGIES = ["doc-comments-first", "signature-only"] as const;
export type SummaryStrategy = (typeof SUMMARY_STRATEGIES)[number];

export type SummarySource = "doc-comment" | "signature";

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
  backend?: WatchBackendKind | "auto";
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
  backend: WatchBackendKind | "auto";
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

export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "constant"
  | "type";

export interface IndexSummary {
  indexedFiles: number;
  indexedSymbols: number;
  staleStatus: StaleStatus;
}

export interface WatchEvent {
  type: "ready" | "reindex" | "error" | "close";
  changedPaths: string[];
  summary?: IndexSummary;
  message?: string;
}

export interface WatchOptions {
  repoRoot: string;
  debounceMs?: number;
  backend?: WatchBackendKind | "auto";
  summaryStrategy?: SummaryStrategy;
  onEvent?: (event: WatchEvent) => void | Promise<void>;
}

export interface WatchHandle {
  close(): Promise<void>;
}

export type WatchBackendKind = "parcel" | "node-fs-watch" | "polling";

export interface WatchDiagnostics {
  status: "idle" | "watching";
  backend: WatchBackendKind | null;
  debounceMs: number | null;
  pollMs: number | null;
  startedAt: string | null;
  lastEvent: WatchEvent["type"] | null;
  lastEventAt: string | null;
  lastChangedPaths: string[];
  reindexCount: number;
  lastError: string | null;
  lastSummary: IndexSummary | null;
}

export interface RepoOutline {
  totalFiles: number;
  totalSymbols: number;
  languages: Partial<Record<SupportedLanguage, number>>;
}

export type ImportSpecifierKind = "named" | "default" | "namespace" | "unknown";

export interface ImportSpecifier {
  kind: ImportSpecifierKind;
  importedName: string;
  localName: string | null;
}

export interface FileTreeEntry {
  path: string;
  language: SupportedLanguage;
  symbolCount: number;
}

export interface SymbolSummary {
  id: string;
  name: string;
  qualifiedName: string | null;
  kind: SymbolKind;
  filePath: string;
  signature: string;
  summary: string;
  summarySource: SummarySource;
  startLine: number;
  endLine: number;
  exported: boolean;
}

export interface FileOutline {
  filePath: string;
  symbols: SymbolSummary[];
}

export interface SearchSymbolsOptions {
  repoRoot: string;
  query: string;
  kind?: SymbolKind;
  language?: SupportedLanguage;
  filePattern?: string;
  limit?: number;
}

export interface SearchTextMatch {
  filePath: string;
  line: number;
  preview: string;
  source?: "index" | "live_disk_match";
  reason?: "ripgrep_fallback";
}

export interface SearchTextOptions {
  repoRoot: string;
  query: string;
  filePattern?: string;
  limit?: number;
}

export interface FileContentResult {
  filePath: string;
  content: string;
}

export const SUPPORT_TIERS = ["discovery", "structured", "graph"] as const;
export type SupportTier = (typeof SUPPORT_TIERS)[number];
export type FileSummarySource =
  | "structured"
  | "markdown-headings"
  | "json-top-level-keys"
  | "yaml-top-level-keys"
  | "sql-schema-objects"
  | "shell-functions"
  | "text-lines";

export interface FileSupportProfile {
  activeTier: SupportTier;
  availableTiers: SupportTier[];
  reason: "supported-language" | "fallback-extension" | "generic-discovery";
}

export interface TierToolAvailability {
  discovery: EngineToolName[];
  structured: EngineToolName[];
  graph: EngineToolName[];
}

export interface LanguageSupportDescriptor {
  language: SupportedLanguage;
  extensions: string[];
  tiers: SupportTier[];
  summaryStrategies: SummaryStrategy[];
  toolAvailability: TierToolAvailability;
}

export interface FallbackSupportDescriptor {
  extension: string;
  tiers: SupportTier[];
  summarySource: Exclude<FileSummarySource, "structured">;
  toolAvailability: TierToolAvailability;
}

export interface FindFilesOptions {
  repoRoot: string;
  query?: string;
  filePattern?: string;
  limit?: number;
}

export interface FindFilesMatch {
  filePath: string;
  fileName: string;
  language: SupportedLanguage | null;
  supportTier: SupportTier;
  indexed: boolean;
  matchReason: "path" | "name" | "pattern";
}

export interface FileSummaryOptions {
  repoRoot: string;
  filePath: string;
}

export interface FileSummarySymbol {
  name: string;
  kind: SymbolKind;
  line: number;
}

export interface FileSummaryResult {
  filePath: string;
  fileName: string;
  language: SupportedLanguage | null;
  supportTier: SupportTier;
  support: FileSupportProfile;
  indexed: boolean;
  summarySource: FileSummarySource;
  summary: string;
  confidence: "high" | "medium";
  symbolCount: number;
  topSymbols: FileSummarySymbol[];
  hints: string[];
}

export interface SymbolSourceItem {
  symbol: SymbolSummary;
  source: string;
  verified: boolean;
  startLine: number;
  endLine: number;
}

export interface SymbolSourceResult {
  requestedContextLines: number;
  items: SymbolSourceItem[];
  symbol?: SymbolSummary;
  source?: string;
  verified?: boolean;
  startLine?: number;
  endLine?: number;
}

export type QueryCodeIntent = "discover" | "source" | "assemble" | "auto";

export interface AstrographVersionParts {
  major: number;
  minor: number;
  patch: number;
  increment: number;
}

export interface QueryCodeOptions {
  repoRoot: string;
  intent?: QueryCodeIntent;
  query?: string;
  symbolId?: string;
  symbolIds?: string[];
  filePath?: string;
  kind?: SymbolKind;
  language?: SupportedLanguage;
  filePattern?: string;
  limit?: number;
  contextLines?: number;
  verify?: boolean;
  tokenBudget?: number;
  includeTextMatches?: boolean;
  includeRankedCandidates?: boolean;
  includeDependencies?: boolean;
  includeImporters?: boolean;
  includeReferences?: boolean;
  relationDepth?: number;
}

export type QueryCodeMatchReason =
  | "explicit_symbol_id"
  | "exact_symbol_match"
  | "query_match"
  | "text_match"
  | "ripgrep_fallback"
  | "imports_matched_file"
  | "imported_by_match"
  | "references_match"
  | "reexport_match";

export interface QueryCodeSymbolMatch {
  symbol: SymbolSummary;
  reasons: QueryCodeMatchReason[];
  depth: number;
}

export interface QueryCodeTextMatch {
  match: SearchTextMatch;
  reasons: QueryCodeMatchReason[];
}

export interface QueryCodeDiscoverResult {
  intent: "discover";
  query: string;
  symbolMatches: SymbolSummary[];
  textMatches: SearchTextMatch[];
  matches: QueryCodeSymbolMatch[];
  textMatchResults: QueryCodeTextMatch[];
}

export interface QueryCodeSourceResult {
  intent: "source";
  fileContent: FileContentResult | null;
  symbolSource: SymbolSourceResult | null;
}

export interface QueryCodeAssembleResult {
  intent: "assemble";
  bundle: ContextBundle;
  ranked: RankedContextResult | null;
}

export type QueryCodeResult =
  | QueryCodeDiscoverResult
  | QueryCodeSourceResult
  | QueryCodeAssembleResult;

export type ContextBundleItemRole = "target" | "dependency";

export interface ContextBundleItem {
  role: ContextBundleItemRole;
  reason: string;
  symbol: SymbolSummary;
  source: string;
  tokenCount: number;
}

export interface ContextBundle {
  repoRoot: string;
  query: string | null;
  tokenBudget: number;
  estimatedTokens: number;
  usedTokens: number;
  truncated: boolean;
  items: ContextBundleItem[];
}

export interface ContextBundleOptions {
  repoRoot: string;
  query?: string;
  symbolIds?: string[];
  tokenBudget?: number;
  includeDependencies?: boolean;
  includeImporters?: boolean;
  includeReferences?: boolean;
  relationDepth?: number;
}

export interface RankedContextCandidate {
  rank: number;
  score: number;
  reason: string;
  symbol: SymbolSummary;
  selected: boolean;
}

export interface RankedContextResult {
  repoRoot: string;
  query: string;
  tokenBudget: number;
  candidateCount: number;
  selectedSeedIds: string[];
  candidates: RankedContextCandidate[];
  bundle: ContextBundle;
}

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
  status: "disabled" | "running" | "not-running" | "unhealthy";
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
