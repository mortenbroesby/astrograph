import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createBenchmarkFixtureRepo, workspaceRoot } from "./benchmark-fixture.ts";

describe("benchmark cli", () => {
  it("runs the checked-in corpus using repo-root-relative paths", () => {
    const fixture = createBenchmarkFixtureRepo();
    const cliPath = path.resolve(
      workspaceRoot,
      "bench",
      "src",
      "cli.ts",
    );

    try {
      const stdout = execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          cliPath,
          "--repo-root",
          fixture.repoRoot,
          "--corpus",
          ".specs/benchmarks/ai-context-engine-benchmark-corpus.json",
          "--output",
          ".benchmarks/cli-run",
          "--task",
          "task-corpus-loader",
          "--workflow",
          "symbol-first",
        ],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      const artifacts = JSON.parse(stdout);
      expect(artifacts.resultsPath).toBe(
        path.join(fixture.repoRoot, ".benchmarks", "cli-run", "results.json"),
      );

      const results = JSON.parse(readFileSync(artifacts.resultsPath, "utf8"));
      expect(results.tasks).toHaveLength(1);
      expect(results.tasks[0]).toMatchObject({
        taskId: "task-corpus-loader",
        workflowId: "symbol-first",
        success: true,
      });
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  it("fails strict mode on a dirty checkout", () => {
    const fixture = createBenchmarkFixtureRepo();
    const cliPath = path.resolve(
      workspaceRoot,
      "bench",
      "src",
      "cli.ts",
    );

    try {
      appendFileSync(
        path.join(fixture.repoRoot, "bench", "src", "corpus.ts"),
        "\nexport const dirty = true;\n",
      );
      expect(() =>
        execFileSync(
          process.execPath,
          [
            "--experimental-strip-types",
            cliPath,
            "--repo-root",
            fixture.repoRoot,
            "--corpus",
            ".specs/benchmarks/ai-context-engine-benchmark-corpus.json",
            "--output",
            ".benchmarks/cli-run",
            "--task",
            "task-corpus-loader",
            "--workflow",
            "symbol-first",
            "--strict",
          ],
          {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          },
        ),
      ).toThrow(/clean checkout/i);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });
});
