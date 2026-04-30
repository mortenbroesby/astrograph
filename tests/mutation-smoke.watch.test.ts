import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it as baseIt } from "vitest";

import { diagnostics, searchSymbols, watchFolder } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

const mutationSmokeIt =
  process.env.ASTROGRAPH_ENABLE_MUTATION_SMOKE_TESTS === "1"
    ? baseIt
    : baseIt.skip;

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

describe("mutation smoke watch boundaries", () => {
  mutationSmokeIt("removes deleted files during watch refresh", async () => {
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

  mutationSmokeIt("removes symbols when a watched source file is renamed away", async () => {
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

  mutationSmokeIt("refreshes changed files instead of treating them as deletions", async () => {
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
