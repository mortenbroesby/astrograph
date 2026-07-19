import { execFile as execFileCallback } from "node:child_process";
import { realpath } from "node:fs/promises";
import path, { type PlatformPath } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const DEFAULT_GIT_CHECKOUT_PROBE_TIMEOUT_MS = 1_000;
export const DEFAULT_GIT_CHECKOUT_PROBE_MAX_BUFFER = 1_000_000;

export type GitCheckoutMode =
  | "git-branch"
  | "git-detached"
  | "git-worktree"
  | "filesystem"
  | "git-unavailable";

export interface GitCheckoutProbeResult {
  mode: GitCheckoutMode;
  repoRoot: string;
  headOid: string | null;
  branchRef: string | null;
  diagnostic: string | null;
}

export interface GitCheckoutCommandInput {
  cwd: string;
  args: string[];
  timeoutMs: number;
  maxBuffer: number;
}

export type GitCheckoutCommandRunner = (
  input: GitCheckoutCommandInput,
) => Promise<string>;

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isGitUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; killed?: unknown };
  return candidate.code === "ENOENT" || candidate.killed === true;
}

function normalizeOutput(value: string): string {
  return value.trim();
}

function resolveGitPath(
  cwd: string,
  gitPath: string,
  pathApi: PlatformPath = path,
): string {
  return pathApi.resolve(cwd, normalizeOutput(gitPath));
}

export function gitPathsReferToSameLocation(
  cwd: string,
  left: string,
  right: string,
  pathApi: PlatformPath = path,
): boolean {
  return pathApi.relative(
    resolveGitPath(cwd, left, pathApi),
    resolveGitPath(cwd, right, pathApi),
  ) === "";
}

const runGitCheckoutCommand: GitCheckoutCommandRunner = async (input) => {
  const { stdout } = await execFile("git", input.args, {
    cwd: input.cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: input.timeoutMs,
    maxBuffer: input.maxBuffer,
  });
  return stdout;
};

export async function probeGitCheckout(input: {
  repoRoot: string;
  runner?: GitCheckoutCommandRunner;
  timeoutMs?: number;
  maxBuffer?: number;
}): Promise<GitCheckoutProbeResult> {
  const repoRoot = await realpath(path.resolve(input.repoRoot)).catch(
    () => path.resolve(input.repoRoot),
  );
  const runner = input.runner ?? runGitCheckoutCommand;
  const timeoutMs = input.timeoutMs ?? DEFAULT_GIT_CHECKOUT_PROBE_TIMEOUT_MS;
  const maxBuffer = input.maxBuffer ?? DEFAULT_GIT_CHECKOUT_PROBE_MAX_BUFFER;
  const run = (cwd: string, args: string[]) => runner({
    cwd,
    args,
    timeoutMs,
    maxBuffer,
  });

  let worktreeRoot: string;
  try {
    worktreeRoot = await realpath(normalizeOutput(await run(repoRoot, [
      "rev-parse",
      "--show-toplevel",
    ]))).catch(() => normalizeOutput(repoRoot));
  } catch (error) {
    return {
      mode: isGitUnavailable(error) ? "git-unavailable" : "filesystem",
      repoRoot,
      headOid: null,
      branchRef: null,
      diagnostic: formatError(error),
    };
  }

  try {
    const headOid = normalizeOutput(await run(worktreeRoot, ["rev-parse", "HEAD"]));
    const branchRef = await run(worktreeRoot, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD",
    ]).then(normalizeOutput).catch(() => null);
    const [gitDir, commonGitDir] = await Promise.all([
      run(worktreeRoot, ["rev-parse", "--git-dir"]),
      run(worktreeRoot, ["rev-parse", "--git-common-dir"]),
    ]);
    const linkedWorktree = !gitPathsReferToSameLocation(
      worktreeRoot,
      gitDir,
      commonGitDir,
    );

    return {
      mode: linkedWorktree
        ? "git-worktree"
        : branchRef === null
          ? "git-detached"
          : "git-branch",
      repoRoot: worktreeRoot,
      headOid,
      branchRef,
      diagnostic: null,
    };
  } catch (error) {
    return {
      mode: "git-unavailable",
      repoRoot: worktreeRoot,
      headOid: null,
      branchRef: null,
      diagnostic: formatError(error),
    };
  }
}
