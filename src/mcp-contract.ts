import type { z } from "zod";
import * as zod from "zod";

import { parseSummaryStrategy } from "./config.ts";
import {
  parseQueryCodeMcpInput,
  validateFindFilesOptions,
  validateFileSummaryOptions,
  validateProjectStatusOptions,
  validateSearchTextOptions,
} from "./validation.ts";
import { ASTROGRAPH_PACKAGE_VERSION } from "./version.ts";

type EngineModule = typeof import("./index.ts");

export const MCP_SERVER_NAME = "astrograph";
export const MCP_SERVER_VERSION = ASTROGRAPH_PACKAGE_VERSION;

type McpToolSchema = Record<string, z.ZodType>;
type McpToolExecutor = (
  engine: EngineModule,
  args: Record<string, unknown>,
) => Promise<unknown>;

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpToolSchema;
  execute: McpToolExecutor;
}

function stringSchema(description: string) {
  return zod.string().describe(description);
}

function numberSchema(description: string) {
  return zod.number().describe(description);
}

function booleanSchema(description: string) {
  return zod.boolean().describe(description);
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required argument: ${key}`);
  }

  return value;
}

export const MCP_TOOL_DEFINITIONS = [
  {
    name: "index_folder",
    description: "Index all supported files under a repository root.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      summaryStrategy: stringSchema("Optional summary strategy override").optional(),
    },
    execute: async (engine, args) =>
      engine.indexFolder({
        repoRoot: requireString(args, "repoRoot"),
        summaryStrategy:
          typeof args.summaryStrategy === "string"
            ? parseSummaryStrategy(args.summaryStrategy, "summaryStrategy")
            : undefined,
      }),
  },
  {
    name: "index_file",
    description: "Refresh a single supported file within a repository.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      filePath: stringSchema("Path relative to the repository root"),
      summaryStrategy: stringSchema("Optional summary strategy override").optional(),
    },
    execute: async (engine, args) =>
      engine.indexFile({
        repoRoot: requireString(args, "repoRoot"),
        filePath: requireString(args, "filePath"),
        summaryStrategy:
          typeof args.summaryStrategy === "string"
            ? parseSummaryStrategy(args.summaryStrategy, "summaryStrategy")
            : undefined,
      }),
  },
  {
    name: "find_files",
    description: "Find repo files by path/name query and optional glob filter.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      query: stringSchema("Optional path or file-name query").optional(),
      filePattern: stringSchema("Optional glob-like file path filter").optional(),
      limit: numberSchema("Optional maximum number of file results").optional(),
    },
    execute: async (engine, args) => {
      const input = {
        repoRoot: requireString(args, "repoRoot"),
        query: typeof args.query === "string" ? args.query : undefined,
        filePattern: typeof args.filePattern === "string" ? args.filePattern : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
      };
      const normalized = validateFindFilesOptions(input);
      return engine.findFiles({
        ...input,
        ...normalized,
      });
    },
  },
  {
    name: "search_text",
    description: "Search text across indexed or live repo content with bounded results.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      query: stringSchema("Case-insensitive search query"),
      filePattern: stringSchema("Optional glob-like file path filter").optional(),
      limit: numberSchema("Optional maximum number of text results").optional(),
    },
    execute: async (engine, args) => {
      const input = {
        repoRoot: requireString(args, "repoRoot"),
        query: requireString(args, "query"),
        filePattern: typeof args.filePattern === "string" ? args.filePattern : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
      };
      validateSearchTextOptions(input);
      return engine.searchText(input);
    },
  },
  {
    name: "get_file_summary",
    description: "Return a deterministic summary for an indexed or discovery-only file.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      filePath: stringSchema("Path relative to the repository root"),
    },
    execute: async (engine, args) => {
      const input = {
        repoRoot: requireString(args, "repoRoot"),
        filePath: requireString(args, "filePath"),
      };
      validateFileSummaryOptions(input);
      return engine.getFileSummary(input);
    },
  },
  {
    name: "get_project_status",
    description: "Report readiness, freshness, support tiers, and watcher health.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      scanFreshness: booleanSchema("When true, walk and hash the live repository to detect drift").optional(),
    },
    execute: async (engine, args) => {
      const input = {
        repoRoot: requireString(args, "repoRoot"),
        scanFreshness: args.scanFreshness === true,
      };
      validateProjectStatusOptions(input);
      return engine.getProjectStatus(input);
    },
  },
  {
    name: "get_repo_outline",
    description: "Return file and symbol counts grouped by language.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
    },
    execute: async (engine, args) =>
      engine.getRepoOutline({
        repoRoot: requireString(args, "repoRoot"),
      }),
  },
  {
    name: "get_file_tree",
    description: "Return indexed files with language and symbol counts.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
    },
    execute: async (engine, args) =>
      engine.getFileTree({
        repoRoot: requireString(args, "repoRoot"),
      }),
  },
  {
    name: "get_file_outline",
    description: "Return symbols for one indexed file.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      filePath: stringSchema("Path relative to the repository root"),
    },
    execute: async (engine, args) =>
      engine.getFileOutline({
        repoRoot: requireString(args, "repoRoot"),
        filePath: requireString(args, "filePath"),
      }),
  },
  {
    name: "suggest_initial_queries",
    description: "Suggest likely entry points before code retrieval.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
    },
    execute: async (engine, args) =>
      engine.suggestInitialQueries({
        repoRoot: requireString(args, "repoRoot"),
      }),
  },
  {
    name: "query_code",
    description: "Unified code query surface for discovery, exact retrieval, and bounded assembly.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      intent: stringSchema("Optional intent override: auto, discover, source, or assemble").optional(),
      query: stringSchema("Optional query for discover and assemble intents").optional(),
      symbolId: stringSchema("Optional indexed symbol id").optional(),
      symbolIds: zod.array(stringSchema("Indexed symbol id")).describe("Optional indexed symbol ids").optional(),
      filePath: stringSchema("Optional path relative to the repository root").optional(),
      kind: stringSchema("Optional symbol kind filter").optional(),
      language: stringSchema("Optional supported language filter").optional(),
      filePattern: stringSchema("Optional glob-like file path filter").optional(),
      limit: numberSchema("Optional maximum number of symbol results").optional(),
      contextLines: numberSchema("Optional surrounding context line count").optional(),
      verify: booleanSchema("Verify symbol-source content hash before returning").optional(),
      tokenBudget: numberSchema("Optional bundle token budget").optional(),
      includeTextMatches: booleanSchema("When discover intent is used, include raw text matches too").optional(),
      includeRankedCandidates: booleanSchema("When assemble intent is used, include ranked candidate output too").optional(),
      includeDependencies: booleanSchema("When true, expand query_code results through imported dependency symbols").optional(),
      includeImporters: booleanSchema("When true, expand query_code results through reverse importer symbols").optional(),
      includeReferences: booleanSchema("When true, expand query_code results through importer files that explicitly reference the matched symbol").optional(),
      relationDepth: numberSchema("Optional bounded graph expansion depth for dependency/importer traversal").optional(),
    },
    execute: async (engine, args) => engine.queryCode(parseQueryCodeMcpInput(args)),
  },
  {
    name: "diagnostics",
    description: "Report storage and freshness metadata.",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      scanFreshness: booleanSchema("When true, walk and hash the live repository to detect drift").optional(),
    },
    execute: async (engine, args) =>
      engine.diagnostics({
        repoRoot: requireString(args, "repoRoot"),
        scanFreshness: args.scanFreshness === true,
      }),
  },
] as const satisfies readonly McpToolDefinition[];

const MCP_TOOL_MAP = new Map<string, McpToolDefinition>(
  MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]),
);

export type McpToolName = (typeof MCP_TOOL_DEFINITIONS)[number]["name"];

export function getMcpToolDefinition(name: string): McpToolDefinition | undefined {
  return MCP_TOOL_MAP.get(name);
}
