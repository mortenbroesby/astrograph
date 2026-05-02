import type { EngineToolName, SupportedLanguage, SummaryStrategy } from "./config.ts";

export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "constant"
  | "type";

export type SummarySource = "doc-comment" | "signature";

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
