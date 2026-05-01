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
import { cac } from "cac";
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

function parseComparableVersion(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  const normalized = value[0] === "v" ? value.slice(1) : value;
  const match = normalized.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/,
  );

  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1] ?? "0", 10);
  const minor = Number.parseInt(match[2] ?? "0", 10);
  const patch = Number.parseInt(match[3] ?? "0", 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }

  const prerelease = match[4];
  if (!prerelease) {
    return {
      major,
      minor,
      patch,
      prerelease: null,
      alphaIncrement: null,
      raw: normalized,
    };
  }

  const alphaMatch = prerelease.match(/^alpha\.(\d+)$/);
  return {
    major,
    minor,
    patch,
    prerelease,
    alphaIncrement: alphaMatch && alphaMatch[1] ? Number.parseInt(alphaMatch[1], 10) : null,
    raw: normalized,
  };
}

function isVersionNewer(compareTo, base) {
  if (!compareTo || !base) {
    return false;
  }
  if (compareTo.major !== base.major) {
    return compareTo.major > base.major;
  }
  if (compareTo.minor !== base.minor) {
    return compareTo.minor > base.minor;
  }
  if (compareTo.patch !== base.patch) {
    return compareTo.patch > base.patch;
  }

  if (base.prerelease === null && compareTo.prerelease === null) {
    return false;
  }
  if (base.prerelease === null) {
    return false;
  }
  if (compareTo.prerelease === null) {
    return true;
  }

  if (
    base.prerelease.startsWith("alpha.")
    && compareTo.prerelease.startsWith("alpha.")
    && base.alphaIncrement !== null
    && compareTo.alphaIncrement !== null
  ) {
    return compareTo.alphaIncrement > base.alphaIncrement;
  }

  return compareTo.prerelease > base.prerelease;
}

function resolveLatestAstrographVersion() {
  try {
    const latest = execFileSync(
      "npm",
      ["view", PACKAGE_NAME, "version"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2_500,
      },
    ).trim();
    return parseComparableVersion(latest);
  } catch {
    return null;
  }
}

function emitUpdateSuggestion(currentVersion) {
  const latest = resolveLatestAstrographVersion();
  const current = parseComparableVersion(currentVersion);

  if (!latest || !current || !isVersionNewer(latest, current)) {
    return;
  }

  const suggestion = `npm install ${PACKAGE_NAME}@latest`;
  process.stderr.write(
    `A newer Astrograph version is available: ${latest.raw} (current: ${currentVersion}).\n` +
    `To update, run: ${suggestion}\n`,
  );
}


function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  npx @mortenbroesby/astrograph init [--yes] [--ide codex|copilot|copilot-cli|all|codex,copilot,...] [--mode barebones|some|full] [--repo /abs/repo] [--dry-run]",
      "",
      "  Interactive mode (default):",
      "  - Choose setup profile (barebones/some/full) in prompts",
      "    npx @mortenbroesby/astrograph init",
      "    npx @mortenbroesby/astrograph init --mode some --ide codex,copilot,copilot-cli --repo /abs/repo",
      "  Setup also ensures an Astrograph dependency is set to `latest` in package.json.",
      "  If missing, it adds `@mortenbroesby/astrograph: \"latest\"` to devDependencies.",
      "",
      "  Non-interactive mode:",
      "    npx @mortenbroesby/astrograph init --yes --ide copilot --mode full --repo /abs/repo [--dry-run]",
      "    npx @mortenbroesby/astrograph init --yes --ide all --mode some --repo /abs/repo [--dry-run]",
      "    npx @mortenbroesby/astrograph init --yes --ide codex,copilot --mode barebones --repo /abs/repo [--dry-run]",
    ].join("\n") + "\n",
  );
}

