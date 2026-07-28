import { describe, expect, it } from "vitest";

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
});
