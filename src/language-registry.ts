import path from "node:path";

import type {
  FallbackSupportDescriptor,
  FileSupportProfile,
  LanguageSupportDescriptor,
  SummaryStrategy,
  SupportedLanguage,
  SupportTier,
  TierToolAvailability,
} from "./types.ts";
import { SUMMARY_STRATEGIES, SUPPORT_TIERS } from "./types.ts";

const DISCOVERY_TOOL_AVAILABILITY: TierToolAvailability = {
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

const GRAPH_TOOL_AVAILABILITY: TierToolAvailability = {
  discovery: [...DISCOVERY_TOOL_AVAILABILITY.discovery],
  structured: ["get_file_summary"],
  graph: [
    "index_folder",
    "index_file",
    "get_repo_outline",
    "get_file_tree",
    "get_file_outline",
    "suggest_initial_queries",
    "query_code",
  ],
};

const GRAPH_SUMMARY_STRATEGIES: SummaryStrategy[] = [...SUMMARY_STRATEGIES];
const SUPPORT_TIER_RANK = new Map(
  SUPPORT_TIERS.map((tier, index) => [tier, index] as const),
);

export const LANGUAGE_SUPPORT_REGISTRY: LanguageSupportDescriptor[] = [
  {
    language: "ts",
    extensions: [".ts"],
    tiers: ["discovery", "structured", "graph"],
    summaryStrategies: GRAPH_SUMMARY_STRATEGIES,
    toolAvailability: GRAPH_TOOL_AVAILABILITY,
  },
  {
    language: "tsx",
    extensions: [".tsx"],
    tiers: ["discovery", "structured", "graph"],
    summaryStrategies: GRAPH_SUMMARY_STRATEGIES,
    toolAvailability: GRAPH_TOOL_AVAILABILITY,
  },
  {
    language: "js",
    extensions: [".js", ".cjs", ".mjs"],
    tiers: ["discovery", "structured", "graph"],
    summaryStrategies: GRAPH_SUMMARY_STRATEGIES,
    toolAvailability: GRAPH_TOOL_AVAILABILITY,
  },
  {
    language: "jsx",
    extensions: [".jsx"],
    tiers: ["discovery", "structured", "graph"],
    summaryStrategies: GRAPH_SUMMARY_STRATEGIES,
    toolAvailability: GRAPH_TOOL_AVAILABILITY,
  },
];

export const FALLBACK_SUPPORT_REGISTRY: FallbackSupportDescriptor[] = [
  {
    extension: ".md",
    tiers: ["discovery"],
    summarySource: "markdown-headings",
    toolAvailability: DISCOVERY_TOOL_AVAILABILITY,
  },
  {
    extension: ".mdx",
    tiers: ["discovery"],
    summarySource: "markdown-headings",
    toolAvailability: DISCOVERY_TOOL_AVAILABILITY,
  },
  {
    extension: ".json",
    tiers: ["discovery"],
    summarySource: "json-top-level-keys",
    toolAvailability: DISCOVERY_TOOL_AVAILABILITY,
  },
  {
    extension: ".yaml",
    tiers: ["discovery"],
    summarySource: "yaml-top-level-keys",
    toolAvailability: DISCOVERY_TOOL_AVAILABILITY,
  },
  {
    extension: ".yml",
    tiers: ["discovery"],
    summarySource: "yaml-top-level-keys",
    toolAvailability: DISCOVERY_TOOL_AVAILABILITY,
  },
  {
    extension: ".sql",
    tiers: ["discovery"],
    summarySource: "sql-schema-objects",
    toolAvailability: DISCOVERY_TOOL_AVAILABILITY,
  },
  {
    extension: ".sh",
    tiers: ["discovery"],
    summarySource: "shell-functions",
    toolAvailability: DISCOVERY_TOOL_AVAILABILITY,
  },
  {
    extension: ".txt",
    tiers: ["discovery"],
    summarySource: "text-lines",
    toolAvailability: DISCOVERY_TOOL_AVAILABILITY,
  },
];

const LANGUAGE_BY_EXTENSION = new Map<string, SupportedLanguage>();
for (const entry of LANGUAGE_SUPPORT_REGISTRY) {
  for (const extension of entry.extensions) {
    LANGUAGE_BY_EXTENSION.set(extension, entry.language);
  }
}

const LANGUAGE_SUPPORT_BY_LANGUAGE = new Map(
  LANGUAGE_SUPPORT_REGISTRY.map((entry) => [entry.language, entry] as const),
);

const FALLBACK_SUPPORT_BY_EXTENSION = new Map(
  FALLBACK_SUPPORT_REGISTRY.map((entry) => [entry.extension, entry] as const),
);

export function getSupportedLanguages(): SupportedLanguage[] {
  return LANGUAGE_SUPPORT_REGISTRY.map((entry) => entry.language);
}

export function supportedLanguageForFile(filePath: string): SupportedLanguage | null {
  return LANGUAGE_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) ?? null;
}

