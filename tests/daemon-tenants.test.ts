import { describe, expect, it } from "vitest";

import { createDaemonTenantManager } from "../src/daemon-tenants.ts";

describe("daemon tenants", () => {
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
