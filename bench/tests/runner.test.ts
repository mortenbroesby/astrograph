import { appendFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { indexFolder } from "../../src/index.ts";

import { runBenchmark, runWorkflowTask, loadBenchmarkCorpus } from "../src/index.ts";
import { createBenchmarkFixtureRepo } from "./benchmark-fixture.ts";

describe("benchmark runner", () => {
  it("runs the checked-in benchmark corpus against a narrow workflow", async () => {
    const fixture = createBenchmarkFixtureRepo();
    const repoRoot = fixture.repoRoot;
    const outputDir = path.join(repoRoot, ".benchmarks", "run-1");

    try {
      const outcome = await runBenchmark({
        repoRoot,
        corpusPath: fixture.corpusPath,
        outputDir,
        taskId: "task-corpus-loader",
        workflowId: "symbol-first",
      });

      const results = JSON.parse(readFileSync(outcome.artifacts.resultsPath, "utf8"));
      const corpusLock = JSON.parse(
        readFileSync(outcome.artifacts.corpusLockPath, "utf8"),
      );
      expect(results.tasks).toHaveLength(1);
      expect(results.tokenizer).toBe("cl100k_base");
      expect(results.approximateTokenizer).toBe("tokenx");
      expect(results.repoSha).toBe(fixture.repoSha);
      expect(results.corpus.taskCount).toBe(6);
      expect(corpusLock.snapshot.repoSha).toBe(fixture.repoSha);
      expect(results.tasks[0]).toMatchObject({
        taskId: "task-corpus-loader",
        query: "loadBenchmarkCorpus",
        workflowId: "symbol-first",
        success: true,
        metrics: {
          targetCount: 2,
          hitCount: 1,
        },
      });
      expect(results.tasks[0].estimatedBaselineTokens).toBeGreaterThan(0);
      expect(results.tasks[0].estimatedRetrievedTokens).toBeGreaterThan(0);
      expect("tracePath" in results.tasks[0]).toBe(false);
      expect(readFileSync(outcome.artifacts.reportPath, "utf8")).toContain(
        "# ai-context-engine Benchmark Report",
      );
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("fails strict mode on a dirty checkout", async () => {
    const fixture = createBenchmarkFixtureRepo();

    try {
      appendFileSync(
        path.join(fixture.repoRoot, "bench", "src", "corpus.ts"),
        "\nexport const dirty = true;\n",
      );
      await expect(
        runBenchmark({
          repoRoot: fixture.repoRoot,
          corpusPath: fixture.corpusPath,
          outputDir: path.join(fixture.repoRoot, ".benchmarks", "strict-run"),
          taskId: "task-corpus-loader",
          workflowId: "symbol-first",
          strict: true,
        }),
      ).rejects.toThrow(/clean checkout/i);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  it("keeps workflow evidence inside the allowed task paths", async () => {
    const fixture = createBenchmarkFixtureRepo({
      includeOutOfScopeDuplicate: true,
    });

    try {
      const corpus = loadBenchmarkCorpus(fixture.corpusPath);
      await indexFolder({ repoRoot: fixture.repoRoot });
      const task = corpus.tasks[0];
      if (!task) {
        throw new Error("Expected checked-in benchmark task");
      }

      const symbolFirst = await runWorkflowTask({
        repoRoot: fixture.repoRoot,
        task,
        workflowId: "symbol-first",
      });
      expect(symbolFirst.success).toBe(true);
      expect(
        symbolFirst.evidence.some((item) => item.includes("a-outside.ts")),
      ).toBe(false);

      const bundle = await runWorkflowTask({
        repoRoot: fixture.repoRoot,
        task,
        workflowId: "bundle",
      });
      expect(bundle.success).toBe(true);
      expect(
        bundle.evidence.some((item) => item.includes("a-outside.ts")),
      ).toBe(false);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  }, 20_000);
});
