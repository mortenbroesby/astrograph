#!/usr/bin/env node

import process from "node:process";
import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
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

function loadEngineModule(): Promise<EngineModule> {
  engineModulePromise ??= import("./index.ts");
  return engineModulePromise;
}

export async function dispatchTool(name: string, args: Record<string, unknown>) {
  const tool = getMcpToolDefinition(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
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
    const completion = summarizeToolCompletion(name, result);
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
    return result;
  } catch (error) {
    logger.error({
      event: "tool_call_error",
      toolName: name,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
    });
    if (repoRoot) {
      const failureMessage = error instanceof Error ? error.message : String(error);
      emitEngineEvent({
        repoRoot,
        source: "mcp",
        event: "mcp.tool.failed",
        level: "error",
        correlationId,
        data: {
          toolName: name,
          durationMs: Date.now() - startedAt,
          message: failureMessage,
          tokenEstimate: buildToolFailureTokenEstimate({
            toolName: name,
            message: failureMessage,
          }),
        },
      });
    }
    throw error;
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
