#!/usr/bin/env node

import {
  collectDaemonPerfMetrics,
  parsePerfArgs,
  printHumanSummary,
} from "./perf-lib.mjs";

async function main() {
  const options = parsePerfArgs(process.argv.slice(2));
  const result = await collectDaemonPerfMetrics(options.repoRoot, options.runs);

  printHumanSummary("Astrograph perf:daemon", {
    repoRoot: result.sourceRepoRoot,
    runs: result.runs,
    coldDaemonIndexMs: result.metrics.coldDaemonIndexMs,
    warmDaemonIndexP50Ms: result.metrics.warmDaemonIndexP50Ms,
    warmDaemonIndexP95Ms: result.metrics.warmDaemonIndexP95Ms,
    warmDaemonOutlineP50Ms: result.metrics.warmDaemonOutlineP50Ms,
    warmDaemonOutlineP95Ms: result.metrics.warmDaemonOutlineP95Ms,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
