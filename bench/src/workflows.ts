import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  getContextBundle,
  getFileContent,
  getFileOutline,
  getFileTree,
  getSymbolSource,
  searchSymbols,
  searchText,
} from "../../src/index.ts";

import { countTokens, estimateTokens } from "./tokenizer.ts";
import type { BenchmarkCorpusTask } from "./types.ts";

export interface WorkflowExecutionResult {
  retrievedTokens: number;
  estimatedRetrievedTokens: number;
  toolCalls: number;
  evidence: string[];
  rankedEvidence: string[];
  notes: string[];
  success: boolean;
}

export interface WorkflowDefinition {
  workflowId: string;
  label: string;
  description: string;
  run(input: {
    repoRoot: string;
    task: BenchmarkCorpusTask;
  }): Promise<WorkflowExecutionResult>;
}

function matchesAllowedPath(filePath: string, allowedPaths: readonly string[]): boolean {
  return allowedPaths.some((pattern) => {
    if (pattern.endsWith("/**")) {
      return filePath.startsWith(pattern.slice(0, -3));
    }
    return filePath === pattern;
  });
}

function filterEvidenceToAllowedPaths(
  evidence: readonly string[],
  allowedPaths: readonly string[],
): string[] {
  return evidence.filter((item) => {
    if (!item.includes("/") && !item.includes(":")) {
      return true;
    }
    const pathPrefix = item.split(":", 1)[0] ?? item;
    return matchesAllowedPath(pathPrefix, allowedPaths);
  });
}

