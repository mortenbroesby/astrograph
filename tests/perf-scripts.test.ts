import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("astrograph perf scripts", () => {
  async function createMonorepoFixture() {
    const repoRoot = await createFixtureRepo({ directoryPrefix: "astrograph-perf-monorepo-" });
    await mkdir(path.join(repoRoot, "apps", "web", "src"), { recursive: true });
    await mkdir(path.join(repoRoot, "services", "api", "src"), { recursive: true });
    await mkdir(path.join(repoRoot, "services", "worker", "src"), { recursive: true });
    await Promise.all([
      writeFile(path.join(repoRoot, "apps", "web", "src", "app.tsx"), "export const App = () => <main>Astrograph</main>;\n"),
      writeFile(path.join(repoRoot, "services", "api", "src", "Program.cs"), "public class Program { public static string Greeting() => \"hello\"; }\n"),
      writeFile(path.join(repoRoot, "services", "worker", "src", "Worker.java"), "public class Worker { public String run() { return \"ok\"; } }\n"),
    ]);
    return repoRoot;
  }

  it("emits stable baseline JSON from the aggregate perf script", async () => {
    const repoRoot = await createFixtureRepo();
    const stdout = execFileSync(
      "node",
      [
        "--import=tsx",
        "./bench/scripts/perf.mjs",
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
    expect(result.query.metrics.queryCodeSourceP50Ms).toBeGreaterThanOrEqual(0);
    expect(result.query.metrics.queryCodeSourceP95Ms).toBeGreaterThanOrEqual(0);
  });

  it("emits stable cold and warm daemon metrics", async () => {
    const repoRoot = await createFixtureRepo();
    const stdout = execFileSync(
      "node",
      [
        "--import=tsx",
        "./bench/scripts/perf-daemon.mjs",
        "--repo",
        repoRoot,
        "--runs",
        "5",
      ],
      {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
      },
    );

    const result = JSON.parse(stdout);

    expect(result.schemaVersion).toBe("1.0");
    expect(result.sourceRepoRoot).toBe(repoRoot);
    expect(result.runs).toBe(5);
    expect(result.metrics.coldDaemonIndexMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.warmDaemonIndexP50Ms).toBeGreaterThanOrEqual(0);
    expect(result.metrics.warmDaemonIndexP95Ms).toBeGreaterThanOrEqual(0);
    expect(result.metrics.warmDaemonOutlineP50Ms).toBeGreaterThanOrEqual(0);
    expect(result.metrics.warmDaemonOutlineP95Ms).toBeGreaterThanOrEqual(0);
  });

  it("measures a representative frontend and backend monorepo fixture", async () => {
    const repoRoot = await createMonorepoFixture();
    const stdout = execFileSync(
      "node",
      ["--import=tsx", "./bench/scripts/perf-daemon.mjs", "--repo", repoRoot, "--runs", "5"],
      { cwd: new URL("..", import.meta.url), encoding: "utf8" },
    );
    const result = JSON.parse(stdout);

    expect(result.runs).toBe(5);
    expect(result.metrics.coldDaemonIndexMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.warmDaemonIndexP50Ms).toBeGreaterThanOrEqual(0);
    expect(result.metrics.warmDaemonOutlineP50Ms).toBeGreaterThanOrEqual(0);
  });

});
