import {
  APPROXIMATE_BENCHMARK_TOKENIZER,
  BENCHMARK_TOKENIZER,
  countTokens,
  estimateTokens,
} from "./tokenizer.ts";

const EXACT_SAMPLE_EVERY = 10;
const toolObservationCounts = new Map<string, number>();

const HEURISTIC_SAVED_PCT_BY_TOOL: Record<string, number> = {
  diagnostics: 40,
  find_files: 85,
  get_file_outline: 65,
  get_file_summary: 75,
  get_project_status: 55,
  get_file_tree: 85,
  get_repo_outline: 90,
  search_text: 70,
  query_code_discover: 55,
  suggest_initial_queries: 92,
};

export interface ToolTokenEstimate {
  baselineTokens: number;
  returnedTokens: number;
  savedTokens: number;
  savedPercent: number;
  mode: "heuristic" | "exact";
  tokenizer: string;
  sampleEvery: number;
  sampleOrdinal: number;
  sampledExact?: {
    baselineTokens: number;
    returnedTokens: number;
    savedTokens: number;
    savedPercent: number;
    tokenizer: string;
  };
}

export interface ToolCompletionSummary {
  summary: string;
  detail: string[];
  tokenEstimate: ToolTokenEstimate;
}

interface ToolTokenEstimateInput {
  toolKey: string;
  baselineValue?: unknown;
  heuristicSavedPercent?: number;
  returnedValue: unknown;
}

function serializeTokenValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  const serialized = JSON.stringify(value);
  return serialized ?? "";
}

function estimateTokenCount(value: unknown): number {
  const serialized = serializeTokenValue(value);
  if (serialized.length === 0) {
    return 0;
  }

  return Math.max(1, estimateTokens(serialized));
}

function countExactTokens(value: unknown): number {
  const serialized = serializeTokenValue(value);
  if (serialized.length === 0) {
    return 0;
  }

  return Math.max(1, countTokens(serialized));
}

function toSavedPercent(savedTokens: number, baselineTokens: number): number {
  if (baselineTokens <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((savedTokens / baselineTokens) * 100));
}

function baselineFromSavedPercent(
  returnedTokens: number,
  savedPercent: number,
): number {
  const normalizedSavedPercent = Math.max(0, Math.min(99, savedPercent));
  if (normalizedSavedPercent === 0) {
    return returnedTokens;
  }

  const keptPercent = Math.max(1, 100 - normalizedSavedPercent);
  return Math.max(
    returnedTokens,
    Math.round((returnedTokens * 100) / keptPercent),
  );
}

function normalizeEstimate(
  baselineTokens: number,
  returnedTokens: number,
) {
  const normalizedBaseline = Math.max(baselineTokens, returnedTokens);
  const savedTokens = Math.max(0, normalizedBaseline - returnedTokens);
  return {
    baselineTokens: normalizedBaseline,
    returnedTokens,
    savedTokens,
    savedPercent: toSavedPercent(savedTokens, normalizedBaseline),
  };
}

function nextToolObservationCount(toolKey: string): number {
  const next = (toolObservationCounts.get(toolKey) ?? 0) + 1;
  toolObservationCounts.set(toolKey, next);
  return next;
}

function buildTokenEstimate(input: ToolTokenEstimateInput): ToolTokenEstimate {
  const sampleOrdinal = nextToolObservationCount(input.toolKey);
  const shouldSampleExact = sampleOrdinal % EXACT_SAMPLE_EVERY === 0;
  const returnedApproxTokens = estimateTokenCount(input.returnedValue);
  const baselineApproxTokens = input.baselineValue !== undefined
    ? estimateTokenCount(input.baselineValue)
    : baselineFromSavedPercent(
      returnedApproxTokens,
      input.heuristicSavedPercent ?? 0,
    );

  const approximate = normalizeEstimate(
    baselineApproxTokens,
    returnedApproxTokens,
  );

  if (!shouldSampleExact) {
    return {
      ...approximate,
      mode: input.baselineValue !== undefined ? "exact" : "heuristic",
      tokenizer: APPROXIMATE_BENCHMARK_TOKENIZER,
      sampleEvery: EXACT_SAMPLE_EVERY,
      sampleOrdinal,
    };
  }

  const returnedExactTokens = countExactTokens(input.returnedValue);
  const baselineExactTokens = input.baselineValue !== undefined
    ? countExactTokens(input.baselineValue)
    : baselineFromSavedPercent(
      returnedExactTokens,
      input.heuristicSavedPercent ?? 0,
    );
  const exact = normalizeEstimate(
    baselineExactTokens,
    returnedExactTokens,
  );

  return {
    ...exact,
    mode: input.baselineValue !== undefined ? "exact" : "heuristic",
    tokenizer: BENCHMARK_TOKENIZER,
    sampleEvery: EXACT_SAMPLE_EVERY,
    sampleOrdinal,
    sampledExact: {
      ...exact,
      tokenizer: BENCHMARK_TOKENIZER,
    },
  };
}