function parseArgs(argv) {
  const knownFlag = new Set(["--yes", "--dry-run", "--repo", "--ide", "--mode", "--help", "-h"]);
  for (const token of argv) {
    if (!token?.startsWith("-")) {
      continue;
    }

    if (token === "-h" || token === "--help") {
      continue;
    }

    const normalized = token.startsWith("--") && token.includes("=")
      ? token.slice(0, token.indexOf("="))
      : token;

    if (!normalized.startsWith("--")) {
      continue;
    }

    if (!knownFlag.has(normalized)) {
      throw new Error(`Unsupported argument ${normalized}`);
    }
  }

  const cli = cac("astrograph-init");

  cli
    .option("--yes", {
      type: Boolean,
      description: "Run setup without interactive prompts.",
    })
    .option("--dry-run", {
      type: Boolean,
      description: "Preview changes only.",
    })
    .option("--repo <path>", {
      description: "Repository root path for setup.",
      default: process.cwd(),
    })
    .option("--ide <ide-list>", {
      description: "Comma-separated list of IDEs to configure (codex|copilot|copilot-cli|all).",
    })
    .option("--mode <mode>", {
      description: "Profile mode (barebones|some|full).",
      default: DEFAULT_INSTALL_MODE,
    })
    .help("-h, --help");

  const parsed = cli.parse(argv, { run: false });

  if (parsed.options.help) {
    return {
      ides: null,
      repo: process.cwd(),
      dryRun: false,
      nonInteractive: false,
      mode: DEFAULT_INSTALL_MODE,
      hasExplicitArgs: false,
      showHelp: true,
    };
  }

  const hasFlag = (name) =>
    argv.includes(`--${name}`) || argv.some((token) => token.startsWith(`--${name}=`));

  return {
    ides: hasFlag("ide")
      ? parseIdeSelections(String(parsed.options.ide))
      : null,
    repo: parsed.options.repo ?? process.cwd(),
    dryRun: parsed.options.dryRun ?? false,
    nonInteractive: parsed.options.yes ?? false,
    mode: parsed.options.mode ?? DEFAULT_INSTALL_MODE,
    hasExplicitArgs:
      hasFlag("yes") ||
      hasFlag("dry-run") ||
      hasFlag("repo") ||
      hasFlag("ide") ||
      hasFlag("mode"),
  };
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

async function promptForSetupArgs() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive setup requires a TTY. Re-run with --yes --ide all|codex|copilot|copilot-cli [--repo /abs/repo] [--dry-run]",
    );
  }

  intro("Astrograph init");

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
    outro("Setup cancelled.");
    process.exit(0);
  }

  const selectedIdes = [...new Set(ides.filter((entry) => typeof entry === "string"))];

  if (selectedIdes.length === 0) {
    outro("Setup cancelled.");
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
    outro("Setup cancelled.");
    process.exit(0);
  }

  const mode = await select({
    message: "What setup profile should we set up?",
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
    outro("Setup cancelled.");
    process.exit(0);
  }

  const dryRun = await confirm({
    message: "Preview changes only?",
    initialValue: false,
  });

  if (isCancel(dryRun)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  outro("Running setup.", { withGuide: false });

  return {
    ides: selectedIdes,
    mode,
    repo,
    dryRun,
  };
}

function parseJsonFromString(raw, configPath) {
  if (!raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid package JSON: ${path.basename(configPath)} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function dependencyFieldHasAstrograph(pkgJson) {
  return Boolean(
    pkgJson.dependencies?.[PACKAGE_NAME]
    || pkgJson.devDependencies?.[PACKAGE_NAME]
    || pkgJson.optionalDependencies?.[PACKAGE_NAME]
  );
}

async function ensureAstrographDependencyInRepo(repoRoot, dryRun) {
  const packagePath = path.join(repoRoot, "package.json");
  let packageJsonRaw;
  try {
    packageJsonRaw = await readFile(packagePath, "utf8");
  } catch {
    return {
      packageDependencyUpdated: false,
      packageDependencyReason: "package.json not found",
    };
  }

  const parsed = parseJsonFromString(packageJsonRaw, packagePath);
  const hadAstrographDependency = dependencyFieldHasAstrograph(parsed);

  let didUpdate = false;
  const sections = ["dependencies", "devDependencies", "optionalDependencies"];
  const namesToSync = [PACKAGE_NAME];

  for (const section of sections) {
    const value = parsed[section];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    for (const depName of namesToSync) {
      if (Object.hasOwn(value, depName) && value[depName] !== "latest") {
        value[depName] = "latest";
        didUpdate = true;
      }
    }
  }

  if (!dependencyFieldHasAstrograph(parsed)) {
    if (!parsed.devDependencies || typeof parsed.devDependencies !== "object" || Array.isArray(parsed.devDependencies)) {
      parsed.devDependencies = {};
    }
    parsed.devDependencies[PACKAGE_NAME] = "latest";
    didUpdate = true;
  }

  if (!didUpdate) {
    return {
      packageDependencyUpdated: false,
      packageDependencyReason: "dependency already at latest",
    };
  }

  const packageDependencyReason = hadAstrographDependency
    ? "updated Astrograph dependency to latest"
    : "added @mortenbroesby/astrograph@latest";

  if (dryRun) {
    return {
      packageDependencyUpdated: false,
      packageDependencyReason: `would ${packageDependencyReason}`,
      packageDependencyPreview: parsed,
    };
  }

  await writeFile(packagePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return {
    packageDependencyUpdated: true,
    packageDependencyReason,
    packageDependencyPreview: parsed,
  };
}

function validateIdes(args) {
  if (!Array.isArray(args.ides) || args.ides.length === 0) {
    throw new Error(
      "Astrograph init requires at least one --ide value",
    );
  }

  if (args.ides.includes("all")) {
    args.ides = ALL_INSTALL_IDES;
    return args;
  }

  for (const ide of args.ides) {
    if (!INSTALL_IDE_KEYWORDS.includes(ide)) {
      throw new Error(
        "Astrograph init supports --ide codex, --ide copilot, --ide copilot-cli, and --ide all",
      );
    }
  }

  return args;
}

function validateMode(args) {
  if (!INSTALL_MODES.includes(args.mode)) {
    throw new Error(
      "Astrograph init supports --mode barebones, --mode some, and --mode full",
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

export async function setupForIde(
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

export async function setupForCodex(
  repoRoot,
  { mode = DEFAULT_INSTALL_MODE, dryRun = false } = {},
) {
  return setupForIde(repoRoot, { ide: "codex", mode, dryRun });
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
    : await promptForSetupArgs();

  const result = await setupForAllIdes(args.repo, {
    ides: args.ides,
    mode: args.mode,
    dryRun: args.dryRun,
  });

  emitUpdateSuggestion(PACKAGE_VERSION);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export async function setupForAllIdes(
  repoRoot,
  { ides = ["copilot"], mode = DEFAULT_INSTALL_MODE, dryRun = false } = {},
) {
  const normalizedIdes = validateIdes({ ides }).ides;
  const normalizedMode = validateMode({ mode }).mode;
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const packageDependency = await ensureAstrographDependencyInRepo(resolvedRepoRoot, dryRun);

  const results = [];

  for (const ide of normalizedIdes) {
    const result = await setupForIde(resolvedRepoRoot, {
      ide,
      mode: normalizedMode,
      dryRun,
    });
    results.push({
      ...result,
      packageDependencyUpdated: packageDependency.packageDependencyUpdated,
      packageDependencyReason: packageDependency.packageDependencyReason,
      packageDependencyPreview: packageDependency.packageDependencyPreview,
    });
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
