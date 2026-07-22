import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { TOKENIZER_RESEARCH_CORPUS } from "../tests/fixtures/tokenizer-research-corpus.ts";

export const TOKENIZER_RESEARCH_CANDIDATES = [
  "tiktoken-cl100k",
  "gpt-tokenizer-cl100k",
  "js-tiktoken-cl100k",
  "tokenx-estimate",
] as const;

export type TokenizerResearchCandidate = (typeof TOKENIZER_RESEARCH_CANDIDATES)[number];

export interface TokenizerResearchCandidateResult {
  candidate: TokenizerResearchCandidate;
  counts: Record<string, number>;
  warmLatencyMs: { median: number; p95: number };
  rssDeltaBytes: number;
}

export interface TokenizerResearchResults {
  corpusCaseIds: readonly string[];
  candidates: readonly TokenizerResearchCandidateResult[];
}

type Counter = (value: string) => number;

function percentile(values: readonly number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentileValue))] ?? 0;
}

async function loadCounter(candidate: TokenizerResearchCandidate): Promise<Counter> {
  switch (candidate) {
    case "tiktoken-cl100k": {
      const { get_encoding } = await import("tiktoken");
      const encoder = get_encoding("cl100k_base");
      return (value) => encoder.encode(value).length;
    }
    case "gpt-tokenizer-cl100k": {
      const tokenizer = await import("gpt-tokenizer/encoding/cl100k_base");
      tokenizer.setMergeCacheSize(0);
      return tokenizer.countTokens;
    }
    case "js-tiktoken-cl100k": {
      const { getEncoding } = await import("js-tiktoken");
      const encoder = getEncoding("cl100k_base");
      return (value) => encoder.encode(value).length;
    }
    case "tokenx-estimate": {
      const { estimateTokenCount } = await import("tokenx");
      return estimateTokenCount;
    }
  }
}

export async function runTokenizerResearchCandidate(
  candidate: TokenizerResearchCandidate,
  iterations = 100,
): Promise<TokenizerResearchCandidateResult> {
  const count = await loadCounter(candidate);
  for (const corpusCase of TOKENIZER_RESEARCH_CORPUS) count(corpusCase.value);
  const beforeRss = process.memoryUsage().rss;
  const samples: number[] = [];
  const counts: Record<string, number> = {};

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = process.hrtime.bigint();
    for (const corpusCase of TOKENIZER_RESEARCH_CORPUS) {
      const tokenCount = count(corpusCase.value);
      if (iteration === 0) counts[corpusCase.id] = tokenCount;
    }
    samples.push(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
  }

  return {
    candidate,
    counts,
    warmLatencyMs: {
      median: percentile(samples, 0.5),
      p95: percentile(samples, 0.95),
    },
    rssDeltaBytes: process.memoryUsage().rss - beforeRss,
  };
}

function parseCandidate(value: string | undefined): TokenizerResearchCandidate | null {
  return TOKENIZER_RESEARCH_CANDIDATES.find((candidate) => candidate === value) ?? null;
}

export function runTokenizerResearchInFreshProcesses(iterations = 100): TokenizerResearchResults {
  const scriptPath = fileURLToPath(import.meta.url);
  return {
    corpusCaseIds: TOKENIZER_RESEARCH_CORPUS.map((corpusCase) => corpusCase.id),
    candidates: TOKENIZER_RESEARCH_CANDIDATES.map((candidate) => {
      const output = execFileSync(
        process.execPath,
        ["--experimental-strip-types", scriptPath, "--candidate", candidate, "--iterations", String(iterations)],
        { encoding: "utf8" },
      );
      return JSON.parse(output) as TokenizerResearchCandidateResult;
    }),
  };
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const isDirectInvocation = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectInvocation) {
  const candidate = parseCandidate(argumentValue("--candidate"));
  const rawIterations = argumentValue("--iterations");
  const iterations = Number(rawIterations ?? 100);
  if (!Number.isInteger(iterations) || iterations < 3) {
    throw new Error("--iterations must be an integer greater than or equal to 3");
  }
  if (!argumentValue("--candidate")) {
    process.stdout.write(`${JSON.stringify(runTokenizerResearchInFreshProcesses(iterations), null, 2)}\n`);
  } else if (!candidate) {
    throw new Error(`Unknown tokenizer research candidate: ${argumentValue("--candidate")}`);
  } else {
    runTokenizerResearchCandidate(candidate, iterations).then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    });
  }
}
