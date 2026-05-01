#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Bench } from "tinybench";

import {
  diagnostics,
  getSymbolSource,
  indexFile,
  indexFolder,
  getRankedContext,
  searchSymbols,
} from "../src/index.ts";
import { listSupportedFiles } from "../src/filesystem-scan.ts";
import { parseSourceFile, supportedLanguageForFile } from "../src/parser.ts";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const EXCLUDED_SEGMENTS = new Set([
  ".astrograph",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
]);

const PARSE_TARGETS = [
  "src/types.ts",
  "src/cli.ts",
  "src/parser.ts",
  "src/storage.ts",
];

function round(value) {
  return Math.round(value * 10) / 10;
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function buildTokenSavings(resultTokens, baselineTokens) {
  const savedTokens = Math.max(0, baselineTokens - resultTokens);
  return {
    resultTokens,
    baselineTokens,
    savedTokens,
    savedPercent:
      baselineTokens > 0 ? round((savedTokens / baselineTokens) * 100) : 0,
  };
}

function parseArgs(argv) {
  const args = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, next);
    index += 1;
  }

  return {
    repoRoot: args.get("repo"),
    runs: Number(args.get("runs") ?? "25"),
  };
}

async function runTinybenchTask(name, iterations, task) {
  let lastValue = null;
  const bench = new Bench({
    name,
    iterations,
    time: 1,
    warmup: false,
    throws: true,
  });

  bench.add(name, () => {
    lastValue = task();
  });

  await bench.run();
  const benchTask = bench.tasks[0];
  const result = benchTask?.result;
  if (!result || result.state !== "completed") {
    throw new Error(`Tinybench task did not complete: ${name}`);
  }

  return {
    lastValue,
    stats: {
      samples: result.latency.samplesCount,
      meanMs: round(result.latency.mean),
      medianMs: round(result.latency.p50),
      minMs: round(result.latency.min),
      maxMs: round(result.latency.max),
      rme: round(result.latency.rme),
    },
  };
}

async function copyCleanRepo(sourceRoot) {
  const benchRoot = await mkdtemp(
    path.join(os.tmpdir(), "ai-context-engine-smallbench-"),
  );
  const targetRoot = path.join(benchRoot, "repo");

  await cp(sourceRoot, targetRoot, {
    recursive: true,
    filter(sourcePath) {
      const segment = path.basename(sourcePath);
      return !EXCLUDED_SEGMENTS.has(segment) && segment !== "tsconfig.tsbuildinfo";
    },
  });

  spawnSync("git", ["init"], {
    cwd: targetRoot,
    stdio: ["ignore", "ignore", "ignore"],
  });

  return targetRoot;
}

async function benchmarkParseTargets(runs) {
  const results = {};

  for (const relativePath of PARSE_TARGETS) {
    const absolutePath = path.join(packageRoot, relativePath);
    const content = await readFile(absolutePath, "utf8");
    const language = supportedLanguageForFile(relativePath);
    if (!language) {
      throw new Error(`Unsupported benchmark language for ${relativePath}`);
    }

    const { lastValue: parseResult, stats } = await runTinybenchTask(
      `parse:${relativePath}`,
      runs,
      () =>
        parseSourceFile({
          relativePath,
          content,
          language,
          summaryStrategy: "doc-comments-first",
        }),
    );

    results[relativePath] = {
      bytes: content.length,
      symbols: parseResult?.symbols.length ?? 0,
      imports: parseResult?.imports.length ?? 0,
      backend: parseResult?.backend ?? null,
      fallbackUsed: parseResult?.fallbackUsed ?? false,
      fallbackReason: parseResult?.fallbackReason ?? null,
      fallbackLikely:
        (parseResult?.symbols.length ?? 0) === 0 &&
        (parseResult?.imports.length ?? 0) === 0,
      benchmarkTool: "tinybench",
      ...stats,
    };
  }

  return results;
}

async function listSupportedSourceFiles(rootDir, currentDir = rootDir) {
  return listSupportedFiles(rootDir, currentDir);
}

