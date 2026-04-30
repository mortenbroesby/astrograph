import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("astrograph perf scripts", () => {
  it("emits stable baseline JSON from the aggregate perf script", async () => {
    const repoRoot = await createFixtureRepo();
    const stdout = execFileSync(
      "node",
      [
        "--experimental-strip-types",
        "./scripts/perf.mjs",
        "--repo",
        repoRoot,
        "--runs",
        "3",
      ],
      {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
      },
    );

    const result = JSON.parse(stdout);

    expect(result.schemaVersion).toBe("1.0");
    expect(result.sourceRepoRoot).toBe(repoRoot);
    expect(result.index.metrics.fileCount).toBeGreaterThan(0);
    expect(result.index.metrics.coldIndexMs).toBeGreaterThanOrEqual(0);
    expect(result.index.metrics.warmNoopRefreshMs).toBeGreaterThanOrEqual(0);
    expect(result.index.metrics.warmChangedRefreshMs).toBeGreaterThanOrEqual(0);
    expect(result.index.metrics.fileDiscoveryMs).toBeGreaterThanOrEqual(0);
    expect(result.index.metrics.hashingMs).toBeGreaterThanOrEqual(0);
    expect(result.index.metrics.parseMs).toBeGreaterThanOrEqual(0);
    expect(result.index.metrics.sqliteWriteMsApprox).toBeGreaterThanOrEqual(0);
    expect(result.query.runs).toBe(3);
    expect(result.query.metrics.queryCodeDiscoverP50Ms).toBeGreaterThanOrEqual(0);
    expect(result.query.metrics.queryCodeDiscoverP95Ms).toBeGreaterThanOrEqual(0);
    expect(result.query.metrics.queryCodeAssembleP50Ms).toBeGreaterThanOrEqual(0);
    expect(result.query.metrics.queryCodeAssembleP95Ms).toBeGreaterThanOrEqual(0);
  });

  it("emits stable serialization benchmark JSON", async () => {
    const repoRoot = await createFixtureRepo();
    const stdout = execFileSync(
      "node",
      [
        "--experimental-strip-types",
        "./scripts/perf-serialize.mjs",
        "--repo",
        repoRoot,
        "--runs",
        "25",
      ],
      {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
      },
    );

    const result = JSON.parse(stdout);

    expect(result.schemaVersion).toBe("1.0");
    expect(result.sourceRepoRoot).toBe(repoRoot);
    expect(result.metrics.diagnostics.iterations).toBe(25);
    expect(result.metrics.diagnostics.nativeCompactMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.diagnostics.optimizedMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.get_repo_outline.bytesPerIteration).toBeGreaterThan(0);
    expect(result.metrics.get_file_tree.bytesPerIteration).toBeGreaterThan(0);
  });
});
