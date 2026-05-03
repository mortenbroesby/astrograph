#!/usr/bin/env node

import process from "node:process";
import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  type McpDataFreshness,
  type McpEnvelope,
  type McpErrorEnvelope,
  type McpResponseEnvelope,
  getMcpToolDefinition,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_TOOL_DEFINITIONS,
} from "./mcp-contract.ts";
import { emitEngineEvent } from "./event-sink.ts";
import { getLogger } from "./logger.ts";
import {
  buildToolFailureTokenEstimate,
  summarizeToolCompletion,
} from "./tool-observability.ts";

type EngineModule = typeof import("./index.ts");

let engineModulePromise: Promise<EngineModule> | null = null;
const logger = getLogger({ component: "mcp" });

function asTextResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function normalizeUnknownToolEnvelope(toolName: string): McpErrorEnvelope {
  return {
    ok: false,
    data: null,
    error: {
      code: "tool_not_found",
      message: `Unknown tool: ${toolName}`,
    },
    meta: {
      toolVersion: "1",
      tokenBudgetUsed: null,
      dataFreshness: "unknown",
    },
  };
}

function toMcpDataFreshness(value: unknown): McpDataFreshness {
  if (typeof value !== "object" || value === null) {
    return "unknown";
  }

  const result = value as {
    staleStatus?: unknown;
    freshness?: { staleStatus?: unknown; status?: unknown };
  };
  const statusCandidates = [
    result.staleStatus,
    result.freshness?.staleStatus,
    result.freshness?.status,
  ];
  for (const status of statusCandidates) {
    if (status === "fresh" || status === "stale" || status === "unknown") {
      return status;
    }
  }

  return "unknown";
}

function extractUsedTokenBudget(
  result: unknown,
  returnedTokens: number,
): number | null {
  if (typeof result === "object" && result !== null) {
    const output = result as {
      usedTokens?: unknown;
      bundle?: { usedTokens?: unknown };
    };
    if (typeof output.usedTokens === "number" && Number.isFinite(output.usedTokens)) {
      return output.usedTokens;
    }
    if (
      typeof output.bundle === "object"
      && output.bundle !== null
      && "usedTokens" in output.bundle
    ) {
      const bundled = output.bundle as { usedTokens?: unknown };
      if (typeof bundled.usedTokens === "number" && Number.isFinite(bundled.usedTokens)) {
        return bundled.usedTokens;
      }
    }
  }

  return Math.max(0, Math.floor(returnedTokens));
}

function assertIsObject(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid MCP output: expected object");
  }
}

function ensureNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateSearchSymbolsOutput(result: unknown) {
  if (!Array.isArray(result)) {
    throw new Error("search_symbols output must be an array");
  }
}

function validateSymbolSourceOutput(result: unknown) {
  assertIsObject(result);
  if (!ensureNumber(result.requestedContextLines)) {
    throw new Error("get_symbol_source output must include requestedContextLines");
  }
  if (!Array.isArray(result.items)) {
    throw new Error("get_symbol_source output must include items");
  }
}

function validateContextBundleOutput(result: unknown) {
  assertIsObject(result);
  if (!ensureNumber(result.tokenBudget)) {
    throw new Error("get_context_bundle output must include tokenBudget");
  }
  if (!ensureNumber(result.usedTokens)) {
    throw new Error("get_context_bundle output must include usedTokens");
  }
  if (!Array.isArray(result.items)) {
    throw new Error("get_context_bundle output must include items");
  }
}

function validateRankedContextOutput(result: unknown) {
  assertIsObject(result);
  if (typeof result.query !== "string") {
    throw new Error("get_ranked_context output must include query");
  }
  if (!Array.isArray(result.candidates)) {
    throw new Error("get_ranked_context output must include candidates");
  }
  if (!Array.isArray(result.selectedSeedIds)) {
    throw new Error("get_ranked_context output must include selectedSeedIds");
  }
  if (typeof result.bundle !== "object" || result.bundle === null) {
    throw new Error("get_ranked_context output must include bundle");
  }
}

