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

function ensureString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function ensureBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function ensureArrayOfStrings(value: unknown, fieldName: string): value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`get_${fieldName} output must include an array of strings`);
  }
  if (!value.every((entry) => typeof entry === "string")) {
    throw new Error(`get_${fieldName} output must include strings only`);
  }
  return true;
}

function assertSymbolSummary(value: unknown): value is Record<string, unknown> {
  assertIsObject(value);
  if (!ensureString(value.id)) {
    throw new Error("symbol output missing id");
  }
  if (!ensureString(value.name)) {
    throw new Error("symbol output missing name");
  }
  if (
    value.qualifiedName !== null
    && typeof value.qualifiedName !== "string"
  ) {
    throw new Error("symbol output has invalid qualifiedName");
  }
  if (!ensureString(value.kind)) {
    throw new Error("symbol output missing kind");
  }
  if (!ensureString(value.filePath)) {
    throw new Error("symbol output missing filePath");
  }
  if (!ensureString(value.signature)) {
    throw new Error("symbol output missing signature");
  }
  if (!ensureString(value.summary)) {
    throw new Error("symbol output missing summary");
  }
  if (!ensureString(value.summarySource)) {
    throw new Error("symbol output missing summarySource");
  }
  if (!ensureNumber(value.startLine)) {
    throw new Error("symbol output missing startLine");
  }
  if (!ensureNumber(value.endLine)) {
    throw new Error("symbol output missing endLine");
  }
  if (!ensureBoolean(value.exported)) {
    throw new Error("symbol output missing exported");
  }
  return true;
}

function validateSearchSymbolsOutput(result: unknown) {
  if (!Array.isArray(result)) {
    throw new Error("search_symbols output must be an array");
  }
  for (const symbol of result) {
    assertSymbolSummary(symbol);
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
  for (const item of result.items) {
    assertIsObject(item);
    if (typeof item.source !== "string") {
      throw new Error("get_symbol_source item must include source");
    }
    if (!ensureNumber(item.startLine) || !ensureNumber(item.endLine)) {
      throw new Error("get_symbol_source item must include numeric lines");
    }
    if (!ensureBoolean(item.verified)) {
      throw new Error("get_symbol_source item must include verified");
    }
    assertSymbolSummary(item.symbol);
  }

  if (result.symbol !== undefined) {
    assertSymbolSummary(result.symbol);
  }
  if (result.source !== undefined && typeof result.source !== "string") {
    throw new Error("get_symbol_source output invalid source");
  }
  if (result.verified !== undefined && !ensureBoolean(result.verified)) {
    throw new Error("get_symbol_source output invalid verified");
  }
  if (result.startLine !== undefined && !ensureNumber(result.startLine)) {
    throw new Error("get_symbol_source output invalid startLine");
  }
  if (result.endLine !== undefined && !ensureNumber(result.endLine)) {
    throw new Error("get_symbol_source output invalid endLine");
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
  if (!ensureNumber(result.estimatedTokens)) {
    throw new Error("get_context_bundle output must include estimatedTokens");
  }
  if (!ensureBoolean(result.truncated)) {
    throw new Error("get_context_bundle output must include truncated");
  }
  if (typeof result.query !== "string" && result.query !== null) {
    throw new Error("get_context_bundle output must include query as string or null");
  }
  if (typeof result.repoRoot !== "string") {
    throw new Error("get_context_bundle output must include repoRoot");
  }
  if (!Array.isArray(result.items)) {
    throw new Error("get_context_bundle output must include items");
  }

  for (const item of result.items) {
    assertIsObject(item);
    if (!ensureString(item.role)) {
      throw new Error("context bundle item missing role");
    }
    if (!ensureString(item.reason)) {
      throw new Error("context bundle item missing reason");
    }
    if (!ensureString(item.source)) {
      throw new Error("context bundle item missing source");
    }
    if (!ensureNumber(item.tokenCount)) {
      throw new Error("context bundle item missing tokenCount");
    }
    assertSymbolSummary(item.symbol);
  }
}

function validateRankedContextOutput(result: unknown) {
  assertIsObject(result);
  if (typeof result.query !== "string") {
    throw new Error("get_ranked_context output must include query");
  }
  if (!ensureNumber(result.tokenBudget)) {
    throw new Error("get_ranked_context output must include tokenBudget");
  }
  if (!ensureNumber(result.candidateCount)) {
    throw new Error("get_ranked_context output must include candidateCount");
  }
  if (typeof result.repoRoot !== "string") {
    throw new Error("get_ranked_context output must include repoRoot");
  }
  if (!Array.isArray(result.candidates)) {
    throw new Error("get_ranked_context output must include candidates");
  }
  for (const candidate of result.candidates) {
    assertIsObject(candidate);
    if (!ensureNumber(candidate.rank) || !ensureNumber(candidate.score)) {
      throw new Error("get_ranked_context candidate must include numeric rank and score");
    }
    if (!ensureString(candidate.reason)) {
      throw new Error("get_ranked_context candidate must include reason");
    }
    if (typeof candidate.selected !== "boolean") {
      throw new Error("get_ranked_context candidate must include selected");
    }
    assertSymbolSummary(candidate.symbol);
  }
  if (!Array.isArray(result.selectedSeedIds)) {
    throw new Error("get_ranked_context output must include selectedSeedIds");
  }
  ensureArrayOfStrings(result.selectedSeedIds, "ranked_context selectedSeedIds");
  if (typeof result.bundle !== "object" || result.bundle === null) {
    throw new Error("get_ranked_context output must include bundle");
  }
  const bundle = result.bundle as Record<string, unknown>;
  if (typeof bundle.query !== "string" && bundle.query !== null) {
    throw new Error("get_ranked_context bundle output must include query");
  }
  if (typeof bundle.repoRoot !== "string") {
    throw new Error("get_ranked_context bundle output must include repoRoot");
  }
  if (!ensureNumber(bundle.tokenBudget)) {
    throw new Error("get_ranked_context bundle output must include tokenBudget");
  }
  if (!ensureNumber(bundle.estimatedTokens)) {
    throw new Error("get_ranked_context bundle output must include estimatedTokens");
  }
  if (!ensureNumber(bundle.usedTokens)) {
    throw new Error("get_ranked_context bundle output must include usedTokens");
  }
  if (typeof bundle.truncated !== "boolean") {
    throw new Error("get_ranked_context bundle output must include truncated");
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
