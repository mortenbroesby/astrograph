import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { readDaemonRuntime } from "../../src/daemon-runtime.ts";
import { BENCHMARK_TOKENIZER, countTokens } from "../../src/tokenizer.ts";

const TASK = {
  id: "task-corpus-loader",
  query: "loadBenchmarkCorpus",
  filePath: "bench/src/corpus.ts",
  targets: ["loadBenchmarkCorpus", "loadBenchmarkTaskCard"],
};

const JCODEMUNCH_CONFIG = {
  use_ai_summaries: false,
  context_providers: false,
  allow_remote_summarizer: false,
  share_savings: false,
  perf_telemetry_enabled: false,
  tool_profile: "core",
  compact_schemas: true,
};

function round(value, decimals = 1) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function summarizeComparisonRuns(runs) {
  return [...Map.groupBy(runs, (run) => run.server)].map(([server, serverRuns]) => {
    const baselineTokens = serverRuns[0].baselineTokens;
    const medianRetrievalTokens = median(serverRuns.map((run) => run.retrievalTokens));
    return {
      server,
      runs: serverRuns.length,
      successes: serverRuns.filter((run) => run.success).length,
      schemaTokens: serverRuns[0].schemaTokens,
      baselineTokens,
      medianRetrievalTokens,
      medianTokenReductionPct: round(
        ((baselineTokens - medianRetrievalTokens) / baselineTokens) * 100,
      ),
      medianColdIndexMs: round(median(serverRuns.map((run) => run.coldIndexMs))),
      medianWarmIndexMs: round(median(serverRuns.map((run) => run.warmIndexMs))),
      medianRetrievalMs: round(median(serverRuns.map((run) => run.retrievalMs))),
      medianToolCalls: median(serverRuns.map((run) => run.toolCalls)),
    };
  });
}

export function renderComparisonReport({ repoSha, tokenizer, taskId, summaries }) {
  return [
    "# jCodeMunch vs Astrograph MCP Comparison",
    "",
    `- Repo SHA: \`${repoSha}\``,
    `- Task: \`${taskId}\``,
    `- Tokenizer: \`${tokenizer}\``,
    "",
    "| Server | Runs | Successes | Schema tokens | Retrieval tokens (median) | Reduction vs read-all | Cold index ms | Warm index ms | Retrieval ms | Calls |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summaries.map((summary) =>
      `| ${summary.server} | ${summary.runs} | ${summary.successes} | ${summary.schemaTokens} | ${summary.medianRetrievalTokens} | ${summary.medianTokenReductionPct}% | ${summary.medianColdIndexMs} | ${summary.medianWarmIndexMs} | ${summary.medianRetrievalMs} | ${summary.medianToolCalls} |`
    ),
    "",
    "Schema tokens are reported separately from retrieval tokens because hosts may defer or cache tool definitions. Retrieval reductions use the same read-all file baseline and do not use either server's self-reported savings counter.",
    "",
  ].join("\n");
}

export function parseComparisonOptions(argv) {
  if (argv[0] === "--") argv = argv.slice(1);
  const options = {
    runs: 3,
    outputDir: ".benchmarks/jcodemunch-comparison/latest",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--runs" && argv[index + 1]) {
      options.runs = Number(argv[index += 1]);
    } else if (argv[index] === "--output" && argv[index + 1]) {
      options.outputDir = argv[index += 1];
    } else {
      throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error("--runs must be a positive integer");
  }
  return options;
}