export function getLanguageSupport(
  language: SupportedLanguage,
): LanguageSupportDescriptor {
  const support = LANGUAGE_SUPPORT_BY_LANGUAGE.get(language);
  if (!support) {
    throw new Error(`Missing language support registry entry for ${language}`);
  }
  return support;
}

export function getLanguageSupportForFile(
  filePath: string,
): LanguageSupportDescriptor | null {
  const language = supportedLanguageForFile(filePath);
  return language ? getLanguageSupport(language) : null;
}

export function getFallbackSupportForFile(
  filePath: string,
): FallbackSupportDescriptor | null {
  return FALLBACK_SUPPORT_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) ?? null;
}

export function availableSupportTiersForFile(
  filePath: string,
  language: SupportedLanguage | null,
): SupportTier[] {
  if (language) {
    return [...getLanguageSupport(language).tiers];
  }

  return [...(getFallbackSupportForFile(filePath)?.tiers ?? ["discovery"])];
}

export function supportReasonForFile(
  filePath: string,
  language: SupportedLanguage | null,
): FileSupportProfile["reason"] {
  if (language) {
    return "supported-language";
  }

  return getFallbackSupportForFile(filePath) ? "fallback-extension" : "generic-discovery";
}

export function supportTierForFile(
  filePath: string,
  language: SupportedLanguage | null,
): SupportTier {
  return availableSupportTiersForFile(filePath, language).reduce((highest, candidate) =>
    (SUPPORT_TIER_RANK.get(candidate) ?? -1) > (SUPPORT_TIER_RANK.get(highest) ?? -1)
      ? candidate
      : highest,
  );
}

export function getLanguageRegistrySnapshot(): {
  byLanguage: LanguageSupportDescriptor[];
  byFallbackExtension: FallbackSupportDescriptor[];
} {
  return {
    byLanguage: LANGUAGE_SUPPORT_REGISTRY.map((entry) => ({
      ...entry,
      extensions: [...entry.extensions],
      tiers: [...entry.tiers],
      summaryStrategies: [...entry.summaryStrategies],
      toolAvailability: {
        discovery: [...entry.toolAvailability.discovery],
        structured: [...entry.toolAvailability.structured],
        graph: [...entry.toolAvailability.graph],
      },
    })),
    byFallbackExtension: FALLBACK_SUPPORT_REGISTRY.map((entry) => ({
      ...entry,
      tiers: [...entry.tiers],
      toolAvailability: {
        discovery: [...entry.toolAvailability.discovery],
        structured: [...entry.toolAvailability.structured],
        graph: [...entry.toolAvailability.graph],
      },
    })),
  };
}

export function listFallbackExtensions(): string[] {
  return FALLBACK_SUPPORT_REGISTRY.map((entry) => entry.extension);
}

export function listDiscoverySummarySources() {
  return [...new Set(FALLBACK_SUPPORT_REGISTRY.map((entry) => entry.summarySource))];
}

export function listLanguagesForTier(tier: SupportTier): SupportedLanguage[] {
  return LANGUAGE_SUPPORT_REGISTRY
    .filter((entry) => entry.tiers.includes(tier))
    .map((entry) => entry.language);
}
