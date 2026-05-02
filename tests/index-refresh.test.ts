import { describe, expect, it } from "vitest";

import { refreshFileSetWithDependents } from "../src/index-refresh.ts";
import type { IndexBackendConnection } from "../src/index-backend.ts";

describe("refreshFileSetWithDependents", () => {
  it("refreshes changed files and direct importers with shared accounting", async () => {
    const db = {} as IndexBackendConnection;
    const refreshed: Array<{ filePath: string; forceRefresh: boolean }> = [];
    const finalized: Array<{ indexedAt: string; summaryStrategy: string }> = [];

    const summary = await refreshFileSetWithDependents({
      db,
      repoRoot: "/repo",
      filePaths: ["src/formatters.ts", "src/other.ts"],
      summaryStrategy: "doc-comments-first",
      forceRefresh: false,
      maxFileBytes: 10_000,
      maxSymbolsPerFile: 100,
      workerPool: {
        enabled: false,
        maxWorkers: 1,
      },
      loadDirectImporterPaths(_db, targetPath) {
        if (targetPath === "src/formatters.ts") {
          return ["src/consumer.ts", "src/formatters.ts", "src/other.ts"];
        }
        return [];
      },
      async refreshFilePath(_db, input) {
        refreshed.push({
          filePath: input.filePath,
          forceRefresh: input.forceRefresh,
        });
        return {
          indexedFiles: 1,
          indexedSymbols: input.filePath === "src/consumer.ts" ? 2 : 1,
        };
      },
      async finalizeIndex(input) {
        finalized.push({
          indexedAt: input.indexedAt,
          summaryStrategy: input.summaryStrategy,
        });
        return "fresh";
      },
    });

    expect(refreshed).toEqual([
      { filePath: "src/formatters.ts", forceRefresh: false },
      { filePath: "src/other.ts", forceRefresh: false },
      { filePath: "src/consumer.ts", forceRefresh: true },
    ]);
    expect(finalized).toHaveLength(1);
    expect(finalized[0]?.indexedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
    expect(summary).toEqual({
      indexedFiles: 3,
      indexedSymbols: 4,
      staleStatus: "fresh",
    });
  });
});
