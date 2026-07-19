import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  gitPathsReferToSameLocation,
  probeGitCheckout,
  type GitCheckoutCommandRunner,
} from "../src/git-checkout.ts";

function createRunner(responses: Record<string, string | Error>) {
  const calls: Parameters<GitCheckoutCommandRunner>[0][] = [];
  const runner: GitCheckoutCommandRunner = async (input) => {
    calls.push(input);
    const response = responses[input.args.join(" ")];
    if (response instanceof Error) {
      throw response;
    }
    if (response === undefined) {
      throw new Error(`Unexpected Git command: ${input.args.join(" ")}`);
    }
    return response;
  };
  return { runner, calls };
}

describe("Git checkout probing", () => {
  const gitCommands = {
    "rev-parse --show-toplevel": "/repo\n",
    "rev-parse HEAD": "abc123\n",
    "symbolic-ref --quiet --short HEAD": "main\n",
    "rev-parse --git-dir": ".git\n",
    "rev-parse --git-common-dir": ".git\n",
  };

  it("records named branches without using them as identity", async () => {
    const { runner, calls } = createRunner(gitCommands);

    const result = await probeGitCheckout({ repoRoot: "/repo", runner });

    expect(result).toEqual({
      mode: "git-branch",
      repoRoot: path.resolve("/repo"),
      headOid: "abc123",
      branchRef: "main",
      diagnostic: null,
    });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        args: ["rev-parse", "HEAD"],
        timeoutMs: 1_000,
        maxBuffer: 1_000_000,
      }),
    ]));
  });

  it("records detached HEAD and linked worktrees safely", async () => {
    const detached = createRunner({
      ...gitCommands,
      "symbolic-ref --quiet --short HEAD": new Error("detached HEAD"),
    });
    const worktree = createRunner({
      ...gitCommands,
      "rev-parse --git-dir": "/repo/.git/worktrees/feature\n",
      "rev-parse --git-common-dir": "/repo/.git\n",
    });

    await expect(probeGitCheckout({ repoRoot: "/repo", runner: detached.runner }))
      .resolves.toMatchObject({ mode: "git-detached", branchRef: null });
    await expect(probeGitCheckout({ repoRoot: "/repo", runner: worktree.runner }))
      .resolves.toMatchObject({ mode: "git-worktree", branchRef: "main" });
  });

  it("compares Windows Git directory paths with host-native case semantics", () => {
    expect(gitPathsReferToSameLocation(
      "C:\\Repos\\Astrograph",
      ".git",
      "c:\\repos\\astrograph\\.git",
      path.win32,
    )).toBe(true);
    expect(gitPathsReferToSameLocation(
      "C:\\Repos\\Astrograph",
      ".git\\worktrees\\feature",
      ".git",
      path.win32,
    )).toBe(false);
  });

  it("falls back for non-Git directories and unavailable Git", async () => {
    const nonGit = createRunner({
      "rev-parse --show-toplevel": Object.assign(new Error("not a git repository"), {
        code: 128,
      }),
    });
    const unavailable = createRunner({
      "rev-parse --show-toplevel": Object.assign(new Error("git missing"), {
        code: "ENOENT",
      }),
    });

    await expect(probeGitCheckout({ repoRoot: "/repo", runner: nonGit.runner }))
      .resolves.toMatchObject({ mode: "filesystem", headOid: null });
    await expect(probeGitCheckout({ repoRoot: "/repo", runner: unavailable.runner }))
      .resolves.toMatchObject({ mode: "git-unavailable", headOid: null });
  });
});
