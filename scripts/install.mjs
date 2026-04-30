#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MARKER_BEGIN = "# BEGIN ASTROGRAPH";
const MARKER_END = "# END ASTROGRAPH";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
);
const PACKAGE_NAME = packageJson.name;
const PACKAGE_VERSION = packageJson.version;
const LEGACY_PACKAGE_NAME = "astrograph";
const MCP_TOOLS = [
  "index_folder",
  "index_file",
  "get_file_outline",
  "get_file_tree",
  "get_repo_outline",
  "suggest_initial_queries",
  "query_code",
  "diagnostics",
];

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  npx @mortenbroesby/astrograph install --ide codex [--repo /abs/repo] [--dry-run]",
    ].join("\n") + "\n",
  );
}

function parseArgs(argv) {
  const args = {
    ide: null,
    repo: process.cwd(),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for argument --${key}`);
    }

    if (key === "ide") {
      args.ide = value;
    } else if (key === "repo") {
      args.repo = value;
    } else {
      throw new Error(`Unsupported argument --${key}`);
    }

    index += 1;
  }

  if (args.ide !== "codex") {
    throw new Error("Astrograph install currently supports only --ide codex");
  }

  return args;
}

function resolveRepoRoot(repoRoot) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: absoluteRepoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return absoluteRepoRoot;
  }
}

function hasLocalAstrographDependency(repoRoot) {
  try {
    const packageData = JSON.parse(
      execFileSync("node", ["-e", "process.stdout.write(require('fs').readFileSync('package.json','utf8'))"], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );

    return Boolean(
      packageData.dependencies?.[PACKAGE_NAME]
      || packageData.devDependencies?.[PACKAGE_NAME]
      || packageData.optionalDependencies?.[PACKAGE_NAME]
      || packageData.dependencies?.[LEGACY_PACKAGE_NAME]
      || packageData.devDependencies?.[LEGACY_PACKAGE_NAME]
      || packageData.optionalDependencies?.[LEGACY_PACKAGE_NAME],
    );
  } catch {
    return false;
  }
}

function resolveManagedInvocation() {
  return {
    command: "npx",
    args: [PACKAGE_NAME, "mcp"],
  };
}

function astrographConfigBlock(repoRoot) {
  const enabledTools = MCP_TOOLS.map((tool) => `"${tool}"`).join(", ");
  const toolApprovals = MCP_TOOLS.map((tool) =>
    `[mcp_servers.astrograph.tools.${tool}]\napproval_mode = "approve"`,
  ).join("\n\n");
  const invocation = resolveManagedInvocation();
  const args = invocation.args.map((arg) => `"${arg}"`).join(", ");

  return `${MARKER_BEGIN}
[mcp_servers.astrograph]
command = "${invocation.command}"
args = [${args}]
cwd = "."
startup_timeout_sec = 90
enabled_tools = [${enabledTools}]

${toolApprovals}
${MARKER_END}`;
}

function replaceManagedBlock(contents, block) {
  if (contents.includes(MARKER_BEGIN) && contents.includes(MARKER_END)) {
    return contents.replace(
      new RegExp(`${MARKER_BEGIN}[\\s\\S]*?${MARKER_END}`, "m"),
      `${block}\n`,
    );
  }

  const legacyBlockPattern =
    /^\[mcp_servers\.astrograph\][\s\S]*?(?=^\[(?!mcp_servers\.astrograph\b).+\]|\Z)/m;

  if (legacyBlockPattern.test(contents)) {
    return contents.replace(legacyBlockPattern, `${block}\n\n`);
  }

  const normalized = contents.trimEnd();
  return normalized.length === 0 ? `${block}\n` : `${normalized}\n\n${block}\n`;
}

export async function installForCodex(repoRoot, { dryRun = false } = {}) {
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const codexDir = path.join(resolvedRepoRoot, ".codex");
  const configPath = path.join(codexDir, "config.toml");
  const currentContents = await readFile(configPath, "utf8").catch(() => "");
  const nextContents = replaceManagedBlock(currentContents, astrographConfigBlock(resolvedRepoRoot));

  if (!dryRun) {
    await mkdir(codexDir, { recursive: true });
    await writeFile(configPath, nextContents, "utf8");
  }

  return {
    ide: "codex",
    repoRoot: resolvedRepoRoot,
    configPath,
    packageName: PACKAGE_NAME,
    packageVersion: PACKAGE_VERSION,
    configPreview: nextContents,
    localDependencyDetected: hasLocalAstrographDependency(resolvedRepoRoot),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await installForCodex(args.repo, {
    dryRun: args.dryRun,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    usage();
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
