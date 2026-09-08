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
const allowDirty = args.includes("--allow-dirty");
if (!Number.isInteger(runs) || runs < 3) {
  throw new Error("--runs must be an integer of at least 3");
}
const engineRevision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: engineRoot,
  encoding: "utf8",
}).trim();
const engineDirty = execFileSync("git", ["status", "--porcelain"], {
  cwd: engineRoot,
  encoding: "utf8",
}).trim().length > 0;
if (engineDirty && !allowDirty) {
  throw new Error("engine root must be clean; use --allow-dirty only for development smoke tests");
}

const {
  clearStorageProcessCaches,
  getTaskContext,
  indexFolder,
  queryCode,
} = await import(pathToFileURL(path.join(engineRoot, "src", "index.ts")).href);
const { getContextBundle } = await import(
  pathToFileURL(path.join(engineRoot, "src", "storage.ts")).href
);
const { BENCHMARK_TOKENIZER, countTokens, disposeTokenizer } = await import(
  pathToFileURL(path.join(engineRoot, "src", "tokenizer.ts")).href
);

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};
const percent = (count, total) => total === 0 ? 100 : (count / total) * 100;
const hasEvidence = (record) => Array.isArray(record.relationEvidence)
  && record.relationEvidence.length > 0;
const hasConfidence = (record) => hasEvidence(record)
  && record.relationEvidence.every((evidence) =>
    evidence.confidence === "high" || evidence.confidence === "medium");

