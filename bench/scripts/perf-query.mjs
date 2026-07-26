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
    queryCodeAssembleP50Ms: result.metrics.queryCodeAssembleP50Ms,
    queryCodeAssembleP95Ms: result.metrics.queryCodeAssembleP95Ms,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