function uniqueOrdered(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

async function computeBaselineTokens(repoRoot: string, task: BenchmarkCorpusTask) {
  const fileTree = await getFileTree({ repoRoot });
  const relevantFiles = fileTree.filter((file) =>
    matchesAllowedPath(file.path, task.manifest.allowedPaths),
  );
  let total = 0;
  for (const file of relevantFiles) {
    const content = await readFile(path.join(repoRoot, file.path), "utf8");
    total += countTokens(content);
  }
  return total;
}

async function computeEstimatedBaselineTokens(repoRoot: string, task: BenchmarkCorpusTask) {
  const fileTree = await getFileTree({ repoRoot });
  const relevantFiles = fileTree.filter((file) =>
    matchesAllowedPath(file.path, task.manifest.allowedPaths),
  );
  let total = 0;
  for (const file of relevantFiles) {
    const content = await readFile(path.join(repoRoot, file.path), "utf8");
    total += estimateTokens(content);
  }
  return total;
}

function successForTask(task: BenchmarkCorpusTask, evidence: readonly string[]): boolean {
  return task.manifest.targets.some((target) =>
    evidence.some((item) =>
      target.mode === "exact" ? item === target.value : item.includes(target.value),
    ),
  );
}

const baselineWorkflow: WorkflowDefinition = {
  workflowId: "baseline",
  label: "Baseline",
  description: "Read all eligible files in the allowed task slice.",
  async run({ repoRoot, task }) {
    const fileTree = await getFileTree({ repoRoot });
    const relevantFiles = fileTree.filter((file) =>
      matchesAllowedPath(file.path, task.manifest.allowedPaths),
    );
    let tokenCount = 0;
    let estimatedTokenCount = 0;
    const evidence: string[] = [];

    for (const file of relevantFiles) {
      const content = await readFile(path.join(repoRoot, file.path), "utf8");
      tokenCount += countTokens(content);
      estimatedTokenCount += estimateTokens(content);
      evidence.push(file.path);
      for (const target of task.manifest.targets) {
        if (content.includes(target.value)) {
          evidence.push(target.value);
        }
      }
    }

    const rankedEvidence = uniqueOrdered(
      filterEvidenceToAllowedPaths(evidence, task.manifest.allowedPaths),
    );

    return {
      retrievedTokens: tokenCount,
      estimatedRetrievedTokens: estimatedTokenCount,
      toolCalls: 1,
      evidence: rankedEvidence,
      rankedEvidence,
      notes: ["baseline read-all slice"],
      success: successForTask(task, rankedEvidence),
    };
  },
};

const symbolFirstWorkflow: WorkflowDefinition = {
  workflowId: "symbol-first",
  label: "Symbol First",
  description: "Search symbols then fetch exact symbol source.",
  async run({ repoRoot, task }) {
    const matches = await searchSymbols({
      repoRoot,
      query: task.frontmatter.query,
      limit: 3,
    });
    const allowedMatches = matches.filter((item) =>
      matchesAllowedPath(item.filePath, task.manifest.allowedPaths),
    );
    let retrievedTokens = countTokens(JSON.stringify(allowedMatches));
    let estimatedRetrievedTokens = estimateTokens(JSON.stringify(allowedMatches));
    const evidence: string[] = allowedMatches.flatMap((item) => [
      item.name,
      item.filePath,
    ]);
    const notes: string[] = [];
    let toolCalls = 1;

    const firstMatch = allowedMatches[0];
    if (firstMatch) {
      const source = await getSymbolSource({
        repoRoot,
        symbolId: firstMatch.id,
        verify: true,
      });
      const sourceText = source.source ?? "";
      retrievedTokens += countTokens(sourceText);
      estimatedRetrievedTokens += estimateTokens(sourceText);
      if (source.symbol?.name && source.symbol.filePath) {
        evidence.push(source.symbol.name, source.symbol.filePath);
      } else {
        notes.push("symbol source returned without verified symbol metadata");
      }
      toolCalls += 1;
    } else {
      notes.push("no symbol match");
    }

    const rankedEvidence = uniqueOrdered(evidence);

    return {
      retrievedTokens,
      estimatedRetrievedTokens,
      toolCalls,
      evidence: rankedEvidence,
      rankedEvidence,
      notes,
      success: successForTask(task, rankedEvidence),
    };
  },
};

const textFirstWorkflow: WorkflowDefinition = {
  workflowId: "text-first",
  label: "Text First",
  description: "Search raw text then fetch matching file content.",
  async run({ repoRoot, task }) {
    const matches = await searchText({
      repoRoot,
      query: task.frontmatter.query,
    });
    const allowedMatches = matches.filter((item) =>
      matchesAllowedPath(item.filePath, task.manifest.allowedPaths),
    );
    let retrievedTokens = countTokens(JSON.stringify(allowedMatches));
    let estimatedRetrievedTokens = estimateTokens(JSON.stringify(allowedMatches));
    const evidence = allowedMatches.map((item) => `${item.filePath}:${item.line}`);
    const notes: string[] = [];
    let toolCalls = 1;

    if (allowedMatches[0]) {
      const file = await getFileContent({
        repoRoot,
        filePath: allowedMatches[0].filePath,
      });
      retrievedTokens += countTokens(file.content);
      estimatedRetrievedTokens += estimateTokens(file.content);
      evidence.push(file.filePath);
      for (const target of task.manifest.targets) {
        if (file.content.includes(target.value)) {
          evidence.push(target.value);
        }
      }
      toolCalls += 1;
    } else {
      notes.push("no text match");
    }

    const rankedEvidence = uniqueOrdered(evidence);

    return {
      retrievedTokens,
      estimatedRetrievedTokens,
      toolCalls,
      evidence: rankedEvidence,
      rankedEvidence,
      notes,
      success: successForTask(task, rankedEvidence),
    };
  },
};

const discoveryFirstWorkflow: WorkflowDefinition = {
  workflowId: "discovery-first",
  label: "Discovery First",
  description: "Outline before retrieval.",
  async run({ repoRoot, task }) {
    const fileTree = await getFileTree({ repoRoot });
    const relevantFiles = fileTree.filter((file) =>
      matchesAllowedPath(file.path, task.manifest.allowedPaths),
    );
    let retrievedTokens = countTokens(JSON.stringify(relevantFiles));
    let estimatedRetrievedTokens = estimateTokens(JSON.stringify(relevantFiles));
    const evidence = relevantFiles.map((file) => file.path);
    const notes: string[] = [];
    let toolCalls = 1;

    if (relevantFiles[0]) {
      const outline = await getFileOutline({
        repoRoot,
        filePath: relevantFiles[0].path,
      });
      retrievedTokens += countTokens(JSON.stringify(outline));
      estimatedRetrievedTokens += estimateTokens(JSON.stringify(outline));
      evidence.push(
        relevantFiles[0].path,
        ...outline.symbols.map((symbol) => symbol.name),
      );
      toolCalls += 1;
    } else {
      notes.push("no relevant files");
    }

    const rankedEvidence = uniqueOrdered(evidence);

    return {
      retrievedTokens,
      estimatedRetrievedTokens,
      toolCalls,
      evidence: rankedEvidence,
      rankedEvidence,
      notes,
      success: successForTask(task, rankedEvidence),
    };
  },
};

const bundleWorkflow: WorkflowDefinition = {
  workflowId: "bundle",
  label: "Bundle",
  description: "Query-driven bounded context assembly.",
  async run({ repoRoot, task }) {
    const bundle = await getContextBundle({
      repoRoot,
      query: task.frontmatter.query,
      tokenBudget: 400,
    });
    const allowedItems = bundle.items.filter((item) =>
      matchesAllowedPath(item.symbol.filePath, task.manifest.allowedPaths),
    );
    const rankedEvidence = uniqueOrdered(
      allowedItems.flatMap((item) => [item.symbol.name, item.symbol.filePath]),
    );
    return {
      retrievedTokens: allowedItems.reduce((total, item) => total + item.tokenCount, 0),
      estimatedRetrievedTokens: estimateTokens(
        JSON.stringify(
          allowedItems.map((item) => ({
            role: item.role,
            reason: item.reason,
            symbol: item.symbol,
            source: item.source,
          })),
        ),
      ),
      toolCalls: 1,
      evidence: rankedEvidence,
      rankedEvidence,
      notes: [
        ...(bundle.truncated ? ["bundle truncated"] : []),
        ...(allowedItems.length < bundle.items.length ? ["filtered to allowed paths"] : []),
      ],
      success: successForTask(task, rankedEvidence),
    };
  },
};

export const WORKFLOWS: WorkflowDefinition[] = [
  baselineWorkflow,
  discoveryFirstWorkflow,
  symbolFirstWorkflow,
  textFirstWorkflow,
  bundleWorkflow,
];

export function getWorkflowDefinition(workflowId: string): WorkflowDefinition {
  const workflow = WORKFLOWS.find((entry) => entry.workflowId === workflowId);
  if (!workflow) {
    throw new Error(`Unknown workflow: ${workflowId}`);
  }
  return workflow;
}

export async function runWorkflowTask(input: {
  repoRoot: string;
  task: BenchmarkCorpusTask;
  workflowId: string;
}): Promise<WorkflowExecutionResult> {
  return getWorkflowDefinition(input.workflowId).run(input);
}

export async function computeBaselineForTask(
  repoRoot: string,
  task: BenchmarkCorpusTask,
) {
  return computeBaselineTokens(repoRoot, task);
}

export async function computeEstimatedBaselineForTask(
  repoRoot: string,
  task: BenchmarkCorpusTask,
) {
  return computeEstimatedBaselineTokens(repoRoot, task);
}
