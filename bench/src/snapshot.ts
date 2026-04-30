import { execFileSync } from "node:child_process";

export interface BenchmarkRepoSnapshot {
  repoSha: string | null;
  isDirty: boolean;
  statusLines: string[];
}

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trimEnd();
}

export function getRepoSnapshot(repoRoot: string): BenchmarkRepoSnapshot {
  try {
    const repoSha = runGit(repoRoot, ["rev-parse", "HEAD"]).trim();
    const statusOutput = runGit(repoRoot, ["status", "--short"]);
    const statusLines = statusOutput
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean);

    return {
      repoSha,
      isDirty: statusLines.length > 0,
      statusLines,
    };
  } catch {
    return {
      repoSha: null,
      isDirty: false,
      statusLines: [],
    };
  }
}

export function assertStrictSnapshot(
  snapshot: BenchmarkRepoSnapshot,
  expectedRepoSha: string,
) {
  if (!snapshot.repoSha) {
    throw new Error(
      "Strict benchmark mode requires a git checkout with a readable HEAD commit.",
    );
  }

  if (snapshot.isDirty) {
    throw new Error(
      [
        "Strict benchmark mode requires a clean checkout.",
        ...snapshot.statusLines.map((line) => `- ${line}`),
      ].join("\n"),
    );
  }

  if (snapshot.repoSha !== expectedRepoSha) {
    throw new Error(
      `Strict benchmark mode requires repo SHA ${expectedRepoSha}, but checkout is ${snapshot.repoSha}.`,
    );
  }
}
