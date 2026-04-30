import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { indexFolder } from "../../src/index.ts";
import { ASTROGRAPH_PACKAGE_VERSION } from "../../src/version.ts";

import { loadBenchmarkCorpus } from "./corpus.ts";
import {
  createBenchmarkResultsArtifact,
  renderBenchmarkReportMarkdown,
  serializeBenchmarkResults,
} from "./report.ts";
import { assertStrictSnapshot, getRepoSnapshot } from "./snapshot.ts";
import {
  APPROXIMATE_BENCHMARK_TOKENIZER,
  BENCHMARK_TOKENIZER,
} from "./tokenizer.ts";
import {
  computeBaselineForTask,
  computeEstimatedBaselineForTask,
  getWorkflowDefinition,
  runWorkflowTask,
} from "./workflows.ts";
import type {
  BenchmarkRunOptions,
  BenchmarkRunOutcome,
  BenchmarkTargetMatch,
  BenchmarkTaskMetrics,
  BenchmarkTaskTarget,
} from "./types.ts";

function makeRunId(repoSha: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${repoSha.slice(0, 7)}-${timestamp}`;
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function evidenceMatchesTarget(
  target: BenchmarkTaskTarget,
  evidence: string,
): boolean {
  return target.mode === "exact"
    ? evidence === target.value
    : evidence.includes(target.value);
}

function buildTargetMatches(
  targets: readonly BenchmarkTaskTarget[],
  rankedEvidence: readonly string[],
): BenchmarkTargetMatch[] {
  return targets.map((target) => {
    const index = rankedEvidence.findIndex((evidence) =>
      evidenceMatchesTarget(target, evidence),
    );
    return {
      target,
      matched: index >= 0,
      rank: index >= 0 ? index + 1 : null,
      evidence: index >= 0 ? rankedEvidence[index] ?? null : null,
    };
  });
}

function buildTaskMetrics(matches: readonly BenchmarkTargetMatch[]): BenchmarkTaskMetrics {
  const targetCount = matches.length;
  const hitCount = matches.filter((match) => match.matched).length;
  const firstRelevantRank = matches.reduce<number | null>((best, match) => {
    if (!match.rank) {
      return best;
    }
    return best === null ? match.rank : Math.min(best, match.rank);
  }, null);
  const ranksWithinTop3 = matches.filter(
    (match) => typeof match.rank === "number" && match.rank <= 3,
  ).length;

  return {
    targetCount,
    hitCount,
    recallPct: targetCount === 0 ? 0 : roundTo((hitCount / targetCount) * 100, 1),
    firstRelevantRank,
    reciprocalRank: firstRelevantRank === null ? 0 : roundTo(1 / firstRelevantRank, 3),
    precisionAt3: roundTo(ranksWithinTop3 / 3, 3),
    top1Hit: firstRelevantRank === 1,
    top3Hit: firstRelevantRank !== null && firstRelevantRank <= 3,
  };
}

export async function runBenchmark(
  options: BenchmarkRunOptions,
): Promise<BenchmarkRunOutcome> {
  const corpus = loadBenchmarkCorpus(options.corpusPath);
  const snapshot = getRepoSnapshot(options.repoRoot);

  if (options.strict) {
    assertStrictSnapshot(snapshot, corpus.manifest.repoSha);
  }

  const repoSha = snapshot.repoSha ?? "unknown";
  const tasks = corpus.tasks.filter((task) =>
    (!options.taskId || task.manifest.id === options.taskId) &&
    (!options.workflowId || task.manifest.workflows.includes(options.workflowId))
  );

  if (tasks.length === 0) {
    throw new Error("No benchmark tasks matched the requested filters");
  }

  await indexFolder({ repoRoot: options.repoRoot });

  const taskResults = [];
  const workflowIds = new Set<string>();

  for (const task of tasks) {
    for (const workflowId of task.manifest.workflows) {
      if (options.workflowId && workflowId !== options.workflowId) {
        continue;
      }
      workflowIds.add(workflowId);
      const baselineTokens = await computeBaselineForTask(options.repoRoot, task);
      const estimatedBaselineTokens = await computeEstimatedBaselineForTask(
        options.repoRoot,
        task,
      );
      const startedAt = Date.now();
      const result = await runWorkflowTask({
        repoRoot: options.repoRoot,
        task,
        workflowId,
      });
      const latencyMs = Date.now() - startedAt;
      const matches = buildTargetMatches(task.manifest.targets, result.rankedEvidence);
      const metrics = buildTaskMetrics(matches);
      const tokenReductionPct =
        baselineTokens === 0
          ? 0
          : roundTo(
              ((baselineTokens - result.retrievedTokens) / baselineTokens) * 100,
              1,
            );
      taskResults.push({
        taskId: task.manifest.id,
        query: task.frontmatter.query,
        workflowId,
        allowedPaths: [...task.manifest.allowedPaths],
        targets: [...task.manifest.targets],
        baselineTokens,
        estimatedBaselineTokens,
        retrievedTokens: result.retrievedTokens,
        estimatedRetrievedTokens: result.estimatedRetrievedTokens,
        tokenReductionPct,
        toolCalls: result.toolCalls,
        latencyMs,
        success: result.success,
        evidence: result.evidence,
        rankedEvidence: result.rankedEvidence,
        matches,
        metrics,
        notes: result.notes,
      });
    }
  }

  const runId = makeRunId(repoSha);
  const results = createBenchmarkResultsArtifact({
    benchmarkName: corpus.manifest.benchmark,
    benchmarkVersion: ASTROGRAPH_PACKAGE_VERSION,
    repoSha,
    engineVersion: ASTROGRAPH_PACKAGE_VERSION,
    tokenizer: BENCHMARK_TOKENIZER,
    approximateTokenizer: APPROXIMATE_BENCHMARK_TOKENIZER,
    runId,
    machine: {
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
    corpus: {
      schemaVersion: corpus.manifest.schemaVersion,
      manifestPath: options.corpusPath,
      benchmark: corpus.manifest.benchmark,
      repo: corpus.manifest.repo,
      repoSha: corpus.manifest.repoSha,
      tokenizer: corpus.manifest.tokenizer,
      taskCount: corpus.manifest.tasks.length,
    },
    workflows: [...workflowIds].map((workflowId) => {
      const workflow = getWorkflowDefinition(workflowId);
      return {
        workflowId,
        label: workflow.label,
        description: workflow.description,
      };
    }),
    tasks: taskResults,
  });

  const runDir = path.resolve(options.outputDir);
  await mkdir(runDir, { recursive: true });
  const resultsPath = `${runDir}/results.json`;
  const reportPath = `${runDir}/report.md`;
  const corpusLockPath = `${runDir}/corpus.lock.json`;
  await writeFile(resultsPath, `${serializeBenchmarkResults(results)}\n`);
  await writeFile(reportPath, renderBenchmarkReportMarkdown(results));
  await writeFile(
    corpusLockPath,
    `${JSON.stringify(
      {
        manifest: corpus.manifest,
        snapshot,
        strict: options.strict ?? false,
      },
      null,
      2,
    )}\n`,
  );

  return {
    results,
    artifacts: {
      resultsPath,
      reportPath,
      corpusLockPath,
    },
  };
}