export function buildToolFailureTokenEstimate(input: {
  toolName: string;
  message: string;
}): ToolTokenEstimate {
  return buildTokenEstimate({
    toolKey: `${input.toolName}_failed`,
    returnedValue: input.message,
    heuristicSavedPercent: 0,
  });
}

export function summarizeToolCompletion(
  name: string,
  result: unknown,
): ToolCompletionSummary {
  const returnedTokens = estimateTokenCount(result);

  if (name === "index_folder" && result && typeof result === "object") {
    const summary = result as {
      indexedFiles?: number;
      indexedSymbols?: number;
      staleStatus?: string;
    };
    return {
      summary: `Indexed ${summary.indexedFiles ?? 0} files and ${summary.indexedSymbols ?? 0} symbols`,
      detail: [
        `stale status: ${summary.staleStatus ?? "unknown"}`,
        `returned ~${returnedTokens} tokens`,
      ],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
      }),
    };
  }

  if (name === "index_file" && result && typeof result === "object") {
    const summary = result as {
      indexedFiles?: number;
      indexedSymbols?: number;
      staleStatus?: string;
    };
    return {
      summary: `Refreshed 1 file and now tracks ${summary.indexedSymbols ?? 0} symbols`,
      detail: [
        `stale status: ${summary.staleStatus ?? "unknown"}`,
        `returned ~${returnedTokens} tokens`,
      ],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
      }),
    };
  }

  if (name === "get_repo_outline" && result && typeof result === "object") {
    const outline = result as {
      totalFiles?: number;
      totalSymbols?: number;
      languages?: Record<string, number>;
    };
    return {
      summary: `Outlined ${outline.totalFiles ?? 0} files and ${outline.totalSymbols ?? 0} symbols`,
      detail: [
        `languages: ${Object.keys(outline.languages ?? {}).length}`,
        `returned ~${returnedTokens} tokens`,
      ],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.get_repo_outline,
      }),
    };
  }

  if (name === "get_file_tree" && Array.isArray(result)) {
    return {
      summary: `Returned ${result.length} indexed files`,
      detail: [`returned ~${returnedTokens} tokens`],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.get_file_tree,
      }),
    };
  }

  if (name === "get_file_outline" && result && typeof result === "object") {
    const outline = result as {
      filePath?: string;
      symbols?: Array<unknown>;
    };
    return {
      summary: `Outlined ${outline.symbols?.length ?? 0} symbols in ${outline.filePath ?? "file"}`,
      detail: [`returned ~${returnedTokens} tokens`],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.get_file_outline,
      }),
    };
  }

  if (name === "find_files" && Array.isArray(result)) {
    return {
      summary: `Found ${result.length} matching files`,
      detail: [`returned ~${returnedTokens} tokens`],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.find_files,
      }),
    };
  }

  if (name === "search_text" && Array.isArray(result)) {
    return {
      summary: `Found ${result.length} text matches`,
      detail: [`returned ~${returnedTokens} tokens`],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.search_text,
      }),
    };
  }

  if (name === "get_file_summary" && result && typeof result === "object") {
    const summary = result as {
      filePath?: string;
      supportTier?: string;
      support?: { activeTier?: string; availableTiers?: string[] };
      summarySource?: string;
    };
    return {
      summary: `Summarized ${summary.filePath ?? "file"}`,
      detail: [
        `support tier: ${summary.support?.activeTier ?? summary.supportTier ?? "unknown"}`,
        `available tiers: ${(summary.support?.availableTiers ?? []).join(", ") || "unknown"}`,
        `summary source: ${summary.summarySource ?? "unknown"}`,
      ],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.get_file_summary,
      }),
    };
  }

  if (name === "get_project_status" && result && typeof result === "object") {
    const status = result as {
      readiness?: {
        stage?: string;
        discoveryReady?: boolean;
        deepRetrievalReady?: boolean;
        deepening?: boolean;
        pendingDeepIndexedFiles?: number;
      };
      freshness?: { staleStatus?: string };
      supportTiers?: { byLanguage?: Array<{ language?: string; tiers?: string[] }> };
    };
    return {
      summary: `Project status: ${status.freshness?.staleStatus ?? "unknown"} freshness`,
      detail: [
        `readiness stage: ${status.readiness?.stage ?? "unknown"}`,
        `discovery ready: ${status.readiness?.discoveryReady === true ? "yes" : "no"}`,
        `deep retrieval ready: ${status.readiness?.deepRetrievalReady === true ? "yes" : "no"}`,
        `deepening: ${status.readiness?.deepening === true ? `yes (${status.readiness?.pendingDeepIndexedFiles ?? 0} pending)` : "no"}`,
        `language tiers: ${status.supportTiers?.byLanguage?.map((entry) => `${entry.language}:${(entry.tiers ?? []).join("/")}`).join(", ") || "unknown"}`,
      ],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.get_project_status,
      }),
    };
  }

  if (name === "suggest_initial_queries" && Array.isArray(result)) {
    return {
      summary: `Suggested ${result.length} starting queries`,
      detail: [`returned ~${returnedTokens} tokens`],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.suggest_initial_queries,
      }),
    };
  }

  if (name === "query_code" && result && typeof result === "object") {
    const queryResult = result as {
      intent?: string;
      query?: string;
      symbolMatches?: Array<unknown>;
      textMatches?: Array<unknown>;
      fileContent?: { filePath?: string; content?: string } | null;
      symbolSource?: { items?: Array<{ source?: string }>; source?: string } | null;
      bundle?: { items?: Array<unknown>; estimatedTokens?: number; usedTokens?: number } | null;
    };

    if (queryResult.intent === "discover") {
      return {
        summary: `Found ${queryResult.symbolMatches?.length ?? 0} symbols and ${queryResult.textMatches?.length ?? 0} text matches`,
        detail: [
          `query: ${queryResult.query ?? "none"}`,
          `returned ~${returnedTokens} tokens`,
        ],
        tokenEstimate: buildTokenEstimate({
          toolKey: `${name}_discover`,
          returnedValue: result,
          heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.query_code_discover,
        }),
      };
    }

    if (queryResult.intent === "source") {
      return {
        summary: queryResult.fileContent?.filePath
          ? `Returned source for ${queryResult.fileContent.filePath}`
          : `Returned ${queryResult.symbolSource?.items?.length ?? 1} source snippets`,
        detail: [`returned ~${returnedTokens} tokens`],
        tokenEstimate: buildTokenEstimate({
          toolKey: `${name}_source`,
          baselineValue: queryResult.fileContent?.content
            ?? queryResult.symbolSource?.items?.map((item) => item.source ?? "")
            ?? queryResult.symbolSource?.source
            ?? "",
          returnedValue: result,
        }),
      };
    }

    if (queryResult.intent === "assemble" && queryResult.bundle) {
      const baselineTokens = queryResult.bundle.estimatedTokens ?? null;
      return {
        summary: `Assembled ${queryResult.bundle.items?.length ?? 0} context snippets`,
        detail: [
          `query: ${queryResult.query ?? "none"}`,
          `bundle budget used: ${queryResult.bundle.usedTokens ?? 0}/${baselineTokens ?? 0}`,
        ],
        tokenEstimate: buildTokenEstimate({
          toolKey: `${name}_assemble`,
          baselineValue: queryResult.bundle.items ?? [],
          returnedValue: result,
        }),
      };
    }
  }

  if (name === "diagnostics" && result && typeof result === "object") {
    const diagnostics = result as {
      staleStatus?: string;
      indexedFiles?: number;
      changedFiles?: number;
      readiness?: { stage?: string; deepening?: boolean; pendingDeepIndexedFiles?: number };
      watch?: { status?: string };
    };
    return {
      summary: `Diagnostics: ${diagnostics.indexedFiles ?? 0} indexed files, watch ${diagnostics.watch?.status ?? "unknown"}`,
      detail: [
        `stale status: ${diagnostics.staleStatus ?? "unknown"}`,
        `readiness stage: ${diagnostics.readiness?.stage ?? "unknown"}`,
        `deepening: ${diagnostics.readiness?.deepening === true ? `yes (${diagnostics.readiness?.pendingDeepIndexedFiles ?? 0} pending)` : "no"}`,
        `changed files: ${diagnostics.changedFiles ?? 0}`,
      ],
      tokenEstimate: buildTokenEstimate({
        toolKey: name,
        returnedValue: result,
        heuristicSavedPercent: HEURISTIC_SAVED_PCT_BY_TOOL.diagnostics,
      }),
    };
  }

  return {
    summary: `${name} completed`,
    detail: [`returned ~${returnedTokens} tokens`],
    tokenEstimate: buildTokenEstimate({
      toolKey: name,
      returnedValue: result,
      heuristicSavedPercent: 25,
    }),
  };
}
