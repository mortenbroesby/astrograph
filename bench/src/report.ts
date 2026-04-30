import type {
  BenchmarkResults,
  BenchmarkResultsInput,
  BenchmarkTaskResult,
  BenchmarkWorkflowDefinition,
} from "./types.ts";

function normalizePercentage(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toFixed(1).replace(/\.0$/, "");
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function joinCellValues(values: readonly string[]): string {
  if (!values.length) {
    return "-";
  }

  return values.map(escapeTableCell).join("<br>");
}

function compareWorkflowOrder(
  left: BenchmarkWorkflowDefinition,
  right: BenchmarkWorkflowDefinition,
  indexByWorkflowId: Map<string, number>,
): number {
  return (
    (indexByWorkflowId.get(left.workflowId) ?? Number.MAX_SAFE_INTEGER) -
    (indexByWorkflowId.get(right.workflowId) ?? Number.MAX_SAFE_INTEGER) ||
    left.workflowId.localeCompare(right.workflowId)
  );
}

function summarizeTasks(tasks: readonly BenchmarkTaskResult[]) {
  const baselineTokens = tasks.reduce((sum, task) => sum + task.baselineTokens, 0);
  const estimatedBaselineTokens = tasks.reduce(
    (sum, task) => sum + (task.estimatedBaselineTokens ?? 0),
    0,
  );
  const retrievedTokens = tasks.reduce((sum, task) => sum + task.retrievedTokens, 0);
  const estimatedRetrievedTokens = tasks.reduce(
    (sum, task) => sum + (task.estimatedRetrievedTokens ?? 0),
    0,
  );
  const successCount = tasks.filter((task) => task.success).length;
  const failureCount = tasks.length - successCount;
  const targetCount = tasks.reduce((sum, task) => sum + task.metrics.targetCount, 0);
  const hitCount = tasks.reduce((sum, task) => sum + task.metrics.hitCount, 0);
  const totalLatencyMs = tasks.reduce((sum, task) => sum + task.latencyMs, 0);
  const totalToolCalls = tasks.reduce((sum, task) => sum + task.toolCalls, 0);
  const averageRecallPct =
    tasks.length === 0
      ? 0
      : tasks.reduce((sum, task) => sum + task.metrics.recallPct, 0) / tasks.length;
  const averageReciprocalRank =
    tasks.length === 0
      ? 0
      : tasks.reduce((sum, task) => sum + task.metrics.reciprocalRank, 0) / tasks.length;
  const averagePrecisionAt3 =
    tasks.length === 0
      ? 0
      : tasks.reduce((sum, task) => sum + task.metrics.precisionAt3, 0) / tasks.length;
  const tokenReductionPct =
    baselineTokens === 0
      ? 0
      : Math.round(((baselineTokens - retrievedTokens) / baselineTokens) * 1000) / 10;

  return {
    taskCount: tasks.length,
    successCount,
    failureCount,
    targetCount,
    hitCount,
    overallRecallPct:
      targetCount === 0 ? 0 : Math.round((hitCount / targetCount) * 1000) / 10,
    averageRecallPct: Math.round(averageRecallPct * 10) / 10,
    averageReciprocalRank: Math.round(averageReciprocalRank * 1000) / 1000,
    averagePrecisionAt3: Math.round(averagePrecisionAt3 * 1000) / 1000,
    top1HitCount: tasks.filter((task) => task.metrics.top1Hit).length,
    top3HitCount: tasks.filter((task) => task.metrics.top3Hit).length,
    baselineTokens,
    estimatedBaselineTokens,
    retrievedTokens,
    estimatedRetrievedTokens,
    tokenReductionPct,
    totalLatencyMs,
    averageLatencyMs:
      tasks.length === 0 ? 0 : Math.round((totalLatencyMs / tasks.length) * 10) / 10,
    totalToolCalls,
    averageToolCalls:
      tasks.length === 0 ? 0 : Math.round((totalToolCalls / tasks.length) * 10) / 10,
  };
}

export function createBenchmarkResultsArtifact(
  input: BenchmarkResultsInput,
): BenchmarkResults {
  const summary = summarizeTasks(input.tasks);

  return {
    schemaVersion: input.schemaVersion ?? 1,
    benchmarkName: input.benchmarkName,
    benchmarkVersion: input.benchmarkVersion,
    repoSha: input.repoSha,
    engineVersion: input.engineVersion,
    tokenizer: input.tokenizer,
    ...(input.approximateTokenizer
      ? { approximateTokenizer: input.approximateTokenizer }
      : {}),
    runId: input.runId,
    machine: {
      hostname: input.machine.hostname,
      platform: input.machine.platform,
      arch: input.machine.arch,
      nodeVersion: input.machine.nodeVersion,
    },
    corpus: {
      schemaVersion: input.corpus.schemaVersion,
      manifestPath: input.corpus.manifestPath,
      benchmark: input.corpus.benchmark,
      repo: input.corpus.repo,
      repoSha: input.corpus.repoSha,
      tokenizer: input.corpus.tokenizer,
      taskCount: input.corpus.taskCount ?? input.tasks.length,
    },
    workflows: input.workflows.map((workflow) => ({
      workflowId: workflow.workflowId,
      label: workflow.label,
      ...(workflow.description ? { description: workflow.description } : {}),
    })),
    tasks: input.tasks.map((task) => ({
      taskId: task.taskId,
      query: task.query,
      workflowId: task.workflowId,
      allowedPaths: [...task.allowedPaths],
      targets: task.targets.map((target) => ({
        kind: target.kind,
        value: target.value,
        mode: target.mode,
      })),
      baselineTokens: task.baselineTokens,
      ...(typeof task.estimatedBaselineTokens === "number"
        ? { estimatedBaselineTokens: task.estimatedBaselineTokens }
        : {}),
      retrievedTokens: task.retrievedTokens,
      ...(typeof task.estimatedRetrievedTokens === "number"
        ? { estimatedRetrievedTokens: task.estimatedRetrievedTokens }
        : {}),
      tokenReductionPct: task.tokenReductionPct,
      toolCalls: task.toolCalls,
      latencyMs: task.latencyMs,
      success: task.success,
      evidence: [...task.evidence],
      rankedEvidence: [...task.rankedEvidence],
      matches: task.matches.map((match) => ({
        target: {
          kind: match.target.kind,
          value: match.target.value,
          mode: match.target.mode,
        },
        matched: match.matched,
        rank: match.rank,
        evidence: match.evidence,
      })),
      metrics: {
        targetCount: task.metrics.targetCount,
        hitCount: task.metrics.hitCount,
        recallPct: task.metrics.recallPct,
        firstRelevantRank: task.metrics.firstRelevantRank,
        reciprocalRank: task.metrics.reciprocalRank,
        precisionAt3: task.metrics.precisionAt3,
        top1Hit: task.metrics.top1Hit,
        top3Hit: task.metrics.top3Hit,
      },
      notes: [...task.notes],
    })),
    summary: {
      taskCount: summary.taskCount,
      workflowCount: input.workflows.length,
      successCount: summary.successCount,
      failureCount: summary.failureCount,
      targetCount: summary.targetCount,
      hitCount: summary.hitCount,
      overallRecallPct: summary.overallRecallPct,
      averageRecallPct: summary.averageRecallPct,
      averageReciprocalRank: summary.averageReciprocalRank,
      averagePrecisionAt3: summary.averagePrecisionAt3,
      top1HitCount: summary.top1HitCount,
      top3HitCount: summary.top3HitCount,
      baselineTokens: summary.baselineTokens,
      estimatedBaselineTokens: summary.estimatedBaselineTokens,
      retrievedTokens: summary.retrievedTokens,
      estimatedRetrievedTokens: summary.estimatedRetrievedTokens,
      tokenReductionPct: summary.tokenReductionPct,
      totalLatencyMs: summary.totalLatencyMs,
      averageLatencyMs: summary.averageLatencyMs,
      totalToolCalls: summary.totalToolCalls,
      averageToolCalls: summary.averageToolCalls,
    },
  };
}

export function serializeBenchmarkResults(results: BenchmarkResults): string {
  return JSON.stringify(results, null, 2);
}

export function renderBenchmarkReportMarkdown(results: BenchmarkResults): string {
  const workflowIndex = new Map(
    results.workflows.map((workflow, index) => [workflow.workflowId, index]),
  );
  const sortedWorkflows = [...results.workflows].sort((left, right) =>
    compareWorkflowOrder(left, right, workflowIndex),
  );
  const workflowSummaries = sortedWorkflows.map((workflow) => {
    const workflowTasks = results.tasks.filter(
      (task) => task.workflowId === workflow.workflowId,
    );
    const summary = summarizeTasks(workflowTasks);

    return {
      workflow,
      summary,
    };
  });

  const lines = [
    `# ${results.benchmarkName} Benchmark Report`,
    "",
    "## Benchmark Metadata",
    `- Benchmark: \`${results.benchmarkName}\``,
    `- Benchmark Version: \`${results.benchmarkVersion}\``,
    `- Repo SHA: \`${results.repoSha}\``,
    `- Engine Version: \`${results.engineVersion}\``,
    `- Tokenizer: \`${results.tokenizer}\``,
    ...(results.approximateTokenizer
      ? [`- Approximate Estimator: \`${results.approximateTokenizer}\``]
      : []),
    `- Run ID: \`${results.runId}\``,
    "",
    "## Corpus Metadata",
    `- Manifest Path: \`${results.corpus.manifestPath}\``,
    `- Repo: \`${results.corpus.repo}\``,
    `- Repo SHA: \`${results.corpus.repoSha}\``,
    `- Tokenizer: \`${results.corpus.tokenizer}\``,
    `- Task Count: \`${results.corpus.taskCount}\``,
    "",
    "## Workflows",
    "| Workflow ID | Label | Description |",
    "| --- | --- | --- |",
    ...sortedWorkflows.map(
      (workflow) =>
        `| ${escapeTableCell(workflow.workflowId)} | ${escapeTableCell(workflow.label)} | ${escapeTableCell(workflow.description ?? "-")} |`,
    ),
    "",
    "## Per-Task Results",
    "| Task ID | Workflow | Recall | First Rank | MRR | P@3 | Success | Baseline Tokens | Est. Baseline | Retrieved Tokens | Est. Retrieved | Reduction | Tool Calls | Latency (ms) | Evidence | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...results.tasks.map(
      (task) =>
        `| ${escapeTableCell(task.taskId)} | ${escapeTableCell(task.workflowId)} | ${normalizePercentage(task.metrics.recallPct)}% | ${task.metrics.firstRelevantRank ?? "-"} | ${normalizePercentage(task.metrics.reciprocalRank)} | ${normalizePercentage(task.metrics.precisionAt3)} | ${task.success ? "yes" : "no"} | ${task.baselineTokens} | ${task.estimatedBaselineTokens ?? "-"} | ${task.retrievedTokens} | ${task.estimatedRetrievedTokens ?? "-"} | ${normalizePercentage(task.tokenReductionPct)}% | ${task.toolCalls} | ${task.latencyMs} | ${joinCellValues(task.evidence)} | ${joinCellValues(task.notes)} |`,
    ),
    "",
    "## Per-Workflow Summary",
    "| Workflow ID | Tasks | Success | Failures | Hits | Targets | Recall | Avg. MRR | Avg. P@3 | Avg. Latency (ms) | Baseline Tokens | Retrieved Tokens | Reduction |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...workflowSummaries.map(
      ({ workflow, summary }) =>
        `| ${escapeTableCell(workflow.workflowId)} | ${summary.taskCount} | ${summary.successCount} | ${summary.failureCount} | ${summary.hitCount} | ${summary.targetCount} | ${normalizePercentage(summary.overallRecallPct)}% | ${normalizePercentage(summary.averageReciprocalRank)} | ${normalizePercentage(summary.averagePrecisionAt3)} | ${normalizePercentage(summary.averageLatencyMs)} | ${summary.baselineTokens} | ${summary.retrievedTokens} | ${normalizePercentage(summary.tokenReductionPct)}% |`,
    ),
    "",
    "## Grand Total",
    `- Tasks: \`${results.summary.taskCount}\``,
    `- Successes: \`${results.summary.successCount}\``,
    `- Failures: \`${results.summary.failureCount}\``,
    `- Target Hits: \`${results.summary.hitCount}/${results.summary.targetCount}\``,
    `- Overall Recall: \`${normalizePercentage(results.summary.overallRecallPct)}%\``,
    `- Average Recall: \`${normalizePercentage(results.summary.averageRecallPct)}%\``,
    `- Average MRR: \`${normalizePercentage(results.summary.averageReciprocalRank)}\``,
    `- Average Precision@3: \`${normalizePercentage(results.summary.averagePrecisionAt3)}\``,
    `- Top-1 Hits: \`${results.summary.top1HitCount}\``,
    `- Top-3 Hits: \`${results.summary.top3HitCount}\``,
    `- Baseline Tokens: \`${results.summary.baselineTokens}\``,
    `- Estimated Baseline Tokens: \`${results.summary.estimatedBaselineTokens ?? 0}\``,
    `- Retrieved Tokens: \`${results.summary.retrievedTokens}\``,
    `- Estimated Retrieved Tokens: \`${results.summary.estimatedRetrievedTokens ?? 0}\``,
    `- Reduction: \`${normalizePercentage(results.summary.tokenReductionPct)}%\``,
    `- Total Latency (ms): \`${results.summary.totalLatencyMs}\``,
    `- Average Latency (ms): \`${normalizePercentage(results.summary.averageLatencyMs)}\``,
    `- Total Tool Calls: \`${results.summary.totalToolCalls}\``,
    `- Average Tool Calls: \`${normalizePercentage(results.summary.averageToolCalls)}\``,
    "",
    "## Failure Notes",
    ...(
      results.tasks.filter((task) => !task.success).length
        ? results.tasks
            .filter((task) => !task.success)
            .map(
              (task) =>
                `- ${escapeTableCell(task.taskId)} / ${escapeTableCell(task.workflowId)}: ${joinCellValues(task.notes)}`,
            )
        : ["- None"]
    ),
  ];

  return `${lines.join("\n")}\n`;
}
