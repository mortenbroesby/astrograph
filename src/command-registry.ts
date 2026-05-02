import type {
  ContextBundleOptions,
  DiagnosticsOptions,
  FileSummaryOptions,
  FindFilesOptions,
  ProjectStatusOptions,
  QueryCodeOptions,
  SearchSymbolsOptions,
  SearchTextOptions,
  SummaryStrategy,
  SymbolSourceResult,
  WatchOptions,
} from "./types.ts";

type EngineModule = typeof import("./index.ts");

export interface CommandRegistryEntry<Input = unknown> {
  id: string;
  cliCommand?: string;
  mcpToolName?: string;
  description: string;
  normalizedOptions: readonly string[];
  execute(engine: EngineModule, input: Input): Promise<unknown>;
}

interface IndexFolderInput {
  repoRoot: string;
  summaryStrategy?: SummaryStrategy;
}

interface IndexFileInput extends IndexFolderInput {
  filePath: string;
}

interface RepoRootInput {
  repoRoot: string;
}

interface FilePathInput extends RepoRootInput {
  filePath: string;
}

interface SymbolSourceInput {
  repoRoot: string;
  symbolId?: string;
  symbolIds?: string[];
  contextLines?: number;
  verify?: boolean;
}

interface RankedContextInput extends ContextBundleOptions {
  query: string;
}

export const COMMAND_REGISTRY = {
  init: {
    id: "init",
    cliCommand: "init",
    description: "Initialize and inspect Astrograph storage for a repository.",
    normalizedOptions: ["repoRoot"],
    execute: (engine, input: DiagnosticsOptions) => engine.diagnostics(input),
  },
  indexFolder: {
    id: "index_folder",
    cliCommand: "index-folder",
    mcpToolName: "index_folder",
    description: "Index all supported files under a repository root.",
    normalizedOptions: ["repoRoot", "summaryStrategy"],
    execute: (engine, input: IndexFolderInput) => engine.indexFolder(input),
  },
  indexFile: {
    id: "index_file",
    cliCommand: "index-file",
    mcpToolName: "index_file",
    description: "Refresh a single supported file within a repository.",
    normalizedOptions: ["repoRoot", "filePath", "summaryStrategy"],
    execute: (engine, input: IndexFileInput) => engine.indexFile(input),
  },
  watch: {
    id: "watch",
    cliCommand: "watch",
    description: "Watch a repository and refresh changed files.",
    normalizedOptions: ["repoRoot", "debounceMs", "summaryStrategy"],
    execute: (engine, input: WatchOptions) => engine.watchFolder(input),
  },
  findFiles: {
    id: "find_files",
    mcpToolName: "find_files",
    description: "Find repo files by path/name query and optional glob filter.",
    normalizedOptions: ["repoRoot", "query", "filePattern", "limit"],
    execute: (engine, input: FindFilesOptions) => engine.findFiles(input),
  },
  searchText: {
    id: "search_text",
    cliCommand: "search-text",
    mcpToolName: "search_text",
    description: "Search text across indexed or live repo content with bounded results.",
    normalizedOptions: ["repoRoot", "query", "filePattern", "limit"],
    execute: (engine, input: SearchTextOptions) => engine.searchText(input),
  },
  getFileSummary: {
    id: "get_file_summary",
    mcpToolName: "get_file_summary",
    description: "Return a deterministic summary for an indexed or discovery-only file.",
    normalizedOptions: ["repoRoot", "filePath"],
    execute: (engine, input: FileSummaryOptions) => engine.getFileSummary(input),
  },
  getProjectStatus: {
    id: "get_project_status",
    mcpToolName: "get_project_status",
    description: "Report readiness, freshness, support tiers, and watcher health.",
    normalizedOptions: ["repoRoot", "scanFreshness"],
    execute: (engine, input: ProjectStatusOptions) => engine.getProjectStatus(input),
  },
  getRepoOutline: {
    id: "get_repo_outline",
    cliCommand: "get-repo-outline",
    mcpToolName: "get_repo_outline",
    description: "Return file and symbol counts grouped by language.",
    normalizedOptions: ["repoRoot"],
    execute: (engine, input: RepoRootInput) => engine.getRepoOutline(input),
  },
  getFileTree: {
    id: "get_file_tree",
    cliCommand: "get-file-tree",
    mcpToolName: "get_file_tree",
    description: "Return indexed files with language and symbol counts.",
    normalizedOptions: ["repoRoot"],
    execute: (engine, input: RepoRootInput) => engine.getFileTree(input),
  },
  getFileOutline: {
    id: "get_file_outline",
    cliCommand: "get-file-outline",
    mcpToolName: "get_file_outline",
    description: "Return symbols for one indexed file.",
    normalizedOptions: ["repoRoot", "filePath"],
    execute: (engine, input: FilePathInput) => engine.getFileOutline(input),
  },
  suggestInitialQueries: {
    id: "suggest_initial_queries",
    cliCommand: "suggest-initial-queries",
    mcpToolName: "suggest_initial_queries",
    description: "Suggest likely entry points before code retrieval.",
    normalizedOptions: ["repoRoot"],
    execute: (engine, input: RepoRootInput) => engine.suggestInitialQueries(input),
  },
  searchSymbols: {
    id: "search_symbols",
    cliCommand: "search-symbols",
    description: "Search indexed symbols by name, kind, language, or file pattern.",
    normalizedOptions: [
      "repoRoot",
      "query",
      "kind",
      "language",
      "filePattern",
      "limit",
    ],
    execute: (engine, input: SearchSymbolsOptions) => engine.searchSymbols(input),
  },
  queryCode: {
    id: "query_code",
    cliCommand: "query-code",
    mcpToolName: "query_code",
    description: "Unified code query surface for discovery, exact retrieval, and bounded assembly.",
    normalizedOptions: [
      "repoRoot",
      "intent",
      "query",
      "symbolId",
      "symbolIds",
      "filePath",
      "kind",
      "language",
      "filePattern",
      "limit",
      "contextLines",
      "verify",
      "tokenBudget",
      "includeTextMatches",
      "includeRankedCandidates",
      "includeDependencies",
      "includeImporters",
      "includeReferences",
      "relationDepth",
    ],
    execute: (engine, input: QueryCodeOptions) => engine.queryCode(input),
  },
  getContextBundle: {
    id: "get_context_bundle",
    cliCommand: "get-context-bundle",
    description: "Build a bounded context bundle from query or symbol seeds.",
    normalizedOptions: [
      "repoRoot",
      "query",
      "symbolIds",
      "tokenBudget",
      "includeDependencies",
      "includeImporters",
      "includeReferences",
      "relationDepth",
    ],
    execute: (engine, input: ContextBundleOptions) => engine.getContextBundle(input),
  },
  getRankedContext: {
    id: "get_ranked_context",
    cliCommand: "get-ranked-context",
    description: "Rank and build a bounded context bundle for a query.",
    normalizedOptions: [
      "repoRoot",
      "query",
      "tokenBudget",
      "includeDependencies",
      "includeImporters",
      "includeReferences",
      "relationDepth",
    ],
    execute: (engine, input: RankedContextInput) => engine.getRankedContext(input),
  },
  getFileContent: {
    id: "get_file_content",
    cliCommand: "get-file-content",
    description: "Return text content for one repository file.",
    normalizedOptions: ["repoRoot", "filePath"],
    execute: (engine, input: FilePathInput) => engine.getFileContent(input),
  },
  getSymbolSource: {
    id: "get_symbol_source",
    cliCommand: "get-symbol-source",
    description: "Return source snippets for one or more indexed symbols.",
    normalizedOptions: ["repoRoot", "symbolId", "symbolIds", "contextLines", "verify"],
    execute: (engine, input: SymbolSourceInput): Promise<SymbolSourceResult> =>
      engine.getSymbolSource(input),
  },
  diagnostics: {
    id: "diagnostics",
    cliCommand: "diagnostics",
    mcpToolName: "diagnostics",
    description: "Report storage and freshness metadata.",
    normalizedOptions: ["repoRoot", "scanFreshness"],
    execute: (engine, input: DiagnosticsOptions) => engine.diagnostics(input),
  },
  doctor: {
    id: "doctor",
    cliCommand: "doctor",
    description: "Report a human-readable repository health check.",
    normalizedOptions: ["repoRoot", "scanFreshness"],
    execute: (engine, input: DiagnosticsOptions) => engine.doctor(input),
  },
} as const satisfies Record<string, CommandRegistryEntry<never>>;

