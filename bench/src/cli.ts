#!/usr/bin/env node

import process from "node:process";
import path from "node:path";

import { runBenchmark } from "./runner.ts";

function resolvePathFromRepoRoot(repoRoot: string, input: string): string {
  return path.isAbsolute(input) ? input : path.resolve(repoRoot, input);
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }
    args[token.slice(2)] = argv[index + 1] ?? "true";
    index += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args["repo-root"] ?? process.cwd());
  const corpusPath = resolvePathFromRepoRoot(
    repoRoot,
    args.corpus ?? "bench/tests/fixtures/benchmarks/ai-context-engine-benchmark-corpus.json",
  );
  const outputDir = resolvePathFromRepoRoot(
    repoRoot,
    args.output ?? ".benchmarks/astrograph/latest",
  );

  const outcome = await runBenchmark({
    corpusPath,
    outputDir,
    repoRoot,
    taskId: args.task,
    workflowId: args.workflow,
    strict: args.strict === "true",
  });

  process.stdout.write(`${JSON.stringify(outcome.artifacts, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