async function benchmarkLibrarySurface(repoRoot) {
  const storageDir = path.join(repoRoot, ".astrograph");
  await rm(storageDir, { recursive: true, force: true });
  const scopedFiles = (await listSupportedSourceFiles(repoRoot)).filter((filePath) =>
    filePath.startsWith("src/"),
  );
  const scopedContents = await Promise.all(
    scopedFiles.map(async (filePath) =>
      readFile(path.join(repoRoot, filePath), "utf8"),
    ),
  );
  const scopedBaselineTokens = estimateTokens(scopedContents.join("\n"));

  const coldTypesStarted = performance.now();
  const coldTypes = await indexFile({
    repoRoot,
    filePath: "src/types.ts",
  });
  const coldTypesDurationMs = performance.now() - coldTypesStarted;

  const coldStorageStarted = performance.now();
  const coldStorage = await indexFile({
    repoRoot,
    filePath: "src/storage.ts",
  });
  const coldStorageDurationMs = performance.now() - coldStorageStarted;

  const warmStorageStarted = performance.now();
  const warmStorage = await indexFile({
    repoRoot,
    filePath: "src/storage.ts",
  });
  const warmStorageDurationMs = performance.now() - warmStorageStarted;

  const folderStarted = performance.now();
  const folder = await indexFolder({ repoRoot });
  const folderDurationMs = performance.now() - folderStarted;

  const searchStarted = performance.now();
  const search = await searchSymbols({
    repoRoot,
    query: "getRankedContext",
    language: "ts",
    filePattern: "src/*.ts",
    limit: 5,
  });
  const searchDurationMs = performance.now() - searchStarted;
  const searchResultTokens = estimateTokens(JSON.stringify(search));

  const symbolSourceStarted = performance.now();
  const symbolSource = await getSymbolSource({
    repoRoot,
    symbolIds: search.slice(0, 2).map((entry) => entry.id),
    contextLines: 2,
  });
  const symbolSourceDurationMs = performance.now() - symbolSourceStarted;
  const symbolSourceResultTokens = estimateTokens(JSON.stringify(symbolSource));
  const symbolSourceBaselineFiles = [...new Set(search.slice(0, 2).map((entry) => entry.filePath))];
  const symbolSourceBaselineContents = await Promise.all(
    symbolSourceBaselineFiles.map(async (filePath) =>
      readFile(path.join(repoRoot, filePath), "utf8"),
    ),
  );
  const symbolSourceBaselineTokens = estimateTokens(
    symbolSourceBaselineContents.join("\n"),
  );

  const rankedContextStarted = performance.now();
  const rankedContext = await getRankedContext({
    repoRoot,
    query: "getRankedContext",
    tokenBudget: 200,
  });
  const rankedContextDurationMs = performance.now() - rankedContextStarted;
  const rankedContextResultTokens = estimateTokens(JSON.stringify(rankedContext));

  const diagnosticsStarted = performance.now();
  const repoDiagnostics = await diagnostics({
    repoRoot: path.join(repoRoot, "src"),
  });
  const diagnosticsDurationMs = performance.now() - diagnosticsStarted;

  const diagnosticsScanStarted = performance.now();
  const scannedDiagnostics = await diagnostics({
    repoRoot: path.join(repoRoot, "src"),
    scanFreshness: true,
  });
  const diagnosticsScanDurationMs = performance.now() - diagnosticsScanStarted;

  return {
    indexResults: {
      coldIndexFileTypes: {
        durationMs: round(coldTypesDurationMs),
        indexedFiles: coldTypes.indexedFiles,
        indexedSymbols: coldTypes.indexedSymbols,
      },
      coldIndexFileStorage: {
        durationMs: round(coldStorageDurationMs),
        indexedFiles: coldStorage.indexedFiles,
        indexedSymbols: coldStorage.indexedSymbols,
      },
      warmIndexFileStorage: {
        durationMs: round(warmStorageDurationMs),
        indexedFiles: warmStorage.indexedFiles,
        indexedSymbols: warmStorage.indexedSymbols,
      },
      folderIndex: {
        durationMs: round(folderDurationMs),
        indexedFiles: folder.indexedFiles,
        indexedSymbols: folder.indexedSymbols,
        skippedFiles: folder.skippedFiles,
      },
    },
    readResults: {
      searchSymbols: {
        durationMs: round(searchDurationMs),
        count: search.length,
        topName: search[0]?.name ?? null,
        topFile: search[0]?.filePath ?? null,
        ...buildTokenSavings(searchResultTokens, scopedBaselineTokens),
      },
      getSymbolSourceBatch: {
        durationMs: round(symbolSourceDurationMs),
        itemCount: symbolSource.items.length,
        requestedContextLines: symbolSource.requestedContextLines,
        ...buildTokenSavings(
          symbolSourceResultTokens,
          symbolSourceBaselineTokens,
        ),
      },
      getRankedContext: {
        durationMs: round(rankedContextDurationMs),
        candidateCount: rankedContext.candidateCount,
        bundleItemCount: rankedContext.bundle.items.length,
        bundleEstimatedTokens: rankedContext.bundle.estimatedTokens,
        ...buildTokenSavings(
          rankedContextResultTokens,
          scopedBaselineTokens,
        ),
      },
      diagnosticsFromSubdir: {
        durationMs: round(diagnosticsDurationMs),
        freshnessMode: repoDiagnostics.freshnessMode,
        freshnessScanned: repoDiagnostics.freshnessScanned,
        staleStatus: repoDiagnostics.staleStatus,
        indexedFiles: repoDiagnostics.indexedFiles,
        indexedSymbols: repoDiagnostics.indexedSymbols,
        storageDir: repoDiagnostics.storageDir,
      },
      diagnosticsFromSubdirScan: {
        durationMs: round(diagnosticsScanDurationMs),
        freshnessMode: scannedDiagnostics.freshnessMode,
        freshnessScanned: scannedDiagnostics.freshnessScanned,
        staleStatus: scannedDiagnostics.staleStatus,
        indexedFiles: scannedDiagnostics.indexedFiles,
        indexedSymbols: scannedDiagnostics.indexedSymbols,
        storageDir: scannedDiagnostics.storageDir,
      },
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const benchmarkRepoRoot = options.repoRoot
    ? path.resolve(options.repoRoot)
    : await copyCleanRepo(packageRoot);

  const parseResults = await benchmarkParseTargets(options.runs);
  const surfaceResults = await benchmarkLibrarySurface(benchmarkRepoRoot);

  console.log(
    JSON.stringify(
      {
        benchmarkRepoRoot,
        parseRuns: options.runs,
        parseResults,
        ...surfaceResults,
      },
      null,
      2,
    ),
  );
}

await main();
