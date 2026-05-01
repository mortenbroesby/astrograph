#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  isCancel,
  intro,
  multiselect,
  outro,
  select,
  text,
  confirm,
} from "@clack/prompts";
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
const ALL_INSTALL_IDES = ["codex", "copilot", "copilot-cli"];
const INSTALL_IDE_KEYWORDS = [...ALL_INSTALL_IDES, "all"];
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
const INSTALL_MODES = ["barebones", "some", "full"];
const MCP_TOOL_PROFILE = {
  barebones: [
    "query_code",
    "get_file_tree",
    "get_file_outline",
  ],
  some: [
    "query_code",
    "get_file_tree",
    "get_file_outline",
    "get_repo_outline",
    "suggest_initial_queries",
  ],
  full: MCP_TOOLS,
};
const DEFAULT_INSTALL_MODE = "full";

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  npx @mortenbroesby/astrograph install [--yes] [--ide codex|copilot|copilot-cli|all|codex,copilot,...] [--mode barebones|some|full] [--repo /abs/repo] [--dry-run]",
      "",
      "  Interactive mode (default):",
      "  - Choose install profile (barebones/some/full) in prompts",
      "    npx @mortenbroesby/astrograph install",
      "    npx @mortenbroesby/astrograph install --mode some --ide codex,copilot,copilot-cli --repo /abs/repo",
      "",
      "  Non-interactive mode:",
      "    npx @mortenbroesby/astrograph install --yes --ide copilot --mode full --repo /abs/repo [--dry-run]",
      "    npx @mortenbroesby/astrograph install --yes --ide all --mode some --repo /abs/repo [--dry-run]",
      "    npx @mortenbroesby/astrograph install --yes --ide codex,copilot --mode barebones --repo /abs/repo [--dry-run]",
    ].join("\n") + "\n",
  );
}

function parseArgs(argv) {
  const args = {
    ides: null,
    repo: process.cwd(),
    dryRun: false,
    nonInteractive: false,
    mode: DEFAULT_INSTALL_MODE,
    hasExplicitArgs: false,
  };

  const isKnownFlag = new Set([
    "dry-run",
    "yes",
    "repo",
    "ide",
    "mode",
    "help",
    "h",
  ]);

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
      args.ides = parseIdeSelections(value);
      args.hasExplicitArgs = true;
    } else if (key === "repo") {
      args.repo = value;
      args.hasExplicitArgs = true;
    } else if (key === "mode") {
      args.mode = value;
      args.hasExplicitArgs = true;
    } else {
      throw new Error(`Unsupported argument --${key}`);
    }

    index += 1;
  }

  return args;
}

function parseIdeSelections(raw) {
  if (!raw || typeof raw !== "string") {
    return [];
  }

  const requested = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const deduped = [...new Set(requested)];
  if (deduped.length === 0) {
    return [];
  }

  if (deduped.includes("all")) {
    return ALL_INSTALL_IDES;
  }

  return deduped;
}

