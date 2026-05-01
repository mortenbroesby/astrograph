#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  diagnostics,
  getFileTree,
  getRepoOutline,
  indexFile,
  indexFolder,
  queryCode,
} from "../src/index.ts";
import { listSupportedFiles } from "../src/filesystem-scan.ts";
import { parseSourceFile, supportedLanguageForFile } from "../src/parser.ts";
import { serializeToolResult } from "../src/serialization.ts";

export const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const EXCLUDED_SEGMENTS = new Set([
  ".astrograph",
  ".benchmarks",
  ".git",
  ".next",
  ".stryker-tmp",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
]);

function round(value) {
  return Math.round(value * 10) / 10;
}

export function parsePerfArgs(argv) {
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
    repoRoot: args.get("repo")
      ? path.resolve(args.get("repo"))
      : packageRoot,
    runs: Number(args.get("runs") ?? "15"),
  };
}

export function formatHumanSummary(title, metrics) {
  return [
    `${title}`,
    ...Object.entries(metrics).map(([key, value]) => `- ${key}: ${value}`),
  ].join("\n");
}

export function printHumanSummary(title, metrics) {
  process.stderr.write(`${formatHumanSummary(title, metrics)}\n`);
}

export function getGitCommit(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return result.status === 0 ? result.stdout.trim() : null;
}

export async function copyCleanRepo(sourceRoot) {
  const benchRoot = await mkdtemp(
    path.join(os.tmpdir(), "astrograph-perf-"),
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

  return {
    benchRoot,
    targetRoot,
  };
}

export async function cleanupBenchRoot(benchRoot) {
  await rm(benchRoot, { recursive: true, force: true });
}

export async function listSupportedSourceFiles(rootDir, currentDir = rootDir) {
  return listSupportedFiles(rootDir, currentDir);
}

export async function measureFileDiscovery(repoRoot) {
  const startedAt = performance.now();
  const files = await listSupportedSourceFiles(repoRoot);
  return {
    files,
    ms: round(performance.now() - startedAt),
  };
}

export async function measureHashing(repoRoot, relativePaths) {
  const startedAt = performance.now();
  for (const relativePath of relativePaths) {
    const content = await readFile(path.join(repoRoot, relativePath), "utf8");
    createHash("sha256").update(content).digest("hex");
  }

  return round(performance.now() - startedAt);
}

export async function measureParsing(repoRoot, relativePaths) {
  const startedAt = performance.now();
  let symbolCount = 0;
  let importCount = 0;

  for (const relativePath of relativePaths) {
    const content = await readFile(path.join(repoRoot, relativePath), "utf8");
    const language = supportedLanguageForFile(relativePath);
    if (!language) {
      continue;
    }
    const parsed = parseSourceFile({
      relativePath,
      content,
      language,
      summaryStrategy: "doc-comments-first",
    });
    symbolCount += parsed.symbols.length;
    importCount += parsed.imports.length;
  }

  return {
    ms: round(performance.now() - startedAt),
    symbolCount,
    importCount,
  };
}

export async function measureColdAndWarmIndex(repoRoot) {
  await rm(path.join(repoRoot, ".astrograph"), { recursive: true, force: true });

  const coldStartedAt = performance.now();
  const coldIndex = await indexFolder({ repoRoot });
  const coldIndexMs = round(performance.now() - coldStartedAt);

  const warmStartedAt = performance.now();
  const warmIndex = await indexFolder({ repoRoot });
  const warmNoopRefreshMs = round(performance.now() - warmStartedAt);

  const sourceFiles = await listSupportedSourceFiles(repoRoot);
  const changedFilePath = sourceFiles.find((filePath) => filePath.endsWith(".ts") || filePath.endsWith(".js"));
  if (!changedFilePath) {
    throw new Error("No supported source file found for changed-file refresh benchmark.");
  }

  const changedAbsolutePath = path.join(repoRoot, changedFilePath);
  const originalContent = await readFile(changedAbsolutePath, "utf8");
  await writeFile(
    changedAbsolutePath,
    `${originalContent}\n// perf-refresh-marker\n`,
  );

  const changedStartedAt = performance.now();
  const changedRefresh = await indexFile({
    repoRoot,
    filePath: changedFilePath,
  });
  const warmChangedRefreshMs = round(performance.now() - changedStartedAt);

  return {
    coldIndex,
    coldIndexMs,
    warmIndex,
    warmNoopRefreshMs,
    changedRefresh,
    warmChangedRefreshMs,
    changedFilePath,
  };
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index];
}

