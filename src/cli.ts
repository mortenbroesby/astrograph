#!/usr/bin/env node

import process from "node:process";
import { readFile, unlink, writeFile } from "node:fs/promises";

import {
  parseCliOptionalNumber,
  parseCliSummaryStrategy,
  parseCliSupportedLanguage,
  parseCliSymbolKind,
  parseQueryCodeCliInput,
} from "./validation.ts";
import {
  diagnostics,
  doctor,
  getFileContent,
  getFileOutline,
  getFileTree,
  getRepoOutline,
  getContextBundle,
  getRankedContext,
  getSymbolSource,
  indexFile,
  indexFolder,
  queryCode,
  searchSymbols,
  searchText,
  suggestInitialQueries,
  watchFolder,
} from "./index.ts";
import { getLogger } from "./logger.ts";

type StopReason = "timeout" | "signal" | "closed";

type CliHandler = (args: Record<string, string>) => Promise<unknown>;
const BOOLEAN_FLAGS = new Set([
  "verify",
  "scan-freshness",
  "include-text",
  "include-ranked",
  "include-dependencies",
  "include-importers",
  "include-references",
  "json",
]);

const commands: Record<string, CliHandler> = {
  init: async (args) => diagnostics({ repoRoot: required(args, "repo") }),
  "index-folder": async (args) =>
    indexFolder({
      repoRoot: required(args, "repo"),
      summaryStrategy: optionalSummaryStrategy(args, "summary-strategy"),
    }),
  "index-file": async (args) =>
    indexFile({
      repoRoot: required(args, "repo"),
      filePath: required(args, "file"),
      summaryStrategy: optionalSummaryStrategy(args, "summary-strategy"),
    }),
  watch: async (args) => runWatchCommand(args),
  "get-repo-outline": async (args) =>
    getRepoOutline({ repoRoot: required(args, "repo") }),
  "get-file-tree": async (args) =>
    getFileTree({ repoRoot: required(args, "repo") }),
  "get-file-outline": async (args) =>
    getFileOutline({
      repoRoot: required(args, "repo"),
      filePath: required(args, "file"),
    }),
  "suggest-initial-queries": async (args) =>
    suggestInitialQueries({ repoRoot: required(args, "repo") }),
  "search-symbols": async (args) =>
    searchSymbols({
      repoRoot: required(args, "repo"),
      query: required(args, "query"),
      kind: optionalKind(args, "kind"),
      language: optionalLanguage(args, "language"),
      filePattern: optional(args, "file-pattern"),
      limit: optionalNumber(args, "limit"),
    }),
  "search-text": async (args) =>
    searchText({
      repoRoot: required(args, "repo"),
      query: required(args, "query"),
      filePattern: optional(args, "file-pattern"),
    }),
  "query-code": async (args) =>
    queryCode(parseQueryCodeCliInput(args)),
  "get-context-bundle": async (args) =>
    getContextBundle({
      repoRoot: required(args, "repo"),
      query: optional(args, "query"),
      symbolIds: optionalList(args, "symbols"),
      tokenBudget: optionalNumber(args, "budget"),
      includeDependencies: args["include-dependencies"] === "true",
      includeImporters: args["include-importers"] === "true",
      includeReferences: args["include-references"] === "true",
      relationDepth: optionalNumber(args, "relation-depth"),
    }),
  "get-ranked-context": async (args) =>
    getRankedContext({
      repoRoot: required(args, "repo"),
      query: required(args, "query"),
      tokenBudget: optionalNumber(args, "budget"),
      includeDependencies: args["include-dependencies"] === "true",
      includeImporters: args["include-importers"] === "true",
      includeReferences: args["include-references"] === "true",
      relationDepth: optionalNumber(args, "relation-depth"),
    }),
  "get-file-content": async (args) =>
    getFileContent({
      repoRoot: required(args, "repo"),
      filePath: required(args, "file"),
    }),
  "get-symbol-source": async (args) =>
    getSymbolSource({
      repoRoot: required(args, "repo"),
      symbolId: optional(args, "symbol"),
      symbolIds: optionalList(args, "symbols"),
      contextLines: optionalNumber(args, "context-lines"),
      verify: args.verify === "true",
    }),
  diagnostics: async (args) =>
    diagnostics({
      repoRoot: required(args, "repo"),
      scanFreshness: args["scan-freshness"] === "true",
    }),
  doctor: async (args) => {
    const result = await doctor({
      repoRoot: required(args, "repo"),
      scanFreshness: args["scan-freshness"] === "true",
    });
    return args.json === "true" ? result : formatDoctorReport(result);
  },
};

function required(args: Record<string, string>, key: string): string {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function optional(args: Record<string, string>, key: string): string | undefined {
  const value = args[key];
  return value && value.length > 0 ? value : undefined;
}

function optionalList(
  args: Record<string, string>,
  key: string,
): string[] | undefined {
  const value = optional(args, key);
  return value ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : undefined;
}

function optionalNumber(
  args: Record<string, string>,
  key: string,
): number | undefined {
  return parseCliOptionalNumber(args, key);
}

function optionalSummaryStrategy(
  args: Record<string, string>,
  key: string,
): Parameters<typeof indexFolder>[0]["summaryStrategy"] | undefined {
  return parseCliSummaryStrategy(args, key);
}

function optionalKind(
  args: Record<string, string>,
  key: string,
): Parameters<typeof searchSymbols>[0]["kind"] | undefined {
  return parseCliSymbolKind(args, key);
}

function optionalLanguage(
  args: Record<string, string>,
  key: string,
): Parameters<typeof searchSymbols>[0]["language"] | undefined {
  return parseCliSupportedLanguage(args, key);
}

function parseArgs(argv: string[]): { command: string; args: Record<string, string> } {
  const [command, ...rest] = argv;
  if (!command) {
    throw new Error("A command is required");
  }

  const args: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      if (BOOLEAN_FLAGS.has(key)) {
        args[key] = "true";
        continue;
      }
      throw new Error(`Missing value for argument --${key}`);
    }
    args[key] = next;
    index += 1;
  }

  return {
    command,
    args,
  };
}

