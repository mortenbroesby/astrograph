import { describe, expect, it } from "vitest";

import {
  createBenchmarkResultsArtifact,
  renderBenchmarkReportMarkdown,
  serializeBenchmarkResults,
} from "../src/index.ts";

function createSyntheticResults() {
  return createBenchmarkResultsArtifact({
    benchmarkName: "astrograph",
    benchmarkVersion: "2026.04",
    repoSha: "abc123",
    engineVersion: "1.2.3",
    tokenizer: "cl100k_base",
    approximateTokenizer: "tokenx",
    runId: "abc123-20260415T120000Z",
    machine: {
      hostname: "ci",
      platform: "linux",
      arch: "x64",
      nodeVersion: "24.0.0",
    },
    corpus: {
      schemaVersion: 1,
      manifestPath: "bench/tests/fixtures/benchmarks/ai-context-engine-benchmark-corpus.json",
      benchmark: "astrograph",
      repo: "astrograph",
      repoSha: "abc123",
      tokenizer: "cl100k_base",
      taskCount: 2,
    },
    workflows: [
      {
        workflowId: "symbol-first",
        label: "Symbol First",
        description: "Start from symbols before reading source.",
      },
    ],
    tasks: [
      {
        taskId: "task-1",
        query: "Find the symbol search entrypoint",
        workflowId: "symbol-first",
        allowedPaths: ["tools/astrograph/**"],
        targets: [
          {
            kind: "symbol",
            value: "searchSymbols",
            mode: "exact",
          },
        ],
        baselineTokens: 120,
        estimatedBaselineTokens: 126,
        retrievedTokens: 40,
        estimatedRetrievedTokens: 44,
        tokenReductionPct: 66.7,
        toolCalls: 3,
        latencyMs: 21,
        success: true,
        evidence: ["tools/astrograph/src/index.ts"],
        rankedEvidence: ["searchSymbols", "tools/astrograph/src/index.ts"],
        matches: [
          {
            target: {
              kind: "symbol",
              value: "searchSymbols",
              mode: "exact",
            },
            matched: true,
            rank: 1,
            evidence: "searchSymbols",
          },
        ],
        metrics: {
          targetCount: 1,
          hitCount: 1,
          recallPct: 100,
          firstRelevantRank: 1,
          reciprocalRank: 1,
          precisionAt3: 0.333,
          top1Hit: true,
          top3Hit: true,
        },
        notes: ["found by exact symbol lookup"],
      },
      {
        taskId: "task-2",
        query: "Find the bundle entrypoint",
        workflowId: "symbol-first",
        allowedPaths: ["tools/astrograph/**"],
        targets: [
          {
            kind: "symbol",
            value: "getContextBundle",
            mode: "exact",
          },
        ],
        baselineTokens: 80,
        estimatedBaselineTokens: 82,
        retrievedTokens: 60,
        estimatedRetrievedTokens: 61,
        tokenReductionPct: 25,
        toolCalls: 5,
        latencyMs: 32,
        success: false,
        evidence: ["missing symbol"],
        rankedEvidence: ["missing symbol"],
        matches: [
          {
            target: {
              kind: "symbol",
              value: "getContextBundle",
              mode: "exact",
            },
            matched: false,
            rank: null,
            evidence: null,
          },
        ],
        metrics: {
          targetCount: 1,
          hitCount: 0,
          recallPct: 0,
          firstRelevantRank: null,
          reciprocalRank: 0,
          precisionAt3: 0,
          top1Hit: false,
          top3Hit: false,
        },
        notes: ["fallback search only"],
      },
    ],
  });
}

describe("benchmark reporting", () => {
  it("serializes benchmark results with a stable JSON shape", () => {
    const results = createSyntheticResults();
    expect(JSON.parse(serializeBenchmarkResults(results))).toMatchObject({
      benchmarkName: "astrograph",
      tokenizer: "cl100k_base",
      corpus: {
        taskCount: 2,
      },
      tasks: [
        {
          taskId: "task-1",
          query: "Find the symbol search entrypoint",
          metrics: {
            targetCount: 1,
            hitCount: 1,
            recallPct: 100,
            firstRelevantRank: 1,
          },
        },
        {
          taskId: "task-2",
          metrics: {
            targetCount: 1,
            hitCount: 0,
            recallPct: 0,
            firstRelevantRank: null,
          },
        },
      ],
      summary: {
        taskCount: 2,
        workflowCount: 1,
        successCount: 1,
        failureCount: 1,
        targetCount: 2,
        hitCount: 1,
        overallRecallPct: 50,
        averageRecallPct: 50,
        averageReciprocalRank: 0.5,
        averagePrecisionAt3: 0.167,
        top1HitCount: 1,
        top3HitCount: 1,
        baselineTokens: 200,
        estimatedBaselineTokens: 208,
        retrievedTokens: 100,
        estimatedRetrievedTokens: 105,
        tokenReductionPct: 50,
        totalLatencyMs: 53,
        averageLatencyMs: 26.5,
        totalToolCalls: 8,
        averageToolCalls: 4,
      },
    });
  });

  it("renders a deterministic markdown report from synthetic results", () => {
    const results = createSyntheticResults();
    const markdown = renderBenchmarkReportMarkdown(results);

    expect(markdown).toContain("| Task ID | Workflow | Recall | First Rank | MRR | P@3 | Success |");
    expect(markdown).toContain(
      "| task-1 | symbol-first | 100% | 1 | 1 | 0.3 | yes | 120 | 126 | 40 | 44 | 66.7% | 3 | 21 | tools/astrograph/src/index.ts | found by exact symbol lookup |",
    );
    expect(markdown).toContain(
      "| symbol-first | 2 | 1 | 1 | 1 | 2 | 50% | 0.5 | 0.2 | 26.5 | 200 | 100 | 50% |",
    );
    expect(markdown).toContain("- Target Hits: `1/2`");
    expect(markdown).toContain("- Average MRR: `0.5`");
    expect(markdown).toContain("- Average Precision@3: `0.2`");
    expect(markdown).toContain("- Average Tool Calls: `4`");
  });
});
