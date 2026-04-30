export interface BenchmarkMachineInfo {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
}

export interface BenchmarkCorpusMetadata {
  schemaVersion: number;
  manifestPath: string;
  benchmark: string;
  repo: string;
  repoSha: string;
  tokenizer: string;
  taskCount: number;
}

export interface BenchmarkRepoSnapshot {
  repoSha: string | null;
  isDirty: boolean;
  statusLines: string[];
}

export interface BenchmarkCorpusMetadataInput
  extends Omit<BenchmarkCorpusMetadata, "taskCount"> {
  taskCount?: number;
}

export interface BenchmarkWorkflowDefinition {
  workflowId: string;
  label: string;
  description?: string;
}

export interface BenchmarkTaskTarget {
  kind: string;
  value: string;
  mode: string;
}

export interface BenchmarkTaskResult {
  taskId: string;
  query: string;
  workflowId: string;
  allowedPaths: string[];
  targets: BenchmarkTaskTarget[];
  baselineTokens: number;
  estimatedBaselineTokens?: number;
  retrievedTokens: number;
  estimatedRetrievedTokens?: number;
  tokenReductionPct: number;
  toolCalls: number;
  latencyMs: number;
  success: boolean;
  evidence: string[];
  rankedEvidence: string[];
  matches: BenchmarkTargetMatch[];
  metrics: BenchmarkTaskMetrics;
  notes: string[];
}

export interface BenchmarkTargetMatch {
  target: BenchmarkTaskTarget;
  matched: boolean;
  rank: number | null;
  evidence: string | null;
}

export interface BenchmarkTaskMetrics {
  targetCount: number;
  hitCount: number;
  recallPct: number;
  firstRelevantRank: number | null;
  reciprocalRank: number;
  precisionAt3: number;
  top1Hit: boolean;
  top3Hit: boolean;
}

export interface BenchmarkSummary {
  taskCount: number;
  workflowCount: number;
  successCount: number;
  failureCount: number;
  targetCount: number;
  hitCount: number;
  overallRecallPct: number;
  averageRecallPct: number;
  averageReciprocalRank: number;
  averagePrecisionAt3: number;
  top1HitCount: number;
  top3HitCount: number;
  baselineTokens: number;
  estimatedBaselineTokens?: number;
  retrievedTokens: number;
  estimatedRetrievedTokens?: number;
  tokenReductionPct: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  totalToolCalls: number;
  averageToolCalls: number;
}

export interface BenchmarkResults {
  schemaVersion: number;
  benchmarkName: string;
  benchmarkVersion: string;
  repoSha: string;
  engineVersion: string;
  tokenizer: string;
  approximateTokenizer?: string;
  runId: string;
  machine: BenchmarkMachineInfo;
  corpus: BenchmarkCorpusMetadata;
  workflows: BenchmarkWorkflowDefinition[];
  tasks: BenchmarkTaskResult[];
  summary: BenchmarkSummary;
}

export interface BenchmarkResultsInput {
  schemaVersion?: number;
  benchmarkName: string;
  benchmarkVersion: string;
  repoSha: string;
  engineVersion: string;
  tokenizer: string;
  approximateTokenizer?: string;
  runId: string;
  machine: BenchmarkMachineInfo;
  corpus: BenchmarkCorpusMetadataInput;
  workflows: readonly BenchmarkWorkflowDefinition[];
  tasks: readonly BenchmarkTaskResult[];
}

export interface BenchmarkTarget extends BenchmarkTaskTarget {}

export interface BenchmarkTaskCardFrontmatter {
  id: string;
  slice: string;
  query: string;
  workflowSet: readonly string[];
  allowedPaths: readonly string[];
  targets: readonly BenchmarkTarget[];
  successCriteria: readonly string[];
  alternateTargets?: readonly BenchmarkTarget[];
  notes?: string;
  excludedPaths?: readonly string[];
  expectedArtifacts?: readonly string[];
}

export interface BenchmarkCorpusManifestTask {
  id: string;
  path: string;
  slice: string;
  workflows: readonly string[];
  allowedPaths: readonly string[];
  targets: readonly BenchmarkTarget[];
}

export interface BenchmarkCorpusManifest {
  schemaVersion: 1;
  benchmark: string;
  repo: string;
  repoSha: string;
  tokenizer: string;
  tasks: readonly BenchmarkCorpusManifestTask[];
}

export interface BenchmarkTaskCard {
  path: string;
  frontmatter: BenchmarkTaskCardFrontmatter;
  body: string;
  manifest?: BenchmarkCorpusManifestTask;
}

export interface BenchmarkCorpusTask extends BenchmarkTaskCard {
  manifest: BenchmarkCorpusManifestTask;
}

export interface BenchmarkCorpus {
  manifestPath: string;
  manifest: BenchmarkCorpusManifest;
  tasks: readonly BenchmarkCorpusTask[];
}

export interface BenchmarkRunOptions {
  corpusPath: string;
  outputDir: string;
  repoRoot: string;
  taskId?: string;
  workflowId?: string;
  strict?: boolean;
}

export interface BenchmarkRunArtifacts {
  resultsPath: string;
  reportPath: string;
  corpusLockPath: string;
}

export interface BenchmarkRunOutcome {
  results: BenchmarkResults;
  artifacts: BenchmarkRunArtifacts;
}
