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
import { formatMcpEnvelope, type McpOutputFormat } from "./compact-mcp.ts";
import { emitEngineEvent } from "./event-sink.ts";
import { getLogger } from "./logger.ts";
import { isMainModule } from "./entrypoint.ts";
import {
  buildToolFailureTokenEstimate,
  summarizeToolCompletion,
} from "./tool-observability.ts";

type EngineModule = typeof import("./index.ts");

let engineModulePromise: Promise<EngineModule> | null = null;
const logger = getLogger({ component: "mcp" });

function asTextResult(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
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
      usedPayloadTokens?: unknown;
      bundle?: { usedTokens?: unknown };
    };
    if (typeof output.usedTokens === "number" && Number.isFinite(output.usedTokens)) {
      return output.usedTokens;
    }
    if (typeof output.usedPayloadTokens === "number" && Number.isFinite(output.usedPayloadTokens)) {
      return output.usedPayloadTokens;
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
  if (!ensureNumber(value.startByte) || !ensureNumber(value.endByte)) {
    throw new Error("symbol output missing UTF-8 byte range");
  }
  if (!ensureBoolean(value.exported)) {
    throw new Error("symbol output missing exported");
  }
  return true;
}

function validateSearchSymbolsOutput(result: unknown) {
  assertIsObject(result);
  if (!Array.isArray(result.items)) {
    throw new Error("search_symbols output must include items");
  }
  if (!ensureBoolean(result.truncated)) {
    throw new Error("search_symbols output must include truncated");
  }
  if (!Array.isArray(result.refinementHints)) {
    throw new Error("search_symbols output must include refinementHints");
  }
  assertIsObject(result.tokenSavings);
  if (
    result.tokenSavings.unit !== "tokens"
    || result.tokenSavings.tokenizer !== "cl100k_base"
    || result.tokenSavings.baseline !== "all_ranked_symbol_items"
  ) {
    throw new Error("search_symbols tokenSavings has an invalid unit, tokenizer, or baseline");
  }
  for (const field of ["baselineTokens", "returnedTokens", "savedTokens", "savedPercent"] as const) {
    if (!ensureNumber(result.tokenSavings[field])) {
      throw new Error(`search_symbols tokenSavings must include ${field}`);
    }
  }
  for (const hint of result.refinementHints) {
    assertIsObject(hint);
    if (
      hint.field !== "limit"
      && hint.field !== "filePattern"
      && hint.field !== "kind"
    ) {
      throw new Error("search_symbols refinement hint has invalid field");
    }
    if (typeof hint.value !== "string" && !ensureNumber(hint.value)) {
      throw new Error("search_symbols refinement hint has invalid value");
    }
  }
  for (const symbol of result.items) {
    assertSymbolSummary(symbol);
  }
}

function validateRetrievalHealthOutput(result: unknown) {
  assertIsObject(result);
  assertIsObject(result.retrievalHealth);
  const health = result.retrievalHealth;
  if (health.status !== "safe" && health.status !== "degraded" && health.status !== "unsafe") {
    throw new Error("retrievalHealth output has an invalid status");
  }
  if (!Array.isArray(health.affectedCapabilities) || !Array.isArray(health.safeOperations)) {
    throw new Error("retrievalHealth output must include capability arrays");
  }
  for (const operation of [...health.affectedCapabilities, ...health.safeOperations]) {
    if (
      operation !== "discovery"
      && operation !== "exact_source"
      && operation !== "ranked_context"
      && operation !== "dependency_graph"
    ) {
      throw new Error("retrievalHealth output has an invalid operation");
    }
  }
  if (!ensureString(health.recommendedAction)) {
    throw new Error("retrievalHealth output must include a recommendedAction");
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
    assertIsObject(item.provenance);
    if (!ensureString(item.provenance.filePath) || !ensureString(item.provenance.sourceHash)) {
      throw new Error("get_symbol_source item must include source provenance identity");
    }
    assertIsObject(item.provenance.range);
    if (
      item.provenance.range.encoding !== "utf8"
      || !ensureNumber(item.provenance.range.startByte)
      || !ensureNumber(item.provenance.range.endByte)
      || !ensureNumber(item.provenance.range.startLine)
      || !ensureNumber(item.provenance.range.endLine)
    ) {
      throw new Error("get_symbol_source item has invalid source provenance range");
    }
    assertIsObject(item.provenance.parser);
    if (
      (item.provenance.parser.backend !== null && typeof item.provenance.parser.backend !== "string")
      || !ensureBoolean(item.provenance.parser.fallbackUsed)
      || (item.provenance.parser.fallbackReason !== null
        && typeof item.provenance.parser.fallbackReason !== "string")
      || item.provenance.freshness !== "indexed-snapshot"
    ) {
      throw new Error("get_symbol_source item has invalid source provenance metadata");
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

function validateTaskContextOutput(result: unknown) {
  assertIsObject(result);
  if (!ensureNumber(result.payloadTokenBudget)) {
    throw new Error("get_task_context output must include payloadTokenBudget");
  }
  if (!ensureNumber(result.usedPayloadTokens)) {
    throw new Error("get_task_context output must include usedPayloadTokens");
  }
  if (!ensureNumber(result.estimatedPayloadTokens) || !ensureNumber(result.sourceTokens)) {
    throw new Error("get_task_context output must include token accounting");
  }
  if (!ensureBoolean(result.truncated)) {
    throw new Error("get_task_context output must include truncated");
  }
  if (typeof result.query !== "string" && result.query !== null) {
    throw new Error("get_task_context output must include query as string or null");
  }
  if (typeof result.repoRoot !== "string") {
    throw new Error("get_task_context output must include repoRoot");
  }
  if (!Array.isArray(result.items)) {
    throw new Error("get_task_context output must include items");
  }
  if (!Array.isArray(result.exclusions)) throw new Error("get_task_context output must include exclusions");

  for (const item of result.items) {
    assertIsObject(item);
    if (!ensureString(item.role)) {
      throw new Error("task context item missing role");
    }
    if (!ensureString(item.reason)) {
      throw new Error("task context item missing reason");
    }
    if (!ensureString(item.source)) {
      throw new Error("task context item missing source");
    }
    if (!ensureNumber(item.sourceTokens)) {
      throw new Error("task context item missing sourceTokens");
    }
    assertSymbolSummary(item.symbol);
    if (typeof item.provenance !== "object" || item.provenance === null) {
      throw new Error("task context item missing provenance");
    }
  }
}

function validateToolOutput(name: string, result: unknown) {
  if (name === "search_symbols") {
    validateSearchSymbolsOutput(result);
    return;
  }
  if (name === "get_project_status" || name === "diagnostics") {
    validateRetrievalHealthOutput(result);
    return;
  }
  if (name === "get_symbol_source") {
    validateSymbolSourceOutput(result);
    return;
  }
  if (name === "get_task_context") {
    validateTaskContextOutput(result);
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
    }, async (args: Record<string, unknown>) => {
      const envelope = await dispatchTool(tool.name, args);
      const requestedFormat = args.format as McpOutputFormat | undefined;
      const formatted = formatMcpEnvelope(tool.name, requestedFormat, envelope);
      const repoRoot = typeof args.repoRoot === "string" ? args.repoRoot : undefined;
      if (repoRoot) {
        emitEngineEvent({
          repoRoot,
          source: "mcp",
          event: "mcp.tool.response_formatted",
          level: "debug",
          correlationId: randomUUID(),
          data: { toolName: tool.name, ...formatted.metrics },
        });
      }
      return asTextResult(formatted.serialized);
    });
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

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
