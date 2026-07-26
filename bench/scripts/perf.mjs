#!/usr/bin/env node

import {
  collectIndexPerfMetrics,
  collectQueryPerfMetrics,
  parsePerfArgs,
  printHumanSummary,
} from "./perf-lib.mjs";

async function main() {
  const options = parsePerfArgs(process.argv.slice(2));
  const [index, query] = await Promise.all([
    collectIndexPerfMetrics(options.repoRoot),
    collectQueryPerfMetrics(options.repoRoot, options.runs),
  ]);

  const result = {
    schemaVersion: "1.0",
    sourceRepoRoot: index.sourceRepoRoot,
    commit: index.commit,
    measuredAt: new Date().toISOString(),
    index,
    query,
  };

  printHumanSummary("Astrograph perf", {
    repoRoot: result.sourceRepoRoot,
    coldIndexMs: index.metrics.coldIndexMs,
    warmNoopRefreshMs: index.metrics.warmNoopRefreshMs,
    warmChangedRefreshMs: index.metrics.warmChangedRefreshMs,
    queryCodeDiscoverP50Ms: query.metrics.queryCodeDiscoverP50Ms,
    queryCodeAssembleP50Ms: query.metrics.queryCodeAssembleP50Ms,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