export const COMMAND_REGISTRY_ENTRIES = Object.values(COMMAND_REGISTRY);
export const MCP_COMMAND_REGISTRY = COMMAND_REGISTRY_ENTRIES.filter(
  (entry): entry is typeof entry & { mcpToolName: string } =>
    "mcpToolName" in entry && typeof entry.mcpToolName === "string",
);
export const CLI_COMMAND_REGISTRY = COMMAND_REGISTRY_ENTRIES.filter(
  (entry): entry is typeof entry & { cliCommand: string } =>
    "cliCommand" in entry && typeof entry.cliCommand === "string",
);

const MCP_COMMAND_BY_TOOL_NAME = new Map(
  MCP_COMMAND_REGISTRY.map((entry) => [entry.mcpToolName, entry]),
);
const CLI_COMMAND_BY_NAME = new Map(
  CLI_COMMAND_REGISTRY.map((entry) => [entry.cliCommand, entry]),
);

export type CommandRegistryEntryName = keyof typeof COMMAND_REGISTRY;
export type McpRegistryToolName =
  (typeof MCP_COMMAND_REGISTRY)[number]["mcpToolName"];
export type CliRegistryCommandName =
  (typeof CLI_COMMAND_REGISTRY)[number]["cliCommand"];

export function getCommandByMcpToolName(
  name: string,
): (typeof MCP_COMMAND_REGISTRY)[number] | undefined {
  return MCP_COMMAND_BY_TOOL_NAME.get(name);
}

export function getCommandByCliCommand(
  name: string,
): (typeof CLI_COMMAND_REGISTRY)[number] | undefined {
  return CLI_COMMAND_BY_NAME.get(name);
}