async function promptForInstallArgs() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive install requires a TTY. Re-run with --yes --ide all|codex|copilot|copilot-cli [--repo /abs/repo] [--dry-run]",
    );
  }

  intro("Astrograph install");

  const ides = await multiselect({
    message: "Which IDEs do you want to configure?",
    options: [
      {
        value: "all",
        label: "All",
        hint: "Configure all supported IDEs at once",
      },
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
    required: true,
  });

  if (isCancel(ides)) {
    outro("Install cancelled.");
    process.exit(0);
  }

  const selectedIdes = [...new Set(ides.filter((entry) => typeof entry === "string"))];

  if (selectedIdes.length === 0) {
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

  const mode = await select({
    message: "What install profile should we set up?",
    options: [
      {
        value: "full",
        label: "Full (batteries included)",
        hint: "Recommended default for most users. Includes all Astrograph MCP tools and diagnostics.",
      },
      {
        value: "some",
        label: "Some",
        hint: "Query-focused workflow with suggested queries, but no deep diagnostics and index-management defaults.",
      },
      {
        value: "barebones",
        label: "Barebones",
        hint: "Smallest MCP tool footprint. Query + file discovery only.",
      },
    ],
  });

  if (isCancel(mode)) {
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
    ides: selectedIdes,
    mode,
    repo,
    dryRun,
  };
}

function validateIdes(args) {
  if (!Array.isArray(args.ides) || args.ides.length === 0) {
    throw new Error(
      "Astrograph install requires at least one --ide value",
    );
  }

  if (args.ides.includes("all")) {
    args.ides = ALL_INSTALL_IDES;
    return args;
  }

  for (const ide of args.ides) {
    if (!INSTALL_IDE_KEYWORDS.includes(ide)) {
      throw new Error(
        "Astrograph install supports --ide codex, --ide copilot, --ide copilot-cli, and --ide all",
      );
    }
  }

  return args;
}

function validateMode(args) {
  if (!INSTALL_MODES.includes(args.mode)) {
    throw new Error(
      "Astrograph install supports --mode barebones, --mode some, and --mode full",
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

function resolveToolSet(mode = DEFAULT_INSTALL_MODE) {
  return MCP_TOOL_PROFILE[mode] ?? MCP_TOOL_PROFILE.full;
}

function astrographConfigBlock(mode = DEFAULT_INSTALL_MODE) {
  const enabledTools = resolveToolSet(mode).map((tool) => `"${tool}"`).join(", ");
  const toolApprovals = resolveToolSet(mode).map((tool) =>
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

function managedConfigForCopilot(ide, mode = DEFAULT_INSTALL_MODE) {
  const invocation = resolveManagedInvocation();
  const toolSet = resolveToolSet(mode);

  if (ide === "copilot-cli") {
    return {
      type: "local",
      command: invocation.command,
      args: invocation.args,
      cwd: ".",
      tools: toolSet,
    };
  }

  return {
    type: "stdio",
    command: invocation.command,
    args: invocation.args,
    cwd: ".",
  };
}

function resolveManagedConfig(ide, repoRoot, currentContents, mode = DEFAULT_INSTALL_MODE) {
  if (ide === "codex") {
    return {
      configPath: path.join(repoRoot, ".codex", "config.toml"),
      nextContents: replaceManagedBlock(
        currentContents,
        astrographConfigBlock(mode),
      ),
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
      managedConfigForCopilot(ide, mode),
    ),
  };
}

export async function installForIde(
  repoRoot,
  { ide = "copilot", mode = DEFAULT_INSTALL_MODE, dryRun = false } = {},
) {
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const { configPath } = resolveManagedConfig(
    ide,
    resolvedRepoRoot,
    "",
    mode,
  );
  const currentContents = await readFile(configPath, "utf8").catch(() => "");
  const { configPath: finalConfigPath, nextContents } = resolveManagedConfig(
    ide,
    resolvedRepoRoot,
    currentContents,
    mode,
  );

  if (!dryRun) {
    await mkdir(path.dirname(finalConfigPath), { recursive: true });
    await writeFile(finalConfigPath, nextContents, "utf8");
  }

  return {
    ide,
    mode,
    repoRoot: resolvedRepoRoot,
    configPath: finalConfigPath,
    packageName: PACKAGE_NAME,
    packageVersion: PACKAGE_VERSION,
    configPreview: nextContents,
    localDependencyDetected: hasLocalAstrographDependency(resolvedRepoRoot),
  };
}

export async function installForCodex(
  repoRoot,
  { mode = DEFAULT_INSTALL_MODE, dryRun = false } = {},
) {
  return installForIde(repoRoot, { ide: "codex", mode, dryRun });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.showHelp) {
    usage();
    return;
  }

  const normalizedArgs = {
    ...parsed,
    ides: parsed.ides || ["copilot"],
    mode: parsed.mode || DEFAULT_INSTALL_MODE,
    repo: parsed.repo || process.cwd(),
  };

  const args = parsed.hasExplicitArgs || parsed.nonInteractive
    ? validateMode(validateIdes(normalizedArgs))
    : await promptForInstallArgs();

  const result = await installForAllIdes(args.repo, {
    ides: args.ides,
    mode: args.mode,
    dryRun: args.dryRun,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export async function installForAllIdes(
  repoRoot,
  { ides = ["copilot"], mode = DEFAULT_INSTALL_MODE, dryRun = false } = {},
) {
  const normalizedIdes = validateIdes({ ides }).ides;
  const normalizedMode = validateMode({ mode }).mode;

  const results = [];

  for (const ide of normalizedIdes) {
    const result = await installForIde(repoRoot, {
      ide,
      mode: normalizedMode,
      dryRun,
    });
    results.push(result);
  }

  return normalizedIdes.length === 1 ? results[0] : results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    usage();
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
