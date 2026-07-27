import { resolveEngineRepoRoot } from "./config.ts";
import { watchFolderAfterIndex } from "./storage.ts";
import type { IndexSummary, SummaryStrategy, WatchHandle } from "./types.ts";

export interface DaemonTenantManager {
  runForRepository<T>(repoRoot: string, task: () => Promise<T>): Promise<T>;
  watchIndexedRepository(input: { repoRoot: string; summaryStrategy?: SummaryStrategy }, summary: IndexSummary): Promise<void>;
  close(): Promise<void>;
}

export function createDaemonTenantManager(
  options: {
    startWatch?: typeof watchFolderAfterIndex;
    canonicalize?: (repoRoot: string) => Promise<string>;
  } = {},
): DaemonTenantManager {
  const startWatch = options.startWatch ?? watchFolderAfterIndex;
  const canonicalize = options.canonicalize ?? resolveEngineRepoRoot;
  const watches = new Map<string, WatchHandle>();
  const queues = new Map<string, Promise<void>>();

  return {
    async runForRepository<T>(repoRoot: string, task: () => Promise<T>): Promise<T> {
      const canonicalRepoRoot = await canonicalize(repoRoot);
      const previous = queues.get(canonicalRepoRoot) ?? Promise.resolve();
      const result = previous.catch(() => undefined).then(task);
      const completion = result.then(() => undefined, () => undefined);
      queues.set(canonicalRepoRoot, completion);
      try {
        return await result;
      } finally {
        if (queues.get(canonicalRepoRoot) === completion) {
          queues.delete(canonicalRepoRoot);
        }
      }
    },
    async watchIndexedRepository(input, summary) {
      const repoRoot = await canonicalize(input.repoRoot);
      if (watches.has(repoRoot)) {
        return;
      }
      const watch = await startWatch({
        repoRoot,
        summaryStrategy: input.summaryStrategy,
      }, summary);
      watches.set(repoRoot, watch);
    },
    async close() {
      const handles = [...watches.values()];
      watches.clear();
      queues.clear();
      await Promise.all(handles.map((watch) => watch.close()));
    },
  };
}
