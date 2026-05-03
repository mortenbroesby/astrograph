import type { z } from "zod";
import * as zod from "zod";

import { parseSummaryStrategy } from "./config.ts";
import {
  COMMAND_REGISTRY,
  MCP_COMMAND_REGISTRY,
  type McpRegistryToolName,
} from "./command-registry.ts";
import type { SupportedLanguage, SymbolKind } from "./types.ts";
import {
  validateContextBundleOptions,
  validateFindFilesOptions,
  validateFileSummaryOptions,
  validateProjectStatusOptions,
  validateRankedContextOptions,
  validateSearchTextOptions,
  validateSearchSymbolsOptions,
  validateSymbolSourceOptions,
} from "./validation.ts";
import { ASTROGRAPH_PACKAGE_VERSION } from "./version.ts";

type EngineModule = typeof import("./index.ts");

export const MCP_SERVER_NAME = "astrograph";
export const MCP_SERVER_VERSION = ASTROGRAPH_PACKAGE_VERSION;

export type McpDataFreshness = "fresh" | "stale" | "unknown";

export interface McpResponseEnvelope<T> {
  ok: true;
  data: T;
  meta: {
    toolVersion: "1";
    tokenBudgetUsed: number | null;
    dataFreshness: McpDataFreshness;
    warnings?: string[];
  };
}

export interface McpErrorEnvelope {
  ok: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    toolVersion: "1";
    tokenBudgetUsed: null;
    dataFreshness: "unknown";
  };
}

export type McpEnvelope<T> = McpResponseEnvelope<T> | McpErrorEnvelope;

type McpToolSchema = Record<string, z.ZodType>;
type McpToolExecutor = (
  engine: EngineModule,
  args: Record<string, unknown>,
) => Promise<unknown>;

export interface McpToolDefinition {
  name: string;
  description: string;
  toolVersion: "1";
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

function stringArraySchema(description: string) {
  return zod.array(zod.string()).describe(description);
}

const symbolKindSchema = zod
  .enum(["function", "class", "method", "constant", "type"])
  .describe("Optional symbol kind filter");
const supportedLanguageSchema = zod
  .enum(["ts", "tsx", "js", "jsx"])
  .describe("Optional supported language filter");

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required argument: ${key}`);
  }

  return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid string argument: ${key}`);
  }
  return value;
}

function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric argument: ${key}`);
  }
  return value;
}

function optionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Invalid boolean argument: ${key}`);
  }
  return value;
}

function optionalStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`Invalid string array argument: ${key}`);
  }
  return value;
}

function optionalSymbolKind(
  args: Record<string, unknown>,
  key: string,
): SymbolKind | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  const parsed = symbolKindSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Unsupported ${key}: ${String(value)}`);
  }
  return parsed.data;
}

function optionalSupportedLanguage(
  args: Record<string, unknown>,
  key: string,
): SupportedLanguage | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  const parsed = supportedLanguageSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Unsupported ${key}: ${String(value)}`);
  }
  return parsed.data;
}