async function runWatchCommand(args: Record<string, string>) {
  const repoRoot = required(args, "repo");
  const debounceMs = optionalNumber(args, "debounce-ms") ?? 100;
  const timeoutMs = optionalNumber(args, "timeout-ms");
  const pidFile = optional(args, "pid-file");
  const logger = getLogger({
    component: "cli",
    command: "watch",
    repoRoot,
  });
  let stopReason: StopReason = "closed";
  let initialSummary: Awaited<ReturnType<typeof indexFolder>> | null = null;
  let lastSummary: Awaited<ReturnType<typeof indexFolder>> | null = null;
  let reindexCount = 0;
  let lastError: string | null = null;

  let resolveStop!: () => void;
  const stopPromise = new Promise<void>((resolve) => {
    resolveStop = resolve;
  });

  const stopFromSignal = () => {
    stopReason = "signal";
    resolveStop();
  };

  logger.info({
    event: "watch_command_start",
    debounceMs,
    timeoutMs: timeoutMs ?? null,
    hasPidFile: pidFile !== undefined,
  });

  const watcher = await watchFolder({
    repoRoot,
    debounceMs,
    summaryStrategy: optionalSummaryStrategy(args, "summary-strategy"),
    onEvent(event) {
      if (event.type === "ready" && event.summary) {
        initialSummary = event.summary;
        lastSummary = event.summary;
      }
      if (event.type === "reindex" && event.summary) {
        reindexCount += 1;
        lastSummary = event.summary;
      }
      if (event.type === "error") {
        lastError = event.message ?? "Unknown watch error";
      }
    },
  });

  process.once("SIGINT", stopFromSignal);
  process.once("SIGTERM", stopFromSignal);

  if (pidFile) {
    await writeFile(pidFile, `${process.pid}\n`);
    logger.debug({ event: "watch_pid_written", pidFile });
  }

  const timeout = timeoutMs
    ? setTimeout(() => {
        stopReason = "timeout";
        resolveStop();
      }, timeoutMs)
    : null;

  await stopPromise;

  if (timeout) {
    clearTimeout(timeout);
  }
  process.off("SIGINT", stopFromSignal);
  process.off("SIGTERM", stopFromSignal);
  await watcher.close();

  if (pidFile) {
    try {
      const currentPid = (await readFile(pidFile, "utf8")).trim();
      if (currentPid === String(process.pid)) {
        await unlink(pidFile);
      }
    } catch {
      // Best-effort cleanup only.
    }
  }

  logger.info({
    event: "watch_command_stop",
    stopReason,
    reindexCount,
    lastError,
  });

  return {
    repoRoot,
    debounceMs,
    stopReason,
    reindexCount,
    initialSummary,
    lastSummary,
    lastError,
  };
}

export async function handleCli(argv: string[]): Promise<string> {
  const { command, args } = parseArgs(argv);
  const handler = commands[command];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }

  const result = await handler(args);
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}

function formatAge(indexAgeMs: number | null): string {
  if (indexAgeMs === null) {
    return "unknown";
  }
  if (indexAgeMs < 1_000) {
    return `${indexAgeMs}ms`;
  }
  const seconds = indexAgeMs / 1_000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${minutes.toFixed(1)}m`;
  }
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

function formatPercent(rate: number | null): string {
  return rate === null ? "unknown" : `${(rate * 100).toFixed(1)}%`;
}

function formatDoctorReport(result: Awaited<ReturnType<typeof doctor>>): string {
  const lines = [
    "Astrograph Doctor",
    `Repo: ${result.repoRoot}`,
    `Storage: ${result.storageDir}`,
    `Database: ${result.databasePath}`,
    `Index: ${result.indexStatus} (${result.freshness.status}, ${result.freshness.mode})`,
    `Schema: v${result.storageVersion} (${result.storageBackend}/${result.storageMode})`,
    `Freshness: indexed ${result.freshness.indexedFiles} file(s), current ${result.freshness.currentFiles}, symbols ${result.freshness.indexedSymbols}, imports ${result.freshness.indexedImports}`,
    `Drift: missing ${result.freshness.missingFiles}, changed ${result.freshness.changedFiles}, extra ${result.freshness.extraFiles}`,
    `Age: ${formatAge(result.freshness.indexAgeMs)}`,
    `Parser: fallback ${formatPercent(result.parser.fallbackRate)} (${result.parser.fallbackFileCount}/${result.parser.indexedFileCount}), unknown ${result.parser.unknownFileCount}`,
    `Observability: ${result.observability.status}${result.observability.url ? ` (${result.observability.url})` : ""}`,
    `Privacy: secret-like files ${result.privacy.secretLikeFileCount}`,
    `Watch: ${result.watch.status}`,
  ];

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  if (result.suggestedActions.length > 0) {
    lines.push("", "Suggested actions:");
    for (const action of result.suggestedActions) {
      lines.push(`- ${action}`);
    }
  }

  return lines.join("\n");
}

async function main() {
  const output = await handleCli(process.argv.slice(2));
  process.stdout.write(`${output}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
