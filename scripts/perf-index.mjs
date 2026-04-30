#!/usr/bin/env node

import {
  collectIndexPerfMetrics,
  parsePerfArgs,
  printHumanSummary,
} from "./perf-lib.mjs";

async function main() {
  const options = parsePerfArgs(process.argv.slice(2));
  const result = await collectIndexPerfMetrics(options.repoRoot);

  printHumanSummary("Astrograph perf:index", {
    repoRoot: result.sourceRepoRoot,
    fileCount: result.metrics.fileCount,
    coldIndexMs: result.metrics.coldIndexMs,
    warmNoopRefreshMs: result.metrics.warmNoopRefreshMs,
    warmChangedRefreshMs: result.metrics.warmChangedRefreshMs,
    fileDiscoveryMs: result.metrics.fileDiscoveryMs,
    hashingMs: result.metrics.hashingMs,
    parseMs: result.metrics.parseMs,
    sqliteWriteMsApprox: result.metrics.sqliteWriteMsApprox,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
