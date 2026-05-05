#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".cjs",
  ".mjs",
]);
const STRUCTURAL_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "astrograph.config.ts",
  "astrograph.config.json",
]);
const MAX_INCREMENTAL_FILES = 12;

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const wrapperPath = path.join(packageRoot, "dist", "astrograph.js");
const sourceWrapperPath = path.join(packageRoot, "src", "astrograph.ts");
const wrapperArgs = existsSync(wrapperPath)
  ? [wrapperPath]
  : ["--experimental-strip-types", sourceWrapperPath];

interface GitCommandResult {
  status: number;
  stdout: string;
}

interface NameStatusEntry {
  status: string;
  filePath: string;
}

interface TriggerIndexFolderDiff {
  mode: "index-folder";
  reason?: string;
  filePaths: string[];
}

interface TriggerDiffEntries {
  mode: "diff";
  entries: NameStatusEntry[];
}

type TriggerDiff = TriggerIndexFolderDiff | TriggerDiffEntries;

interface IndexFolderPlan {
  mode: "index-folder";
  reason?: string;
  filePaths: string[];
}

interface IndexFilesPlan {
  mode: "index-files";
  reason: string;
  filePaths: string[];
}

type RefreshPlan = IndexFolderPlan | IndexFilesPlan;

interface ParsedArgs {
  execute: boolean;
  trigger: string;
  extra: string[];
}

function runGit(args: string[], cwd: string): GitCommandResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
  };
}

function resolveRepoRoot(cwd: string): string {
  const result = runGit(["rev-parse", "--show-toplevel"], cwd);
  if (result.status !== 0) {
    return cwd;
  }
  return result.stdout.trim() || cwd;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const execute = args.includes("--execute");
  const filtered = args.filter((value) => value !== "--execute");
  const trigger = filtered[0] ?? "manual";
  return {
    execute,
    trigger,
    extra: filtered.slice(1),
  };
}

function parseNameStatus(output: string): NameStatusEntry[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const status = parts[0] ?? "";
      const filePath = parts.at(-1) ?? "";
      return { status, filePath };
    });
}

function isSupportedSourceFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isStructuralFile(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  const base = path.posix.basename(normalized);
  return (
    STRUCTURAL_FILES.has(base)
    || /^tsconfig(\..+)?\.json$/i.test(base)
  );
}

