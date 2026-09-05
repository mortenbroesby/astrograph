import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveEnginePaths } from "../src/config.ts";
import { createDaemonTenantManager } from "../src/daemon-tenants.ts";

describe("daemon tenants", () => {
  it("serializes canonical aliases and releases the queue after failure", async () => {
    const tenants = createDaemonTenantManager({
      canonicalize: async (repoRoot) => repoRoot === "/repo/link" ? "/repo" : repoRoot,
    });
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const allowFirstToFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let signalFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    const first = tenants.runForRepository("/repo", async () => {
      events.push("first");
      signalFirstStarted?.();
      await allowFirstToFinish;
    });
    const second = tenants.runForRepository("/repo/link", async () => {
      events.push("second");
      throw new Error("expected");
    });
    const third = tenants.runForRepository("/repo", async () => {
      events.push("third");
      return "recovered";
    });

    await firstStarted;
    expect(events).toEqual(["first"]);
    releaseFirst?.();
    await first;
    await expect(second).rejects.toThrow("expected");
    await expect(third).resolves.toBe("recovered");
    expect(events).toEqual(["first", "second", "third"]);
  });

  it("does not block separate repositories", async () => {
    const tenants = createDaemonTenantManager({ canonicalize: async (repoRoot) => repoRoot });
    const events: string[] = [];
    await Promise.all([
      tenants.runForRepository("/one", async () => { events.push("one"); }),
      tenants.runForRepository("/two", async () => { events.push("two"); }),
    ]);
    expect(events.sort()).toEqual(["one", "two"]);
  });

  it("owns one watcher per canonical repository and closes every watcher", async () => {
    let starts = 0;
    let closes = 0;
    const tenants = createDaemonTenantManager({
      canonicalize: async (repoRoot) => repoRoot === "/repo/link" ? "/repo" : repoRoot,
      startWatch: async () => {
        starts += 1;
        return { close: async () => { closes += 1; } };
      },
    });
    const summary = {
      indexedFiles: 1,
      indexedSymbols: 1,
      reusedFiles: 0,
      parsedFiles: 1,
      removedFiles: 0,
      staleStatus: "fresh" as const,
    };

    await tenants.watchIndexedRepository({ repoRoot: "/repo", summaryStrategy: "doc-comments-first" }, summary);
    await tenants.watchIndexedRepository({ repoRoot: "/repo/link", summaryStrategy: "doc-comments-first" }, summary);
    expect(starts).toBe(1);

    await tenants.close();
    await tenants.close();
    expect(closes).toBe(1);
  });

  it("keeps aliases together and linked worktrees plus other repositories distinct", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "astrograph-daemon-tenants-"));
    const primary = path.join(root, "primary");
    const linked = path.join(root, "linked");
    const alias = path.join(root, "primary-alias");
    const separate = path.join(root, "separate");
    const runGit = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
    try {
      execFileSync("git", ["init", primary], { stdio: "ignore" });
      await writeFile(path.join(primary, "index.ts"), "export const primary = true;\n");
      runGit(primary, ["add", "index.ts"]);
      runGit(primary, ["-c", "user.name=Astrograph Test", "-c", "user.email=astrograph@example.invalid", "commit", "-m", "initial"]);
      runGit(primary, ["worktree", "add", "-b", "linked-test", linked]);
      await symlink(primary, alias, "dir");

      execFileSync("git", ["init", separate], { stdio: "ignore" });
      await writeFile(path.join(separate, "index.ts"), "export const separate = true;\n");
      runGit(separate, ["add", "index.ts"]);
      runGit(separate, ["-c", "user.name=Astrograph Test", "-c", "user.email=astrograph@example.invalid", "commit", "-m", "initial"]);

      const watchedRoots: string[] = [];
      const tenants = createDaemonTenantManager({
        startWatch: async ({ repoRoot }) => {
          watchedRoots.push(repoRoot);
          return { close: async () => {} };
        },
      });
      const summary = {
        indexedFiles: 1,
        indexedSymbols: 1,
        reusedFiles: 0,
        parsedFiles: 1,
        removedFiles: 0,
        staleStatus: "fresh" as const,
      };
      for (const repoRoot of [primary, alias, linked, separate]) {
        await tenants.watchIndexedRepository({ repoRoot }, summary);
      }

      expect(watchedRoots).toEqual([await realpath(primary), await realpath(linked), await realpath(separate)]);
      const environment = {
        platform: "linux" as const,
        env: { XDG_CACHE_HOME: path.join(root, "cache") },
        homeDir: () => root,
      };
      const storage = [primary, alias, linked, separate].map((repoRoot) =>
        resolveEnginePaths(repoRoot, { storageLocation: "global", environment }).storageDir,
      );
      expect(storage[0]).toBe(storage[1]);
      expect(new Set([storage[0], storage[2], storage[3]]).size).toBe(3);
      await tenants.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