const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-relationship-evidence-"));
try {
  await mkdir(path.join(repoRoot, "src"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "astrograph.config.json"),
    JSON.stringify({ storageLocation: "repo-local" }),
  );
  await writeFile(
    path.join(repoRoot, "src", "formatters.ts"),
    `export function firstFormatter(value: number): string {
  return value.toFixed(1);
}

export function bestFormatter(value: number): string {
  return value.toFixed(2);
}
`,
  );
  await writeFile(
    path.join(repoRoot, "src", "best-consumer.ts"),
    `import { bestFormatter as formatBest } from "./formatters.js";

export function unrelated(value: number): string {
  return String(value);
}

export function renderBest(value: number): string {
  return formatBest(value);
}

export function renderBestAgain(value: number): string {
  return formatBest(value + 1);
}
`,
  );
  await writeFile(
    path.join(repoRoot, "src", "first-consumer.ts"),
    `import { firstFormatter } from "./formatters.js";

export function renderFirst(value: number): string {
  return firstFormatter(value);
}
`,
  );
  await writeFile(
    path.join(repoRoot, "src", "barrel.ts"),
    `export { bestFormatter as publicBestFormatter } from "./formatters.js";

export function barrelMarker(): string {
  return "barrel";
}
`,
  );
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  await indexFolder({ repoRoot });

  const expectedReferences = new Set(["renderBest", "renderBestAgain"]);
  const samples = [];
  for (let run = 0; run < runs; run += 1) {
    const startedAt = performance.now();
    const discover = await queryCode({
      repoRoot,
      intent: "discover",
      query: "bestFormatter",
      includeDependencies: false,
      includeReferences: true,
      relationDepth: 1,
    });
    if (discover.intent !== "discover") throw new Error("discover task returned the wrong intent");
    const seedId = discover.matches.find(
      (entry) => entry.depth === 0 && entry.symbol.name === "bestFormatter",
    )?.symbol.id;
    if (!seedId) throw new Error("discover task did not return the target seed");

    const importers = await queryCode({
      repoRoot,
      intent: "discover",
      query: "bestFormatter",
      includeDependencies: false,
      includeImporters: true,
      relationDepth: 1,
    });
    if (importers.intent !== "discover") throw new Error("importer task returned the wrong intent");
    const contextBundle = await getContextBundle({
      repoRoot,
      symbolIds: [seedId],
      tokenBudget: 2_000,
      includeDependencies: false,
      includeReferences: true,
      relationDepth: 1,
    });
    const taskContext = await getTaskContext({
      repoRoot,
      symbolIds: [seedId],
      payloadTokenBudget: 2_000,
      includeDependencies: false,
      includeReferences: true,
      relationDepth: 1,
    });
    const latencyMs = performance.now() - startedAt;

    const referenceRecords = discover.matches.filter((entry) =>
      entry.reasons.includes("references_match"));
    const actualReferences = new Set(referenceRecords.map((entry) => entry.symbol.name));
    const trueReferences = [...actualReferences].filter((name) => expectedReferences.has(name));
    const falseSymbolClaims = [...actualReferences].filter((name) => !expectedReferences.has(name));
    const relationRecords = [
      ...discover.matches.filter((entry) => entry.depth > 0),
      ...importers.matches.filter((entry) => entry.depth > 0),
      ...contextBundle.items.filter((entry) => entry.role === "dependency"),
      ...taskContext.items.filter((entry) => entry.role === "relation"),
    ];

    samples.push({
      relationRecallPct: percent(trueReferences.length, expectedReferences.size),
      relationPrecisionPct: percent(trueReferences.length, actualReferences.size),
      falseSymbolClaims: falseSymbolClaims.length,
      evidenceCoveragePct: percent(relationRecords.filter(hasEvidence).length, relationRecords.length),
      confidenceCoveragePct: percent(relationRecords.filter(hasConfidence).length, relationRecords.length),
      discoveryResponseTokens: countTokens(JSON.stringify(discover)),
      contextBundleResponseTokens: countTokens(JSON.stringify(contextBundle)),
      taskContextResponseTokens: countTokens(JSON.stringify(taskContext)),
      totalResponseTokens: countTokens(JSON.stringify({ discover, importers, contextBundle, taskContext })),
      retrievalLatencyMs: latencyMs,
      order: {
        references: referenceRecords.map((entry) => entry.symbol.name),
        importers: importers.matches.filter((entry) => entry.depth > 0).map((entry) => entry.symbol.name),
        context: contextBundle.items.map((entry) => entry.symbol.name),
        task: taskContext.items.map((entry) => entry.symbol.name),
      },
    });
  }

  const stableOrder = samples.every((sample) =>
    JSON.stringify(sample.order) === JSON.stringify(samples[0].order));
  if (!stableOrder) throw new Error("relationship ordering changed across equivalent runs");

  const packageJson = JSON.parse(await readFile(path.join(engineRoot, "package.json"), "utf8"));
  console.log(JSON.stringify({
    schemaVersion: 1,
    fixture: "relationship-evidence-v1",
    engineRevision,
    engineDirty,
    engineVersion: packageJson.version,
    runs,
    validRuns: samples.length,
    tokenizer: BENCHMARK_TOKENIZER,
    relationRecallPct: median(samples.map((sample) => sample.relationRecallPct)),
    relationPrecisionPct: median(samples.map((sample) => sample.relationPrecisionPct)),
    falseSymbolClaims: median(samples.map((sample) => sample.falseSymbolClaims)),
    evidenceCoveragePct: median(samples.map((sample) => sample.evidenceCoveragePct)),
    confidenceCoveragePct: median(samples.map((sample) => sample.confidenceCoveragePct)),
    discoveryResponseTokens: median(samples.map((sample) => sample.discoveryResponseTokens)),
    contextBundleResponseTokens: median(samples.map((sample) => sample.contextBundleResponseTokens)),
    taskContextResponseTokens: median(samples.map((sample) => sample.taskContextResponseTokens)),
    totalResponseTokens: median(samples.map((sample) => sample.totalResponseTokens)),
    retrievalLatencyMs: Number(median(samples.map((sample) => sample.retrievalLatencyMs)).toFixed(3)),
    stableOrder,
  }, null, 2));
} finally {
  disposeTokenizer();
  clearStorageProcessCaches();
  await rm(repoRoot, { recursive: true, force: true });
}