export async function measureQueryLatency(repoRoot, runs) {
  await rm(path.join(repoRoot, ".astrograph"), { recursive: true, force: true });
  await indexFolder({ repoRoot });

  const discoverSamples = [];
  const assembleSamples = [];
  const queries = ["Greeter", "area", "formatLabel"];

  for (let run = 0; run < runs; run += 1) {
    const query = queries[run % queries.length];

    const discoverStartedAt = performance.now();
    await queryCode({
      repoRoot,
      query,
      intent: "discover",
      includeTextMatches: true,
    });
    discoverSamples.push(performance.now() - discoverStartedAt);

    const assembleStartedAt = performance.now();
    await queryCode({
      repoRoot,
      query,
      intent: "assemble",
      tokenBudget: 180,
      includeRankedCandidates: true,
    });
    assembleSamples.push(performance.now() - assembleStartedAt);
  }

  return {
    queryCodeDiscoverP50Ms: round(percentile(discoverSamples, 0.5)),
    queryCodeDiscoverP95Ms: round(percentile(discoverSamples, 0.95)),
    queryCodeAssembleP50Ms: round(percentile(assembleSamples, 0.5)),
    queryCodeAssembleP95Ms: round(percentile(assembleSamples, 0.95)),
  };
}

export async function collectIndexPerfMetrics(sourceRepoRoot) {
  const { benchRoot, targetRoot } = await copyCleanRepo(sourceRepoRoot);

  try {
    const discovery = await measureFileDiscovery(targetRoot);
    const hashingMs = await measureHashing(targetRoot, discovery.files);
    const parsing = await measureParsing(targetRoot, discovery.files);
    const indexing = await measureColdAndWarmIndex(targetRoot);

    return {
      schemaVersion: "1.0",
      sourceRepoRoot,
      repoRoot: targetRoot,
      commit: getGitCommit(sourceRepoRoot),
      measuredAt: new Date().toISOString(),
      metrics: {
        fileCount: discovery.files.length,
        fileDiscoveryMs: discovery.ms,
        hashingMs,
        parseMs: parsing.ms,
        parsedSymbols: parsing.symbolCount,
        parsedImports: parsing.importCount,
        coldIndexMs: indexing.coldIndexMs,
        warmNoopRefreshMs: indexing.warmNoopRefreshMs,
        warmChangedRefreshMs: indexing.warmChangedRefreshMs,
        sqliteWriteMsApprox: round(
          Math.max(
            0,
            indexing.coldIndexMs - discovery.ms - hashingMs - parsing.ms,
          ),
        ),
      },
      notes: {
        changedFilePath: indexing.changedFilePath,
        sqliteWriteMsApprox:
          "Approximation derived from coldIndexMs minus discovery, hashing, and parse timings in the same temp repo.",
      },
    };
  } finally {
    await cleanupBenchRoot(benchRoot);
  }
}

export async function collectQueryPerfMetrics(sourceRepoRoot, runs) {
  const { benchRoot, targetRoot } = await copyCleanRepo(sourceRepoRoot);

  try {
    const queryMetrics = await measureQueryLatency(targetRoot, runs);
    return {
      schemaVersion: "1.0",
      sourceRepoRoot,
      repoRoot: targetRoot,
      commit: getGitCommit(sourceRepoRoot),
      measuredAt: new Date().toISOString(),
      runs,
      metrics: queryMetrics,
    };
  } finally {
    await cleanupBenchRoot(benchRoot);
  }
}

function measureSerializationLoop(iterations, serialize) {
  const startedAt = performance.now();
  let bytes = 0;

  for (let index = 0; index < iterations; index += 1) {
    bytes += serialize().length;
  }

  return {
    ms: round(performance.now() - startedAt),
    bytes,
  };
}

export async function collectSerializationPerfMetrics(sourceRepoRoot, runs) {
  const { benchRoot, targetRoot } = await copyCleanRepo(sourceRepoRoot);

  try {
    await indexFolder({ repoRoot: targetRoot });

    const samples = {
      diagnostics: await diagnostics({ repoRoot: targetRoot }),
      get_repo_outline: await getRepoOutline({ repoRoot: targetRoot }),
      get_file_tree: await getFileTree({ repoRoot: targetRoot }),
    };

    const metrics = Object.fromEntries(
      Object.entries(samples).map(([toolName, value]) => {
        const nativeCompact = measureSerializationLoop(runs, () => JSON.stringify(value));
        const optimized = measureSerializationLoop(
          runs,
          () => serializeToolResult(toolName, value),
        );

        return [
          toolName,
          {
            iterations: runs,
            nativeCompactMs: nativeCompact.ms,
            optimizedMs: optimized.ms,
            bytesPerIteration: Math.round(optimized.bytes / runs),
          },
        ];
      }),
    );

    return {
      schemaVersion: "1.0",
      sourceRepoRoot,
      repoRoot: targetRoot,
      commit: getGitCommit(sourceRepoRoot),
      measuredAt: new Date().toISOString(),
      metrics,
    };
  } finally {
    await cleanupBenchRoot(benchRoot);
  }
}
