import { SUMMARY_STRATEGIES } from "../types/config.ts";
import type { SummaryStrategy } from "../types/config.ts";
import type { ParseSourceInput, ParsedFile } from "../parser/shared.ts";
import type { SupportTier, TierToolAvailability } from "../types/retrieval.ts";
import {
  defineLanguageAdapter,
  type LanguageAdapter,
} from "./types.ts";

const JS_FAMILY_TIERS: SupportTier[] = ["discovery", "structured", "graph"];
const JS_FAMILY_SUMMARY_STRATEGIES: SummaryStrategy[] = [...SUMMARY_STRATEGIES];

export const DISCOVERY_TOOL_AVAILABILITY: TierToolAvailability = {
  discovery: [
    "find_files",
    "search_text",
    "get_file_summary",
    "get_project_status",
    "diagnostics",
  ],
  structured: [],
  graph: [],
};

export const GRAPH_TOOL_AVAILABILITY: TierToolAvailability = {
  discovery: [...DISCOVERY_TOOL_AVAILABILITY.discovery],
  structured: ["get_file_summary"],
  graph: [
    "index_folder",
    "index_file",
    "get_repo_outline",
    "get_file_tree",
    "get_file_outline",
    "suggest_initial_queries",
    "search_symbols",
    "find_importers",
    "find_references",
    "get_symbol_source",
    "get_dependency_graph",
    "get_context_bundle",
    "get_ranked_context",
  ],
};

export const TREE_SITTER_CHUNK_RECOVERY_FALLBACK_REASON = "tree-sitter-chunk-recovery";

type JsFamilyLanguage = "ts" | "tsx" | "js" | "jsx";

type ParseImplementation = (input: ParseSourceInput) => ParsedFile;

function unregisteredTreeSitterParse(
  input: ParseSourceInput,
): ParsedFile {
  throw new Error(
    `Tree-sitter JS family adapter parse implementation is not registered for ${input.language}`,
  );
}

export function registerTreeSitterJsFamilyParseImplementation(
  implementation: ParseImplementation,
): void {
  for (const adapter of TREE_SITTER_JS_FAMILY_ADAPTERS) {
    adapter.parse = implementation;
  }
}

function createTreeSitterJsFamilyAdapter<const TLanguage extends JsFamilyLanguage>(
  language: TLanguage,
  extensions: string[],
): LanguageAdapter<TLanguage> {
  return defineLanguageAdapter({
    language,
    extensions,
    tiers: [...JS_FAMILY_TIERS],
    toolAvailability: {
      discovery: [...GRAPH_TOOL_AVAILABILITY.discovery],
      structured: [...GRAPH_TOOL_AVAILABILITY.structured],
      graph: [...GRAPH_TOOL_AVAILABILITY.graph],
    },
    summaryStrategies: [...JS_FAMILY_SUMMARY_STRATEGIES],
    parserBackend: "tree-sitter",
    parseBehavior: {
      chunkRecoveryFallbackReason: TREE_SITTER_CHUNK_RECOVERY_FALLBACK_REASON,
    },
    parse: unregisteredTreeSitterParse,
  });
}

export const TREE_SITTER_JS_FAMILY_ADAPTERS = [
  createTreeSitterJsFamilyAdapter("ts", [".ts"]),
  createTreeSitterJsFamilyAdapter("tsx", [".tsx"]),
  createTreeSitterJsFamilyAdapter("js", [".js", ".cjs", ".mjs"]),
  createTreeSitterJsFamilyAdapter("jsx", [".jsx"]),
] as const satisfies readonly LanguageAdapter<JsFamilyLanguage>[];
