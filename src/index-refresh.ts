import type { IndexBackendConnection } from "./index-backend.ts";
import type { IndexSummary, SummaryStrategy } from "./types.ts";

export type RefreshedFileCounts = {
  indexedFiles: number;
  indexedSymbols: number;
};

export type RefreshFilePathInput = {
  repoRoot: string;
  filePath: string;
  summaryStrategy: SummaryStrategy;
  forceRefresh: boolean;
  maxFileBytes: number;
  maxSymbolsPerFile: number;
  workerPool: {
    enabled: boolean;
    maxWorkers: number;
  };
};

export type FinalizeRefreshInput = {
  db: IndexBackendConnection;
  repoRoot: string;
  indexedAt: string;
  summaryStrategy: SummaryStrategy;
};

export async function refreshFileSetWithDependents(input: {
  db: IndexBackendConnection;
  repoRoot: string;
  filePaths: string[];
  summaryStrategy: SummaryStrategy;
  forceRefresh: boolean;
  maxFileBytes: number;
  maxSymbolsPerFile: number;
  workerPool: {
    enabled: boolean;
    maxWorkers: number;
  };
  loadDirectImporterPaths(
    db: IndexBackendConnection,
    targetPath: string,
  ): string[];
  refreshFilePath(
    db: IndexBackendConnection,
    input: RefreshFilePathInput,
  ): Promise<RefreshedFileCounts>;
  finalizeIndex(input: FinalizeRefreshInput): Promise<IndexSummary["staleStatus"]>;
}): Promise<IndexSummary> {
  const changedPaths = [...input.filePaths];
  const changedPathSet = new Set(changedPaths);
  const dependentPaths = new Set<string>();
  let indexedFiles = 0;
  let indexedSymbols = 0;

  for (const filePath of changedPaths) {
    for (const importerPath of input.loadDirectImporterPaths(input.db, filePath)) {
      if (!changedPathSet.has(importerPath) && importerPath !== filePath) {
        dependentPaths.add(importerPath);
      }
    }

    const result = await input.refreshFilePath(input.db, {
      repoRoot: input.repoRoot,
      filePath,
      summaryStrategy: input.summaryStrategy,
      forceRefresh: input.forceRefresh,
      maxFileBytes: input.maxFileBytes,
      maxSymbolsPerFile: input.maxSymbolsPerFile,
      workerPool: input.workerPool,
    });
    indexedFiles += result.indexedFiles;
    indexedSymbols += result.indexedSymbols;
  }

  for (const dependentPath of [...dependentPaths].sort()) {
    const result = await input.refreshFilePath(input.db, {
      repoRoot: input.repoRoot,
      filePath: dependentPath,
      summaryStrategy: input.summaryStrategy,
      forceRefresh: true,
      maxFileBytes: input.maxFileBytes,
      maxSymbolsPerFile: input.maxSymbolsPerFile,
      workerPool: input.workerPool,
    });
    indexedFiles += result.indexedFiles;
    indexedSymbols += result.indexedSymbols;
  }

  const staleStatus = await input.finalizeIndex({
    db: input.db,
    repoRoot: input.repoRoot,
    indexedAt: new Date().toISOString(),
    summaryStrategy: input.summaryStrategy,
  });

  return {
    indexedFiles,
    indexedSymbols,
    staleStatus,
  };
}
