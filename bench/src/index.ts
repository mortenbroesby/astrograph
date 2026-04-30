export {
  loadBenchmarkCorpus,
  loadBenchmarkCorpusManifest,
  loadBenchmarkTaskCard,
} from "./corpus.ts";
export { runBenchmark } from "./runner.ts";
export {
  WORKFLOWS,
  computeBaselineForTask,
  getWorkflowDefinition,
  runWorkflowTask,
} from "./workflows.ts";
export {
  APPROXIMATE_BENCHMARK_TOKENIZER,
  BENCHMARK_TOKENIZER,
  countTokens,
  disposeTokenizer,
  estimateTokens,
} from "./tokenizer.ts";
export {
  assertStrictSnapshot,
  getRepoSnapshot,
} from "./snapshot.ts";

export type {
  BenchmarkCorpus,
  BenchmarkCorpusManifest,
  BenchmarkCorpusManifestTask,
  BenchmarkCorpusTask,
  BenchmarkTarget,
  BenchmarkTaskCard,
  BenchmarkTaskCardFrontmatter,
  BenchmarkRunOptions,
  BenchmarkRunOutcome,
} from "./types.ts";

export * from "./report.ts";
export * from "./types.ts";

export interface BenchmarkHarnessScaffold {
  ownerPackage: "astrograph";
  workspacePath: "bench";
}

export const BENCHMARK_HARNESS_SCAFFOLD: BenchmarkHarnessScaffold = {
  ownerPackage: "astrograph",
  workspacePath: "bench",
};