export const MCP_TOOL_DEFINITIONS = [
  {
    name: COMMAND_REGISTRY.indexFolder.mcpToolName,
    description: COMMAND_REGISTRY.indexFolder.description,
    toolVersion: "1",
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
    toolVersion: "1",
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
    toolVersion: "1",
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
    toolVersion: "1",
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
    toolVersion: "1",
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
    toolVersion: "1",
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
    toolVersion: "1",
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
    toolVersion: "1",
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
    toolVersion: "1",
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
    toolVersion: "1",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
    },
    execute: async (engine, args) =>
      COMMAND_REGISTRY.suggestInitialQueries.execute(engine, {
        repoRoot: requireString(args, "repoRoot"),
      }),
  },
  {
    name: COMMAND_REGISTRY.searchSymbols.mcpToolName,
    description: COMMAND_REGISTRY.searchSymbols.description,
    toolVersion: "1",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      query: stringSchema("Symbol name or signature query"),
      kind: symbolKindSchema.optional(),
      language: supportedLanguageSchema.optional(),
      filePattern: stringSchema("Optional glob-like file path filter").optional(),
      limit: numberSchema("Optional maximum number of symbol results").optional(),
    },
    execute: async (engine, args) => {
      const input = {
        repoRoot: requireString(args, "repoRoot"),
        query: requireString(args, "query"),
        kind: optionalSymbolKind(args, "kind"),
        language: optionalSupportedLanguage(args, "language"),
        filePattern: optionalString(args, "filePattern"),
        limit: optionalNumber(args, "limit"),
      };
      validateSearchSymbolsOptions(input);
      return COMMAND_REGISTRY.searchSymbols.execute(engine, input);
    },
  },
  {
    name: COMMAND_REGISTRY.getSymbolSource.mcpToolName,
    description: COMMAND_REGISTRY.getSymbolSource.description,
    toolVersion: "1",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      symbolId: stringSchema("Optional indexed symbol id").optional(),
      symbolIds: stringArraySchema("Optional indexed symbol ids").optional(),
      contextLines: numberSchema("Optional surrounding context line count").optional(),
      verify: booleanSchema("Verify symbol-source content hash before returning").optional(),
    },
    execute: async (engine, args) => {
      const input = {
        repoRoot: requireString(args, "repoRoot"),
        symbolId: optionalString(args, "symbolId"),
        symbolIds: optionalStringArray(args, "symbolIds"),
        contextLines: optionalNumber(args, "contextLines"),
        verify: optionalBoolean(args, "verify"),
      };
      validateSymbolSourceOptions(input);
      return COMMAND_REGISTRY.getSymbolSource.execute(engine, input);
    },
  },
  {
    name: COMMAND_REGISTRY.getContextBundle.mcpToolName,
    description: COMMAND_REGISTRY.getContextBundle.description,
    toolVersion: "1",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      symbolIds: zod.array(stringSchema("Indexed symbol id")).describe("Optional indexed symbol ids").optional(),
      query: stringSchema("Optional query seed").optional(),
      tokenBudget: numberSchema("Optional bundle token budget").optional(),
      includeDependencies: booleanSchema("When true, expand through imported dependency symbols").optional(),
      includeImporters: booleanSchema("When true, expand through reverse importer symbols").optional(),
      includeReferences: booleanSchema("When true, expand through importer files that explicitly reference matched symbols").optional(),
      relationDepth: numberSchema("Optional bounded graph expansion depth for dependency/importer traversal").optional(),
    },
    execute: async (engine, args) => {
      const input = {
        repoRoot: requireString(args, "repoRoot"),
        query: optionalString(args, "query"),
        symbolIds: optionalStringArray(args, "symbolIds"),
        tokenBudget: optionalNumber(args, "tokenBudget"),
        includeDependencies: optionalBoolean(args, "includeDependencies"),
        includeImporters: optionalBoolean(args, "includeImporters"),
        includeReferences: optionalBoolean(args, "includeReferences"),
        relationDepth: optionalNumber(args, "relationDepth"),
      };
      const normalized = validateContextBundleOptions(input);
      return COMMAND_REGISTRY.getContextBundle.execute(engine, {
        ...input,
        ...normalized,
      });
    },
  },
  {
    name: COMMAND_REGISTRY.getRankedContext.mcpToolName,
    description: COMMAND_REGISTRY.getRankedContext.description,
    toolVersion: "1",
    inputSchema: {
      repoRoot: stringSchema("Repository root path"),
      query: stringSchema("Ranking query"),
      tokenBudget: numberSchema("Optional bundle token budget").optional(),
      includeDependencies: booleanSchema("When true, expand through imported dependency symbols").optional(),
      includeImporters: booleanSchema("When true, expand through reverse importer symbols").optional(),
      includeReferences: booleanSchema("When true, expand through importer files that explicitly reference matched symbols").optional(),
      relationDepth: numberSchema("Optional bounded graph expansion depth for dependency/importer traversal").optional(),
    },
    execute: async (engine, args) => {
      const input = {
        repoRoot: requireString(args, "repoRoot"),
        query: requireString(args, "query"),
        tokenBudget: optionalNumber(args, "tokenBudget"),
        includeDependencies: optionalBoolean(args, "includeDependencies"),
        includeImporters: optionalBoolean(args, "includeImporters"),
        includeReferences: optionalBoolean(args, "includeReferences"),
        relationDepth: optionalNumber(args, "relationDepth"),
      };
      validateRankedContextOptions(input);
      return COMMAND_REGISTRY.getRankedContext.execute(engine, input);
    },
  },
  {
    name: COMMAND_REGISTRY.diagnostics.mcpToolName,
    description: COMMAND_REGISTRY.diagnostics.description,
    toolVersion: "1",
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