function validateToolOutput(name: string, result: unknown) {
  if (name === "search_symbols") {
    validateSearchSymbolsOutput(result);
    return;
  }
  if (name === "get_symbol_source") {
    validateSymbolSourceOutput(result);
    return;
  }
  if (name === "get_context_bundle") {
    validateContextBundleOutput(result);
    return;
  }
  if (name === "get_ranked_context") {
    validateRankedContextOutput(result);
  }
}

function normalizeErrorCode(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("unknown tool")) {
    return "tool_not_found";
  }
  if (
    normalized.includes("invalid")
    || normalized.includes("unsupported")
    || normalized.includes("missing required argument")
    || normalized.includes("must be")
    || normalized.includes("requires")
    || normalized.includes("expected")
  ) {
    return "invalid_argument";
  }
  return "internal_error";
}

function buildFailureEnvelope(message: string): McpErrorEnvelope {
  return {
    ok: false,
    data: null,
    error: {
      code: normalizeErrorCode(message),
      message,
    },
    meta: {
      toolVersion: "1",
      tokenBudgetUsed: null,
      dataFreshness: "unknown",
    },
  };
}

function loadEngineModule(): Promise<EngineModule> {
  engineModulePromise ??= import("./index.ts");
  return engineModulePromise;
}

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
): Promise<McpEnvelope<unknown>> {
  const tool = getMcpToolDefinition(name);
  if (!tool) {
    return normalizeUnknownToolEnvelope(name);
  }

  const startedAt = Date.now();
  const correlationId = randomUUID();
  const repoRoot = typeof args.repoRoot === "string" ? args.repoRoot : undefined;
  logger.debug({
    event: "tool_call_start",
    toolName: name,
    argKeys: Object.keys(args).sort(),
  });
  if (repoRoot) {
    emitEngineEvent({
      repoRoot,
      source: "mcp",
      event: "mcp.tool.started",
      level: "debug",
      correlationId,
      data: {
        toolName: name,
        argKeys: Object.keys(args).sort(),
      },
    });
  }

  const engine = await loadEngineModule();
  try {
    const result = await tool.execute(engine, args);
    validateToolOutput(name, result);
    const completion = summarizeToolCompletion(name, result);
    const envelope: McpResponseEnvelope<unknown> = {
      ok: true,
      data: result,
      meta: {
        toolVersion: tool.toolVersion,
        tokenBudgetUsed: extractUsedTokenBudget(result, completion.tokenEstimate.returnedTokens),
        dataFreshness: toMcpDataFreshness(result),
      },
    };
    logger.debug({
      event: "tool_call_finish",
      toolName: name,
      durationMs: Date.now() - startedAt,
    });
    if (repoRoot) {
      emitEngineEvent({
        repoRoot,
        source: "mcp",
        event: "mcp.tool.finished",
        level: "info",
        correlationId,
        data: {
          toolName: name,
          durationMs: Date.now() - startedAt,
          summary: completion.summary,
          detail: completion.detail,
          tokenEstimate: completion.tokenEstimate,
        },
      });
    }
    return envelope;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({
      event: "tool_call_error",
      toolName: name,
      durationMs: Date.now() - startedAt,
      message,
    });
    if (repoRoot) {
      emitEngineEvent({
        repoRoot,
        source: "mcp",
        event: "mcp.tool.failed",
        level: "error",
        correlationId,
        data: {
          toolName: name,
          durationMs: Date.now() - startedAt,
          message,
          tokenEstimate: buildToolFailureTokenEstimate({
            toolName: name,
            message,
          }),
        },
      });
    }
    return buildFailureEnvelope(message);
  }
}

export function createMcpServer() {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  for (const tool of MCP_TOOL_DEFINITIONS) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, async (args: Record<string, unknown>) =>
      asTextResult(await dispatchTool(tool.name, args)));
  }

  return server;
}

async function main() {
  logger.info({
    event: "server_start",
    serverName: MCP_SERVER_NAME,
    serverVersion: MCP_SERVER_VERSION,
  });
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  const closeServer = async () => {
    await server.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void closeServer();
  });
  process.once("SIGTERM", () => {
    void closeServer();
  });

  await server.connect(transport);
  logger.info({ event: "server_connected" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
