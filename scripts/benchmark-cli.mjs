#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = packageRoot;

const EXCLUDED_SEGMENTS = new Set([
  ".astrograph",
  ".stryker-tmp",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
]);

function parseArgs(argv) {
  const args = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, next);
    index += 1;
  }

  return {
    repoRoot: args.get("repo"),
    runs: Number(args.get("runs") ?? "10"),
    warmup: Number(args.get("warmup") ?? "2"),
  };
}

function shellEscape(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function requireBinary(name) {
  const result = spawnSync("command", ["-v", name], {
    cwd: workspaceRoot,
    shell: true,
    encoding: "utf8",
  });

  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }

  throw new Error(
    `Required benchmark binary not found: ${name}. Install it first, for example with 'brew install hyperfine'.`,
  );
}

async function copyCleanRepo(sourceRoot) {
  const benchRoot = await mkdtemp(
    path.join(os.tmpdir(), "ai-context-engine-clibench-"),
  );
  const targetRoot = path.join(benchRoot, "repo");

  await cp(sourceRoot, targetRoot, {
    recursive: true,
    filter(sourcePath) {
      const segment = path.basename(sourcePath);
      return !EXCLUDED_SEGMENTS.has(segment) && segment !== "tsconfig.tsbuildinfo";
    },
  });

  spawnSync("git", ["init"], {
    cwd: targetRoot,
    stdio: ["ignore", "ignore", "ignore"],
  });

  return targetRoot;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${stderr || stdout || "Unknown error"}`,
    );
  }

  return result;
}

async function benchmarkCli(repoRoot, options) {
  requireBinary("hyperfine");

  const resolvedRepoRoot = path.resolve(repoRoot);
  await rm(path.join(resolvedRepoRoot, ".astrograph"), {
    recursive: true,
    force: true,
  });

  runCommand("pnpm", [
    "exec",
    "ai-context-engine",
    "cli",
    "index-folder",
    "--repo",
    resolvedRepoRoot,
  ]);

  const searchSeed = JSON.parse(
    runCommand("pnpm", [
      "exec",
      "ai-context-engine",
      "cli",
      "search-symbols",
      "--repo",
      resolvedRepoRoot,
      "--query",
      "getRankedContext",
      "--language",
      "ts",
      "--file-pattern",
      "src/*.ts",
      "--limit",
      "5",
    ]).stdout,
  );
  const symbolIds = searchSeed.slice(0, 2).map((entry) => entry.id);
  if (symbolIds.length < 2) {
    throw new Error("Unable to seed CLI symbol-source benchmark with two indexed symbols");
  }

  const exportFile = path.join(
    await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-hyperfine-")),
    "hyperfine-results.json",
  );

  const commands = [
    {
      name: "diagnostics metadata",
      command: `pnpm exec astrograph cli diagnostics --repo ${shellEscape(resolvedRepoRoot)}`,
    },
    {
      name: "diagnostics scan",
      command: `pnpm exec astrograph cli diagnostics --repo ${shellEscape(resolvedRepoRoot)} --scan-freshness`,
    },
    {
      name: "search symbols",
      command: `pnpm exec astrograph cli search-symbols --repo ${shellEscape(resolvedRepoRoot)} --query getRankedContext --language ts --file-pattern 'src/*.ts' --limit 5`,
    },
    {
      name: "get symbol source",
      command: `pnpm exec astrograph cli get-symbol-source --repo ${shellEscape(resolvedRepoRoot)} --symbols ${shellEscape(symbolIds.join(","))} --context-lines 2`,
    },
    {
      name: "get ranked context",
      command: `pnpm exec astrograph cli get-ranked-context --repo ${shellEscape(resolvedRepoRoot)} --query getRankedContext --budget 200`,
    },
  ];

  runCommand("hyperfine", [
    "--runs",
    String(options.runs),
    "--warmup",
    String(options.warmup),
    "--export-json",
    exportFile,
    ...commands.flatMap((entry) => ["--command-name", entry.name, entry.command]),
  ]);

  const raw = JSON.parse(await readFile(exportFile, "utf8"));

  return {
    benchmarkTool: "hyperfine",
    runs: options.runs,
    warmup: options.warmup,
    repoRoot: resolvedRepoRoot,
    results: raw.results.map((entry) => ({
      command: entry.command,
      meanMs: Math.round(entry.mean * 1000 * 10) / 10,
      stddevMs: Math.round(entry.stddev * 1000 * 10) / 10,
      medianMs: Math.round(entry.median * 1000 * 10) / 10,
      minMs: Math.round(entry.min * 1000 * 10) / 10,
      maxMs: Math.round(entry.max * 1000 * 10) / 10,
      userMs: Math.round(entry.user * 1000 * 10) / 10,
      systemMs: Math.round(entry.system * 1000 * 10) / 10,
    })),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const benchmarkRepoRoot = options.repoRoot
    ? path.resolve(options.repoRoot)
    : await copyCleanRepo(packageRoot);
  const result = await benchmarkCli(benchmarkRepoRoot, options);
  console.log(JSON.stringify(result, null, 2));
}

await main();
