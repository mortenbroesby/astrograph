#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { indexFolder, searchSymbols } from "../src/index.ts";
import { loadBenchmarkCorpus } from "../bench/src/index.ts";

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
    repoRoot: path.resolve(args.get("repo") ?? process.cwd()),
    corpusPath: path.resolve(
      args.get("corpus") ??
        "bench/tests/fixtures/benchmarks/ai-context-engine-benchmark-corpus.json",
    ),
    outputPath: path.resolve(
      args.get("output") ??
        "bench/tests/fixtures/benchmarks/evidence/retrieval-quality-baseline.json",
    ),
    taskPrefix: args.get("task-prefix") ?? "task-retrieval-quality-",
    limit: Number(args.get("limit") ?? "5"),
  };
}

function readRepoSha(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return "unknown";
  }

  return result.stdout.trim() || "unknown";
}

function buildTargetMatches(targets, results) {
  return targets.map((target) => {
    const index = results.findIndex((result) => result.name === target.value);
    return {
      target,
      matched: index >= 0,
      rank: index >= 0 ? index + 1 : null,
      filePath: index >= 0 ? results[index]?.filePath ?? null : null,
    };
  });
}

function summarizeMatches(matches) {
  const hitCount = matches.filter((match) => match.matched).length;
  const firstRelevantRank = matches.reduce((best, match) => {
    if (!match.rank) {
      return best;
    }

    return best === null ? match.rank : Math.min(best, match.rank);
  }, null);

  return {
    targetCount: matches.length,
    hitCount,
    firstRelevantRank,
    top1Hit: firstRelevantRank === 1,
    top3Hit: firstRelevantRank !== null && firstRelevantRank <= 3,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const corpus = loadBenchmarkCorpus(options.corpusPath);
  const tasks = corpus.tasks.filter((task) =>
    task.manifest.id.startsWith(options.taskPrefix),
  );

  if (tasks.length === 0) {
    throw new Error(`No benchmark tasks matched prefix ${options.taskPrefix}`);
  }

  await indexFolder({ repoRoot: options.repoRoot });

  const taskResults = [];

  for (const task of tasks) {
    const results = await searchSymbols({
      repoRoot: options.repoRoot,
      query: task.frontmatter.query,
      limit: options.limit,
    });
    const rankedResults = results.map((result) => ({
      id: result.id,
      name: result.name,
      qualifiedName: result.qualifiedName,
      kind: result.kind,
      filePath: result.filePath,
      startLine: result.startLine,
      endLine: result.endLine,
      exported: result.exported,
    }));
    const matches = buildTargetMatches(task.manifest.targets, rankedResults);

    taskResults.push({
      taskId: task.manifest.id,
      query: task.frontmatter.query,
      slice: task.frontmatter.slice,
      workflows: task.manifest.workflows,
      allowedPaths: task.manifest.allowedPaths,
      targets: task.manifest.targets,
      successCriteria: task.frontmatter.successCriteria,
      topResults: rankedResults,
      matches,
      metrics: summarizeMatches(matches),
    });
  }

  const artifact = {
    schemaVersion: 1,
    benchmark: "retrieval-quality-search",
    generatedAt: new Date().toISOString(),
    repoRoot: options.repoRoot,
    repoSha: readRepoSha(options.repoRoot),
    corpusPath: options.corpusPath,
    taskPrefix: options.taskPrefix,
    limit: options.limit,
    tasks: taskResults,
    summary: {
      taskCount: taskResults.length,
      hitCount: taskResults.reduce(
        (total, task) => total + task.metrics.hitCount,
        0,
      ),
      targetCount: taskResults.reduce(
        (total, task) => total + task.metrics.targetCount,
        0,
      ),
      top1HitCount: taskResults.filter((task) => task.metrics.top1Hit).length,
      top3HitCount: taskResults.filter((task) => task.metrics.top3Hit).length,
    },
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
}

await main();