function textContent(result) {
  return result.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

function parseJsonResult(result, label) {
  const text = textContent(result);
  try {
    return { text, value: JSON.parse(text) };
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

export function assertSuccessfulIndexResult(server, value) {
  const success = server === "astrograph" ? value?.ok === true : value?.success === true;
  if (!success) {
    const detail = value?.error?.message ?? value?.error ?? "unknown error";
    throw new Error(`${server} index failed: ${detail}`);
  }
}

async function timed(run) {
  const startedAt = performance.now();
  const value = await run();
  return { value, elapsedMs: round(performance.now() - startedAt) };
}

function callTool(client, request, timeout = 60_000) {
  return client.callTool(request, undefined, { timeout });
}

async function withClient(definition, run) {
  const transport = new StdioClientTransport({
    command: definition.command,
    args: definition.args,
    cwd: definition.cwd,
    env: definition.env,
    stderr: "pipe",
  });
  const client = new Client({ name: "astrograph-comparison", version: "1.0.0" });
  try {
    await client.connect(transport);
    return await run(client);
  } finally {
    await client.close();
  }
}

export function firstAstrographSymbolId(searchText) {
  const result = JSON.parse(searchText);
  const id = result?.data?.items?.[0]?.id;
  if (typeof id !== "string") throw new Error("Astrograph returned no symbol id");
  return id;
}

function firstJCodeMunchSymbolId(searchText) {
  const row = searchText.split("\n").find((line) => line.startsWith("s,"));
  const id = row?.split(",")[1];
  if (!id) throw new Error("jCodeMunch returned no symbol id");
  return id;
}

async function runServer({ server, repoRoot, storeRoot }) {
  const isAstrograph = server === "astrograph";
  const astrographHome = path.join(storeRoot, "home");
  if (isAstrograph) {
    await mkdir(astrographHome, { recursive: true });
    await writeFile(path.join(astrographHome, "config.json"), '{"storageLocation":"global"}\n');
  } else {
    await mkdir(storeRoot, { recursive: true });
    await writeFile(
      path.join(storeRoot, "config.jsonc"),
      `${JSON.stringify(JCODEMUNCH_CONFIG, null, 2)}\n`,
    );
  }

  const runtimeDir = isAstrograph
    ? await mkdtemp(path.join(os.tmpdir(), "astrograph-bench-"))
    : path.join(storeRoot, "runtime");
  const definition = isAstrograph
    ? {
        command: process.execPath,
        args: ["--no-warnings", path.join(repoRoot, "dist/astrograph.js"), "mcp"],
        cwd: repoRoot,
        env: {
          ...process.env,
          ASTROGRAPH_HOME: astrographHome,
          ASTROGRAPH_CACHE_HOME: path.join(storeRoot, "cache"),
          ASTROGRAPH_RUNTIME_DIR: runtimeDir,
        },
      }
    : {
        command: process.env.JCODEMUNCH_COMMAND ?? "jcodemunch-mcp",
        args: [],
        cwd: repoRoot,
        env: { ...process.env, CODE_INDEX_PATH: storeRoot },
      };

  try {
    return await withClient(definition, async (client) => {
      const { tools } = await client.listTools();
      const schema = JSON.stringify(tools);
      const cold = await timed(() => callTool(client, {
        name: "index_folder",
        arguments: isAstrograph
          ? { repoRoot }
          : { path: repoRoot, use_ai_summaries: false, identity_mode: "local" },
      }, 240_000));
      const coldResult = parseJsonResult(cold.value, `${server} cold index`);
      assertSuccessfulIndexResult(server, coldResult.value);
      const repo = isAstrograph ? repoRoot : coldResult.value.repo;
      if (typeof repo !== "string") throw new Error(`${server} did not identify its index`);

      const warm = await timed(() => callTool(client, {
        name: "index_folder",
        arguments: isAstrograph
          ? { repoRoot }
          : { path: repoRoot, use_ai_summaries: false, identity_mode: "local" },
      }, 240_000));
      const warmResult = parseJsonResult(warm.value, `${server} warm index`);
      assertSuccessfulIndexResult(server, warmResult.value);

      const search = await timed(() => callTool(client, {
        name: "search_symbols",
        arguments: isAstrograph
          ? { repoRoot, query: TASK.query, filePattern: TASK.filePath, limit: 5 }
          : {
              repo,
              query: TASK.query,
              file_pattern: TASK.filePath,
              max_results: 5,
              detail_level: "compact",
            },
      }));
      const searchText = textContent(search.value);
      const symbolId = isAstrograph
        ? firstAstrographSymbolId(searchText)
        : firstJCodeMunchSymbolId(searchText);
      const source = await timed(() => callTool(client, {
        name: "get_symbol_source",
        arguments: isAstrograph
          ? { repoRoot, symbolId, verify: true }
          : { repo, symbol_id: symbolId, verify: true, context_lines: 0 },
      }));
      const sourceText = textContent(source.value);
      const combined = `${searchText}\n${sourceText}`;

      return {
        server,
        serverVersion: client.getServerVersion()?.version ?? "unknown",
        toolCount: tools.length,
        schemaBytes: Buffer.byteLength(schema),
        schemaTokens: countTokens(schema),
        baselineTokens: countTokens(await readFile(path.join(repoRoot, TASK.filePath), "utf8")),
        retrievalBytes: Buffer.byteLength(searchText) + Buffer.byteLength(sourceText),
        retrievalTokens: countTokens(searchText) + countTokens(sourceText),
        coldIndexMs: cold.elapsedMs,
        warmIndexMs: warm.elapsedMs,
        coldIndexState: isAstrograph
          ? { parsedFiles: coldResult.value.data.parsedFiles, reusedFiles: coldResult.value.data.reusedFiles }
          : { performedIncremental: coldResult.value.performed_incremental },
        warmIndexState: isAstrograph
          ? { parsedFiles: warmResult.value.data.parsedFiles, reusedFiles: warmResult.value.data.reusedFiles }
          : { performedIncremental: warmResult.value.performed_incremental },
        retrievalMs: round(search.elapsedMs + source.elapsedMs),
        toolCalls: 2,
        success: TASK.targets.every((target) => combined.includes(target)),
        repo,
        raw: {
          coldIndex: coldResult.text,
          warmIndex: warmResult.text,
          search: searchText,
          source: sourceText,
        },
      };
    });
  } finally {
    if (isAstrograph) {
      const daemon = await readDaemonRuntime({ runtimeDir });
      if (daemon) {
        try {
          process.kill(daemon.pid, "SIGTERM");
        } catch {
          // The stdio session already stopped it.
        }
      }
      await rm(runtimeDir, { recursive: true, force: true });
    }
  }
}

export async function runComparison({ repoRoot, outputDir, runs }) {
  const absoluteOutputDir = path.resolve(repoRoot, outputDir);
  const rawDir = path.join(absoluteOutputDir, "raw");
  await mkdir(rawDir, { recursive: true });
  const runResults = [];

  for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
    for (const server of ["astrograph", "jcodemunch"]) {
      const storeRoot = await mkdtemp(path.join(os.tmpdir(), `${server}-bench-`));
      const result = await runServer({ server, repoRoot, storeRoot })
        .finally(() => rm(storeRoot, { recursive: true, force: true }));
      const { raw, ...metrics } = result;
      runResults.push(metrics);
      await writeFile(
        path.join(rawDir, `${server}-${runNumber}.json`),
        `${JSON.stringify({ ...metrics, raw }, null, 2)}\n`,
      );
    }
  }

  const repoSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const summaries = summarizeComparisonRuns(runResults);
  const results = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repoSha,
    tokenizer: BENCHMARK_TOKENIZER,
    task: TASK,
    runs: runResults,
    summaries,
  };
  await writeFile(
    path.join(absoluteOutputDir, "results.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  await writeFile(
    path.join(absoluteOutputDir, "report.md"),
    renderComparisonReport({ repoSha, tokenizer: BENCHMARK_TOKENIZER, taskId: TASK.id, summaries }),
  );
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseComparisonOptions(process.argv.slice(2));
  const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const results = await runComparison({ repoRoot, ...options });
  process.stdout.write(`${JSON.stringify({
    repoSha: results.repoSha,
    tokenizer: results.tokenizer,
    summaries: results.summaries,
  }, null, 2)}\n`);
}
