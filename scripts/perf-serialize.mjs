#!/usr/bin/env node

import {
  collectSerializationPerfMetrics,
  parsePerfArgs,
  printHumanSummary,
} from "./perf-lib.mjs";

async function main() {
  const options = parsePerfArgs(process.argv.slice(2));
  const result = await collectSerializationPerfMetrics(
    options.repoRoot,
    options.runs,
  );

  printHumanSummary("Astrograph perf:serialize", {
    repoRoot: result.sourceRepoRoot,
    runs: result.metrics.diagnostics.iterations,
    diagnosticsNativeCompactMs: result.metrics.diagnostics.nativeCompactMs,
    diagnosticsOptimizedMs: result.metrics.diagnostics.optimizedMs,
    repoOutlineNativeCompactMs: result.metrics.get_repo_outline.nativeCompactMs,
    repoOutlineOptimizedMs: result.metrics.get_repo_outline.optimizedMs,
    fileTreeNativeCompactMs: result.metrics.get_file_tree.nativeCompactMs,
    fileTreeOptimizedMs: result.metrics.get_file_tree.optimizedMs,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
