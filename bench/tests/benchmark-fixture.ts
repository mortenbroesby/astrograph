import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));

export const workspaceRoot = path.resolve(testsDir, "..", "..");
const benchmarkFixtureRoot = path.join(testsDir, "fixtures", "benchmarks");

export interface BenchmarkFixtureRepo {
  repoRoot: string;
  corpusPath: string;
  repoSha: string;
  cleanup(): void;
}

export function createBenchmarkFixtureRepo(options: {
  includeOutOfScopeDuplicate?: boolean;
} = {}): BenchmarkFixtureRepo {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "aice-bench-"));
  const repoRoot = path.join(fixtureRoot, "repo");
  const corpusSourceDir = benchmarkFixtureRoot;
  const corpusTargetDir = path.join(fixtureRoot, "corpus");

  cpSync(corpusSourceDir, corpusTargetDir, { recursive: true });
  mkdirSync(path.join(repoRoot, "bench", "src"), {
    recursive: true,
  });
  writeFileSync(
    path.join(repoRoot, "bench", "src", "corpus.ts"),
    `export function loadBenchmarkCorpus(): string {
  return "loaded";
}
`,
  );
  if (options.includeOutOfScopeDuplicate) {
    writeFileSync(
      path.join(repoRoot, "bench", "src", "a-outside.ts"),
      `export function loadBenchmarkCorpus(): string {
  return "outside";
}
`,
    );
  }
  execFileSync("git", ["init"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync("git", ["config", "user.email", "bench@example.com"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync("git", ["config", "user.name", "Benchmark Fixture"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync("git", ["add", "."], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync("git", ["commit", "-m", "fixture"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const repoSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const manifestPath = path.join(
    corpusTargetDir,
    "ai-context-engine-benchmark-corpus.json",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    repoSha: string;
  };
  manifest.repoSha = repoSha;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    repoRoot,
    corpusPath: manifestPath,
    repoSha,
    cleanup() {
      rmSync(fixtureRoot, { recursive: true, force: true });
    },
  };
}
