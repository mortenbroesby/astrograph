import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import { clearStorageProcessCaches, diagnostics, searchSymbols, watchFolder } from "../src/index.ts";
import { resolveEnginePaths } from "../src/config.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 4000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for watch refresh");
    }
    await delay(20);
  }
}

describe("watch boundaries", () => {
  it("keeps watch refresh and diagnostics in the selected global cache", async () => {
    const repoRoot = await createFixtureRepo();
    const cacheHome = await mkdtemp(path.join(os.tmpdir(), "astrograph-global-watch-"));
    const previousCacheHome = process.env.ASTROGRAPH_CACHE_HOME;
    process.env.ASTROGRAPH_CACHE_HOME = cacheHome;
    await writeFile(path.join(repoRoot, "astrograph.config.json"), JSON.stringify({ storageLocation: "global" }));
    const events: string[][] = [];
    const watcher = await watchFolder({
      repoRoot,
      debounceMs: 50,
      onEvent(event) {
        if (event.type === "reindex") events.push(event.changedPaths);
      },
    });
    try {
      await writeFile(path.join(repoRoot, "src", "watched-global.ts"), "export const watchedGlobal = true;\n");
      await waitFor(() => events.length >= 1);
      const health = await diagnostics({ repoRoot });
      const paths = resolveEnginePaths(repoRoot, { storageLocation: "global" });
      expect(health.storageDir).toBe(paths.storageDir);
      expect(events.flat()).toContain("src/watched-global.ts");
      expect((await searchSymbols({ repoRoot, query: "watchedGlobal" })).map((entry) => entry.name)).toContain("watchedGlobal");
    } finally {
      await watcher.close();
      clearStorageProcessCaches();
      if (previousCacheHome === undefined) delete process.env.ASTROGRAPH_CACHE_HOME;
      else process.env.ASTROGRAPH_CACHE_HOME = previousCacheHome;
      await rm(cacheHome, { recursive: true, force: true });
    }
  }, 10000);

  it("removes deleted files during watch refresh", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{ changedPaths: string[]; indexedFiles?: number }> = [];

    const watcher = await watchFolder({
      repoRoot,
      debounceMs: 50,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
            indexedFiles: event.summary?.indexedFiles,
          });
        }
      },
    });

    try {
      await rm(path.join(repoRoot, "src", "math.ts"));
      await waitFor(() => reindexEvents.length >= 1);

      expect(await searchSymbols({ repoRoot, query: "PI" })).toHaveLength(0);
      expect(await diagnostics({ repoRoot })).toMatchObject({
        indexedFiles: 1,
        currentFiles: 1,
        staleStatus: "fresh",
      });
      expect(reindexEvents).toHaveLength(1);
      expect(reindexEvents[0]?.changedPaths).toContain("src/math.ts");
      expect(reindexEvents[0]?.indexedFiles).toBe(1);
    } finally {
      await watcher.close();
    }
  }, 10000);

  it("removes symbols when a watched source file is renamed away", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{ changedPaths: string[]; indexedFiles?: number }> = [];

    const watcher = await watchFolder({
      repoRoot,
      debounceMs: 50,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
            indexedFiles: event.summary?.indexedFiles,
          });
        }
      },
    });

    try {
      await rename(
        path.join(repoRoot, "src", "math.ts"),
        path.join(repoRoot, "src", "math.txt"),
      );
      await waitFor(() => reindexEvents.length >= 1);

      expect(reindexEvents).toHaveLength(1);
      expect(reindexEvents[0]?.changedPaths).toContain("src/math.ts");
      expect(reindexEvents[0]?.indexedFiles).toBe(1);
      expect(await diagnostics({ repoRoot })).toMatchObject({
        indexedFiles: 1,
        staleStatus: "fresh",
      });
      expect(await searchSymbols({ repoRoot, query: "PI" })).toHaveLength(0);
    } finally {
      await watcher.close();
    }
  }, 10000);

  it("refreshes changed files instead of treating them as deletions", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{ changedPaths: string[]; indexedFiles?: number }> = [];

    const watcher = await watchFolder({
      repoRoot,
      debounceMs: 50,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
            indexedFiles: event.summary?.indexedFiles,
          });
        }
      },
    });

    try {
      await writeFile(
        path.join(repoRoot, "src", "math.ts"),
        `import { formatLabel } from "./strings.js";

export const PI = 3.14;

/** Calculate the circle area label. */
export function area(radius: number): string {
  const value = PI * radius * radius;
  return formatLabel(value);
}

export function circumference(radius: number): string {
  return formatLabel(2 * PI * radius);
}
`,
      );
      await waitFor(() => reindexEvents.length >= 1);

      expect(reindexEvents).toHaveLength(1);
      expect(reindexEvents[0]?.changedPaths).toContain("src/math.ts");
      expect(reindexEvents[0]?.indexedFiles).toBe(1);
      expect(await searchSymbols({ repoRoot, query: "circumference" })).toHaveLength(1);
      expect(
        (
          await searchSymbols({ repoRoot, query: "area" })
        ).some((entry) => entry.filePath === "src/math.ts"),
      ).toBe(true);
      expect(await diagnostics({ repoRoot })).toMatchObject({
        indexedFiles: 2,
        staleStatus: "fresh",
      });
    } finally {
      await watcher.close();
    }
  }, 10000);
});
