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
  getSymbolSource,
  getTaskContext,
  indexFolder,
  searchSymbolsResult,
} = await import(pathToFileURL(path.join(engineRoot, "src", "index.ts")).href);
const { hashString } = await import(pathToFileURL(path.join(engineRoot, "src", "hash.ts")).href);
const { BENCHMARK_TOKENIZER, countTokens, disposeTokenizer } = await import(
  pathToFileURL(path.join(engineRoot, "src", "tokenizer.ts")).href
);

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-json-discovery-"));
try {
  const values = Object.fromEntries(
    ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map((suffix) => [
      `setting${suffix}`,
      suffix.repeat(1_000),
    ]),
  );
  const content = JSON.stringify(values);
  const expectedSource = `"settingGamma":${JSON.stringify(values.settingGamma)}`;
  const expectedStartByte = Buffer.from(content).indexOf(expectedSource);
  const expectedRange = {
    encoding: "utf8",
    startByte: expectedStartByte,
    endByte: expectedStartByte + Buffer.byteLength(expectedSource),
    startLine: 1,
    endLine: 1,
  };

  await mkdir(path.join(repoRoot, "config"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "astrograph.config.json"),
    JSON.stringify({ storageLocation: "repo-local" }),
  );
  await writeFile(path.join(repoRoot, "config", "large.json"), content);
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  await indexFolder({ repoRoot });

  const samples = [];
  for (let run = 0; run < runs; run += 1) {
    const startedAt = performance.now();
    const discovery = await searchSymbolsResult({
      repoRoot,
      query: "setting",
      filePattern: "config/large.json",
      limit: 5,
    });
    const targetRank = discovery.items.findIndex((symbol) => symbol.name === "settingGamma") + 1;
    if (discovery.items.length !== 5 || targetRank === 0) {
      throw new Error("five-result discovery did not return settingGamma");
    }
    const target = discovery.items[targetRank - 1];
    const exact = (await getSymbolSource({ repoRoot, symbolId: target.id, verify: true })).items[0];
    const taskItem = (await getTaskContext({
      repoRoot,
      symbolIds: [target.id],
      payloadTokenBudget: 10_000,
      includeDependencies: false,
    })).items[0];
    const retrievalLatencyMs = performance.now() - startedAt;
    const expectedHash = hashString(expectedSource, "integrity");
    if (
      !exact
      || !taskItem
      || exact.source !== expectedSource
      || exact.verified !== true
      || exact.provenance.sourceHash !== expectedHash
      || JSON.stringify(exact.provenance.range) !== JSON.stringify(expectedRange)
      || taskItem.source !== expectedSource
      || taskItem.sourceTokens !== countTokens(expectedSource)
      || taskItem.provenance.sourceHash !== expectedHash
      || JSON.stringify(taskItem.provenance.range) !== JSON.stringify(expectedRange)
    ) {
      throw new Error("exact JSON source fidelity validation failed");
    }

    const discoveryJson = JSON.stringify(discovery);
    samples.push({
      discoveryBytes: Buffer.byteLength(discoveryJson),
      discoveryTokens: countTokens(discoveryJson),
      targetRank,
      exactSourceBytes: Buffer.byteLength(exact.source),
      exactSourceTokens: countTokens(exact.source),
      sourceFidelityPct: 100,
      retrievalLatencyMs,
      order: discovery.items.map((symbol) => symbol.name),
    });
  }

  const stableOrder = samples.every((sample) =>
    JSON.stringify(sample.order) === JSON.stringify(samples[0].order));
  if (!stableOrder) throw new Error("JSON discovery ordering changed across equivalent runs");

  const packageJson = JSON.parse(await readFile(path.join(engineRoot, "package.json"), "utf8"));
  console.log(JSON.stringify({
    schemaVersion: 1,
    fixture: "json-discovery-records-v1",
    engineRevision,
    engineDirty,
    engineVersion: packageJson.version,
    runs,
    validRuns: samples.length,
    tokenizer: BENCHMARK_TOKENIZER,
    discoveryBytes: median(samples.map((sample) => sample.discoveryBytes)),
    discoveryTokens: median(samples.map((sample) => sample.discoveryTokens)),
    targetRank: median(samples.map((sample) => sample.targetRank)),
    exactSourceBytes: median(samples.map((sample) => sample.exactSourceBytes)),
    exactSourceTokens: median(samples.map((sample) => sample.exactSourceTokens)),
    sourceFidelityPct: median(samples.map((sample) => sample.sourceFidelityPct)),
    retrievalLatencyMs: Number(median(samples.map((sample) => sample.retrievalLatencyMs)).toFixed(3)),
    stableOrder,
  }, null, 2));
} finally {
  disposeTokenizer();
  clearStorageProcessCaches();
  await rm(repoRoot, { recursive: true, force: true });
}
