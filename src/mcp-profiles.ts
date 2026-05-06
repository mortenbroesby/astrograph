import type { McpRegistryToolName } from "./command-registry.ts";

export type McpRuntimeProfile = "core" | "standard" | "full";

export const MCP_PROFILE_NAMES = ["core", "standard", "full"] as const;
export const MCP_RUNTIME_PROFILES: Record<
  McpRuntimeProfile,
  readonly McpRegistryToolName[]
> = {
  core: [
    "get_file_summary",
    "suggest_initial_queries",
    "search_symbols",
    "get_symbol_source",
    "get_context_bundle",
    "find_files",
    "search_text",
    "get_project_status",
  ],
  standard: [
    "get_file_summary",
    "suggest_initial_queries",
    "search_symbols",
    "get_symbol_source",
    "get_context_bundle",
    "find_files",
    "search_text",
    "get_project_status",
    "get_file_tree",
    "get_file_outline",
    "get_repo_outline",
    "get_ranked_context",
    "find_importers",
    "find_references",
    "get_dependency_graph",
    "diagnostics",
  ],
  full: [
    "get_file_summary",
    "suggest_initial_queries",
    "search_symbols",
    "get_symbol_source",
    "get_context_bundle",
    "find_files",
    "search_text",
    "get_project_status",
    "get_file_tree",
    "get_file_outline",
    "get_repo_outline",
    "get_ranked_context",
    "find_importers",
    "find_references",
    "get_dependency_graph",
    "diagnostics",
    "index_folder",
    "index_file",
  ],
};

export function parseMcpProfile(value: string | undefined): McpRuntimeProfile | undefined {
  if (!value) {
    return undefined;
  }
  return (MCP_PROFILE_NAMES as readonly string[]).includes(value)
    ? (value as McpRuntimeProfile)
    : undefined;
}

export function getMcpToolsForProfile(
  profile: McpRuntimeProfile,
): readonly McpRegistryToolName[] {
  return MCP_RUNTIME_PROFILES[profile];
}

export function getMcpProfileFromValue(value: string | undefined): McpRuntimeProfile {
  return parseMcpProfile(value) ?? "full";
}
