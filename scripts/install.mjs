#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isCancel, intro, outro, select, text, confirm } from "@clack/prompts";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MARKER_BEGIN = "# BEGIN ASTROGRAPH";
const MARKER_END = "# END ASTROGRAPH";
const MCP_SERVER_NAME = "astrograph";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
);
const PACKAGE_NAME = packageJson.name;
const PACKAGE_VERSION = packageJson.version;
const LEGACY_PACKAGE_NAME = "astrograph";
const VALID_INSTALL_IDES = ["codex", "copilot", "copilot-cli"];
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
      "  npx @mortenbroesby/astrograph install [--yes] [--ide codex|copilot|copilot-cli] [--repo /abs/repo] [--dry-run]",
      "",
      "  Interactive mode (default):",
      "    npx @mortenbroesby/astrograph install",
      "",
      "  Non-interactive mode:",
      "    npx @mortenbroesby/astrograph install --yes --ide copilot --repo /abs/repo [--dry-run]",
      "    npx @mortenbroesby/astrograph install --yes --ide codex --repo /abs/repo [--dry-run]",
      "    npx @mortenbroesby/astrograph install --yes --ide copilot-cli --repo /abs/repo [--dry-run]",
    ].join("\n") + "\n",
  );
}

function parseArgs(argv) {
  const args = {
    ide: null,
    repo: process.cwd(),
    dryRun: false,
    nonInteractive: false,
    hasExplicitArgs: false,
  };

  const isKnownFlag = new Set(["dry-run", "yes", "repo", "ide", "help", "h"]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      return { ...args, showHelp: true };
    }

    if (token === "--dry-run") {
      args.dryRun = true;
      args.hasExplicitArgs = true;
      continue;
    }

    if (token === "--yes") {
      args.nonInteractive = true;
      args.hasExplicitArgs = true;
      continue;
    }

    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    if (!isKnownFlag.has(key)) {
      throw new Error(`Unsupported argument --${key}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for argument --${key}`);
    }

    if (key === "ide") {
      args.ide = value;
      args.hasExplicitArgs = true;
    } else if (key === "repo") {
      args.repo = value;
      args.hasExplicitArgs = true;
    } else {
      throw new Error(`Unsupported argument --${key}`);
    }

    index += 1;
  }

  return args;
}

async function promptForInstallArgs() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive install requires a TTY. Re-run with --yes --ide codex|copilot|copilot-cli [--repo /abs/repo] [--dry-run]",
    );
  }

  intro("Astrograph install");

  const ide = await select({
    message: "Which IDE do you want to configure?",
    options: [
      {
        value: "codex",
        label: "Codex",
        hint: "writes .codex/config.toml",
      },
      {
        value: "copilot",
        label: "GitHub Copilot",
        hint: "writes .vscode/mcp.json",
      },
      {
        value: "copilot-cli",
        label: "GitHub Copilot CLI",
        hint: "writes .mcp.json",
      },
    ],
  });

  if (isCancel(ide)) {
    outro("Install cancelled.");
    process.exit(0);
  }

  const repo = await text({
    message: "Repository root",
    placeholder: process.cwd(),
    defaultValue: process.cwd(),
    validate: (value) => {
      if (!value) return "Repository root is required";
      if (typeof value !== "string") return "Invalid repository path";
      return undefined;
    },
  });

  if (isCancel(repo)) {
    outro("Install cancelled.");
    process.exit(0);
  }

  const dryRun = await confirm({
    message: "Preview changes only?",
    initialValue: false,
  });

  if (isCancel(dryRun)) {
    outro("Install cancelled.");
    process.exit(0);
  }

  outro("Running install.", { withGuide: false });

  return {
    ide,
    repo,
    dryRun,
  };
}

function validateIde(args) {
  if (!VALID_INSTALL_IDES.includes(args.ide)) {
    throw new Error(
      "Astrograph install supports --ide codex, --ide copilot, and --ide copilot-cli",
    );
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

function astrographConfigBlock() {
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

function parseJsonConfig(contents, configPath) {
  if (!contents.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(contents);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid JSON config file: ${path.basename(configPath)} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function replaceManagedServerInJson(contents, configPath, rootKey, managedServer) {
  const parsed = parseJsonConfig(contents, configPath);
  const existing = parsed[rootKey];

  if (existing != null && (typeof existing !== "object" || Array.isArray(existing))) {
    throw new Error(`Invalid ${rootKey} entry in ${path.basename(configPath)}`);
  }

  const nextServers = {
    ...(existing == null || typeof existing !== "object" ? {} : existing),
    [MCP_SERVER_NAME]: managedServer,
  };

  return JSON.stringify(
    {
      ...parsed,
      [rootKey]: nextServers,
    },
    null,
    2,
  ) + "\n";
}

function managedConfigForCopilot(ide) {
  const invocation = resolveManagedInvocation();

  if (ide === "copilot-cli") {
    return {
      type: "local",
      command: invocation.command,
      args: invocation.args,
      cwd: ".",
      tools: ["*"],
    };
  }

  return {
    type: "stdio",
    command: invocation.command,
    args: invocation.args,
    cwd: ".",
  };
}

function resolveManagedConfig(ide, repoRoot, currentContents) {
  if (ide === "codex") {
    return {
      configPath: path.join(repoRoot, ".codex", "config.toml"),
      nextContents: replaceManagedBlock(currentContents, astrographConfigBlock()),
    };
  }

  const configPath =
    ide === "copilot"
      ? path.join(repoRoot, ".vscode", "mcp.json")
      : path.join(repoRoot, ".mcp.json");
  const rootKey = ide === "copilot" ? "servers" : "mcpServers";

  return {
    configPath,
    nextContents: replaceManagedServerInJson(
      currentContents,
      configPath,
      rootKey,
      managedConfigForCopilot(ide),
    ),
  };
}

export async function installForIde(
  repoRoot,
  { ide = "copilot", dryRun = false } = {},
) {
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const { configPath } = resolveManagedConfig(
    ide,
    resolvedRepoRoot,
    "",
  );
  const currentContents = await readFile(configPath, "utf8").catch(() => "");
  const { configPath: finalConfigPath, nextContents } = resolveManagedConfig(
    ide,
    resolvedRepoRoot,
    currentContents,
  );

  if (!dryRun) {
    await mkdir(path.dirname(finalConfigPath), { recursive: true });
    await writeFile(finalConfigPath, nextContents, "utf8");
  }

  return {
    ide,
    repoRoot: resolvedRepoRoot,
    configPath: finalConfigPath,
    packageName: PACKAGE_NAME,
    packageVersion: PACKAGE_VERSION,
    configPreview: nextContents,
    localDependencyDetected: hasLocalAstrographDependency(resolvedRepoRoot),
  };
}

export async function installForCodex(repoRoot, { dryRun = false } = {}) {
  return installForIde(repoRoot, { ide: "codex", dryRun });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.showHelp) {
    usage();
    return;
  }

  const normalizedArgs = {
    ...parsed,
    ide: parsed.ide || "copilot",
    repo: parsed.repo || process.cwd(),
  };

  const args = parsed.hasExplicitArgs || parsed.nonInteractive
    ? validateIde(normalizedArgs)
    : await promptForInstallArgs();

  const result = await installForIde(args.repo, {
    ide: args.ide,
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
