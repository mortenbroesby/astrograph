import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
};
const engineRoot = path.resolve(valueAfter("--engine-root", packageRoot));
const runs = Number(valueAfter("--runs", "5"));
if (!Number.isInteger(runs) || runs < 1) {
  throw new Error("--runs must be a positive integer");
}

const { clearStorageProcessCaches, indexFolder, searchSymbols } = await import(
  pathToFileURL(path.join(engineRoot, "src", "index.ts")).href
);
const { BENCHMARK_TOKENIZER, countTokens, disposeTokenizer } = await import(
  pathToFileURL(path.join(engineRoot, "src", "tokenizer.ts")).href
);

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-search-ranking-"));
try {
  await mkdir(path.join(repoRoot, "src", "ranking", "scoped"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "astrograph.config.json"),
    JSON.stringify({ storageLocation: "repo-local" }),
  );
  await writeFile(
    path.join(repoRoot, "src", "ranking", "decoys.ts"),
    Array.from(
      { length: 401 },
      (_, index) =>
        `/** scopedselectionneedle scopedselectionneedle scopedselectionneedle */\nexport function scopedSelectionNeedleDecoy${index}() { return ${index}; }`,
    ).join("\n"),
  );
  await writeFile(
    path.join(repoRoot, "src", "ranking", "scoped", "target.ts"),
    "export function scopedSelectionNeedleTarget() { return true; }\n",
  );
  await writeFile(
    path.join(repoRoot, "src", "ranking", "lexical.ts"),
    [
      "export function lexicalNeedleFtsAnchor() { return true; }",
      "export function embeddedLexicalNeedleCandidate() { return true; }",
    ].join("\n"),
  );
  await writeFile(
    path.join(repoRoot, "src", "ranking", "ordering.ts"),
    [
      "export function orderingneedle() { return true; }",
      "/** orderingneedle orderingneedle orderingneedle orderingneedle orderingneedle */",
      "export function orderingNeedleSummaryChampion() { return true; }",
    ].join("\n"),
  );
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  await indexFolder({ repoRoot });

  const samples = [];
  for (let run = 0; run < runs; run += 1) {
    const startedAt = performance.now();
    const scoped = await searchSymbols({
      repoRoot,
      query: "scopedselectionneedle",
      filePattern: "src/ranking/scoped/**",
    });
    const lexical = await searchSymbols({ repoRoot, query: "lexicalneedle" });
    const ranked = await searchSymbols({ repoRoot, query: "orderingneedle" });
    const latencyMs = performance.now() - startedAt;
    const firstRelevantRank = ranked.findIndex((symbol) => symbol.name === "orderingneedle") + 1;
    const hits = [
      scoped.some((symbol) => symbol.name === "scopedSelectionNeedleTarget"),
      lexical.some((symbol) => symbol.name === "embeddedLexicalNeedleCandidate"),
      firstRelevantRank > 0,
    ];
    samples.push({
      targetRecallPct: (hits.filter(Boolean).length / hits.length) * 100,
      firstRelevantRank: firstRelevantRank || null,
      falsePositives: firstRelevantRank > 0 ? firstRelevantRank - 1 : ranked.length,
      scopedRecallPct: hits[0] ? 100 : 0,
      responseTokens: countTokens(JSON.stringify({ scoped, lexical, ranked })),
      latencyMs,
      rankedIds: ranked.map((symbol) => symbol.id),
    });
  }

  const packageJson = JSON.parse(await readFile(path.join(engineRoot, "package.json"), "utf8"));
  const stableOrder = samples.every(
    (sample) => JSON.stringify(sample.rankedIds) === JSON.stringify(samples[0].rankedIds),
  );
  console.log(JSON.stringify({
    engineRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: engineRoot, encoding: "utf8" }).trim(),
    engineVersion: packageJson.version,
    runs,
    tokenizer: BENCHMARK_TOKENIZER,
    targetRecallPct: median(samples.map((sample) => sample.targetRecallPct)),
    firstRelevantRank: median(samples.map((sample) => sample.firstRelevantRank ?? Number.MAX_SAFE_INTEGER)),
    falsePositives: median(samples.map((sample) => sample.falsePositives)),
    scopedRecallPct: median(samples.map((sample) => sample.scopedRecallPct)),
    responseTokens: median(samples.map((sample) => sample.responseTokens)),
    retrievalLatencyMs: Number(median(samples.map((sample) => sample.latencyMs)).toFixed(3)),
    stableOrder,
  }, null, 2));
} finally {
  disposeTokenizer();
  clearStorageProcessCaches();
  await rm(repoRoot, { recursive: true, force: true });
}
