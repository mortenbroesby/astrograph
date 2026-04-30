import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
}

export function createBenchmarkFixtureRepo(options: {
  includeOutOfScopeDuplicate?: boolean;
} = {}): BenchmarkFixtureRepo {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "aice-bench-"));
  const corpusSourceDir = benchmarkFixtureRoot;
  const corpusTargetDir = path.join(repoRoot, ".specs", "benchmarks");

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
  const manifest = JSON.parse(readFileSync(path.join(
    repoRoot,
    ".specs",
    "benchmarks",
    "ai-context-engine-benchmark-corpus.json",
  ), "utf8")) as { repoSha: string };
  manifest.repoSha = repoSha;
  writeFileSync(
    path.join(
      repoRoot,
      ".specs",
      "benchmarks",
      "ai-context-engine-benchmark-corpus.json",
    ),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  execFileSync("git", ["add", ".specs/benchmarks/ai-context-engine-benchmark-corpus.json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync("git", ["commit", "--amend", "--no-edit"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const amendedRepoSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  manifest.repoSha = amendedRepoSha;
  writeFileSync(
    path.join(
      repoRoot,
      ".specs",
      "benchmarks",
      "ai-context-engine-benchmark-corpus.json",
    ),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  execFileSync("git", ["add", ".specs/benchmarks/ai-context-engine-benchmark-corpus.json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync("git", ["commit", "--amend", "--no-edit"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const finalRepoSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  return {
    repoRoot,
    corpusPath: path.join(
      repoRoot,
      ".specs",
      "benchmarks",
      "ai-context-engine-benchmark-corpus.json",
    ),
    repoSha: finalRepoSha,
  };
}
