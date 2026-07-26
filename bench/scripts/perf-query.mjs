#!/usr/bin/env node

import {
  collectQueryPerfMetrics,
  parsePerfArgs,
  printHumanSummary,
} from "./perf-lib.mjs";

async function main() {
  const options = parsePerfArgs(process.argv.slice(2));
  const result = await collectQueryPerfMetrics(options.repoRoot, options.runs);

  printHumanSummary("Astrograph perf:query", {
    repoRoot: result.sourceRepoRoot,
    runs: result.runs,
    queryCodeDiscoverP50Ms: result.metrics.queryCodeDiscoverP50Ms,
    queryCodeDiscoverP95Ms: result.metrics.queryCodeDiscoverP95Ms,
    queryCodeSourceP50Ms: result.metrics.queryCodeSourceP50Ms,
    queryCodeSourceP95Ms: result.metrics.queryCodeSourceP95Ms,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
