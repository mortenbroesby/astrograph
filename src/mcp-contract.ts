import type { z } from "zod";
import * as zod from "zod";

import { parseSummaryStrategy } from "./config.ts";
import {
  COMMAND_REGISTRY,
  MCP_COMMAND_REGISTRY,
  type McpRegistryToolName,
} from "./command-registry.ts";
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
    name: COMMAND_REGISTRY.indexFolder.mcpToolName,
    description: COMMAND_REGISTRY.indexFolder.description,
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      summaryStrategy: stringSchema("Optional summary strategy override").optional(),
    },
    execute: async (engine, args) =>
      COMMAND_REGISTRY.indexFolder.execute(engine, {
        repoRoot: requireString(args, "repoRoot"),
        summaryStrategy:
          typeof args.summaryStrategy === "string"
            ? parseSummaryStrategy(args.summaryStrategy, "summaryStrategy")
            : undefined,
      }),
  },
  {
    name: COMMAND_REGISTRY.indexFile.mcpToolName,
    description: COMMAND_REGISTRY.indexFile.description,
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      filePath: stringSchema("Path relative to the repository root"),
      summaryStrategy: stringSchema("Optional summary strategy override").optional(),
    },
    execute: async (engine, args) =>
      COMMAND_REGISTRY.indexFile.execute(engine, {
        repoRoot: requireString(args, "repoRoot"),
        filePath: requireString(args, "filePath"),
        summaryStrategy:
          typeof args.summaryStrategy === "string"
            ? parseSummaryStrategy(args.summaryStrategy, "summaryStrategy")
            : undefined,
      }),
  },
  {
    name: COMMAND_REGISTRY.findFiles.mcpToolName,
    description: COMMAND_REGISTRY.findFiles.description,
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
      return COMMAND_REGISTRY.findFiles.execute(engine, {
        ...input,
        ...normalized,
      });
    },
  },
  {
    name: COMMAND_REGISTRY.searchText.mcpToolName,
    description: COMMAND_REGISTRY.searchText.description,
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
      return COMMAND_REGISTRY.searchText.execute(engine, input);
    },
  },
  {
    name: COMMAND_REGISTRY.getFileSummary.mcpToolName,
    description: COMMAND_REGISTRY.getFileSummary.description,
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
      return COMMAND_REGISTRY.getFileSummary.execute(engine, input);
    },
  },
  {
    name: COMMAND_REGISTRY.getProjectStatus.mcpToolName,
    description: COMMAND_REGISTRY.getProjectStatus.description,
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
      return COMMAND_REGISTRY.getProjectStatus.execute(engine, input);
    },
  },
  {
    name: COMMAND_REGISTRY.getRepoOutline.mcpToolName,
    description: COMMAND_REGISTRY.getRepoOutline.description,
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
    },
    execute: async (engine, args) =>
      COMMAND_REGISTRY.getRepoOutline.execute(engine, {
        repoRoot: requireString(args, "repoRoot"),
      }),
  },
  {
    name: COMMAND_REGISTRY.getFileTree.mcpToolName,
    description: COMMAND_REGISTRY.getFileTree.description,
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
    },
    execute: async (engine, args) =>
      COMMAND_REGISTRY.getFileTree.execute(engine, {
        repoRoot: requireString(args, "repoRoot"),
      }),
  },
  {
    name: COMMAND_REGISTRY.getFileOutline.mcpToolName,
    description: COMMAND_REGISTRY.getFileOutline.description,
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      filePath: stringSchema("Path relative to the repository root"),
    },
    execute: async (engine, args) =>
      COMMAND_REGISTRY.getFileOutline.execute(engine, {
        repoRoot: requireString(args, "repoRoot"),
        filePath: requireString(args, "filePath"),
      }),
  },
  {
    name: COMMAND_REGISTRY.suggestInitialQueries.mcpToolName,
    description: COMMAND_REGISTRY.suggestInitialQueries.description,
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
    },
    execute: async (engine, args) =>
      COMMAND_REGISTRY.suggestInitialQueries.execute(engine, {
        repoRoot: requireString(args, "repoRoot"),
      }),
  },
  {
    name: COMMAND_REGISTRY.queryCode.mcpToolName,
    description: COMMAND_REGISTRY.queryCode.description,
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
    execute: async (engine, args) =>
      COMMAND_REGISTRY.queryCode.execute(engine, parseQueryCodeMcpInput(args)),
  },
  {
    name: COMMAND_REGISTRY.diagnostics.mcpToolName,
    description: COMMAND_REGISTRY.diagnostics.description,
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      scanFreshness: booleanSchema("When true, walk and hash the live repository to detect drift").optional(),
    },
    execute: async (engine, args) =>
      COMMAND_REGISTRY.diagnostics.execute(engine, {
        repoRoot: requireString(args, "repoRoot"),
        scanFreshness: args.scanFreshness === true,
      }),
  },
] as const satisfies readonly McpToolDefinition[];

const MCP_TOOL_MAP = new Map<string, McpToolDefinition>(
  MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]),
);

export type McpToolName = McpRegistryToolName;

const registeredMcpToolNames = MCP_TOOL_DEFINITIONS.map((tool) => tool.name);
const registryMcpToolNames = MCP_COMMAND_REGISTRY.map((tool) => tool.mcpToolName);
if (registeredMcpToolNames.join("\0") !== registryMcpToolNames.join("\0")) {
  throw new Error("MCP tool definitions must stay aligned with the command registry");
}

export function getMcpToolDefinition(name: string): McpToolDefinition | undefined {
  return MCP_TOOL_MAP.get(name);
}