function diffForTrigger(repoRoot: string, trigger: string, extra: readonly string[]): TriggerDiff {
  if (trigger === "manual") {
    return {
      mode: "index-folder",
      reason: "manual refresh requested",
      filePaths: [],
    };
  }

  if (trigger === "commit") {
    const result = runGit(
      ["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "HEAD"],
      repoRoot,
    );
    return {
      mode: "diff",
      entries: parseNameStatus(result.stdout),
    };
  }

  if (trigger === "checkout") {
    const [previousHead, nextHead] = extra;
    if (!previousHead || !nextHead) {
      return { mode: "diff", entries: [] };
    }
    const result = runGit(
      ["diff", "--name-status", previousHead, nextHead],
      repoRoot,
    );
    return {
      mode: "diff",
      entries: parseNameStatus(result.stdout),
    };
  }

  if (trigger === "merge") {
    const probe = runGit(["rev-parse", "--verify", "ORIG_HEAD"], repoRoot);
    if (probe.status !== 0) {
      return { mode: "diff", entries: [] };
    }
    const result = runGit(
      ["diff", "--name-status", "ORIG_HEAD", "HEAD"],
      repoRoot,
    );
    return {
      mode: "diff",
      entries: parseNameStatus(result.stdout),
    };
  }

  if (trigger === "push") {
    const probe = runGit(
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{push}"],
      repoRoot,
    );
    if (probe.status !== 0) {
      return {
        mode: "index-folder",
        reason: "push refresh without upstream baseline",
        filePaths: [],
      };
    }

    const result = runGit(
      ["diff", "--name-status", "@{push}..HEAD"],
      repoRoot,
    );
    return {
      mode: "diff",
      entries: parseNameStatus(result.stdout),
    };
  }

  return {
    mode: "index-folder",
    reason: `fallback refresh for trigger ${trigger}`,
    filePaths: [],
  };
}

function buildRefreshPlan(
  repoRoot: string,
  trigger: string,
  extra: readonly string[],
): RefreshPlan | null {
  const diff = diffForTrigger(repoRoot, trigger, extra);
  if (diff.mode === "index-folder") {
    return {
      mode: "index-folder",
      reason: diff.reason,
      filePaths: [],
    };
  }

  const incremental = new Set<string>();

  for (const entry of diff.entries) {
    if (!entry.filePath) {
      continue;
    }

    if (isStructuralFile(entry.filePath)) {
      return {
        mode: "index-folder",
        reason: `structural file changed: ${entry.filePath}`,
        filePaths: [],
      };
    }

    if (!isSupportedSourceFile(entry.filePath)) {
      continue;
    }

    if (entry.status.startsWith("D")) {
      return {
        mode: "index-folder",
        reason: `source file deleted: ${entry.filePath}`,
        filePaths: [],
      };
    }

    if (entry.status.startsWith("R")) {
      return {
        mode: "index-folder",
        reason: `source file renamed: ${entry.filePath}`,
        filePaths: [],
      };
    }

    incremental.add(entry.filePath);
  }

  const filePaths = [...incremental].sort();
  if (filePaths.length === 0) {
    return null;
  }

  if (filePaths.length > MAX_INCREMENTAL_FILES) {
    return {
      mode: "index-folder",
      reason: `${filePaths.length} source files changed`,
      filePaths: [],
    };
  }

  return {
    mode: "index-files",
    reason: `${filePaths.length} supported source files changed`,
    filePaths,
  };
}

function runChild(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`astrograph refresh child exited with code ${code ?? "unknown"}`));
    });
  });
}

function spawnAstrographCli(
  repoRoot: string,
  args: readonly string[],
): ReturnType<typeof spawn> {
  return spawn(
    process.execPath,
    [...wrapperArgs, "cli", ...args],
    {
      cwd: repoRoot,
      stdio: "inherit",
    },
  );
}

async function executePlan(repoRoot: string, plan: RefreshPlan | null): Promise<void> {
  if (!plan) {
    return;
  }

  if (plan.mode === "index-folder") {
    await runChild(
      spawnAstrographCli(repoRoot, [
        "index-folder",
        "--repo",
        repoRoot,
      ]),
    );
    return;
  }

  for (const filePath of plan.filePaths) {
    try {
      await runChild(
        spawnAstrographCli(repoRoot, [
          "index-file",
          "--repo",
          repoRoot,
          "--file",
          filePath,
        ]),
      );
    } catch {
      await runChild(
        spawnAstrographCli(repoRoot, [
          "index-folder",
          "--repo",
          repoRoot,
        ]),
      );
      return;
    }
  }
}

async function main(): Promise<void> {
  const { execute, trigger, extra } = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot(process.cwd());

  if (!execute) {
    const storageDir = path.join(repoRoot, ".astrograph");
    const logPath = path.join(storageDir, "git-refresh.log");
    await mkdir(storageDir, { recursive: true });
    const stdoutFd = openSync(logPath, "a");
    const stderrFd = openSync(logPath, "a");

    try {
      const child = spawn(
        process.execPath,
        [scriptPath, "--execute", trigger, ...extra],
        {
          cwd: repoRoot,
          detached: true,
          stdio: ["ignore", stdoutFd, stderrFd],
        },
      );
      child.unref();
    } finally {
      closeSync(stdoutFd);
      closeSync(stderrFd);
    }
    return;
  }

  const plan = buildRefreshPlan(repoRoot, trigger, extra);
  if (!plan) {
    process.stdout.write(`[astrograph-refresh] ${trigger}: no relevant source changes\n`);
    return;
  }

  process.stdout.write(
    `[astrograph-refresh] ${trigger}: ${plan.mode} (${plan.reason ?? "n/a"})\n`,
  );
  await executePlan(repoRoot, plan);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
