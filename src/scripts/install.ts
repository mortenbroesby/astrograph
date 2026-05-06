#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  isCancel,
  intro,
  outro,
  select,
  confirm,
} from "@clack/prompts";
import { Command, Option } from "commander";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  type McpRuntimeProfile,
  getMcpToolsForProfile,
  parseMcpProfile,
} from "../mcp-profiles.ts";

const MARKER_BEGIN = "# BEGIN ASTROGRAPH";
const MARKER_END = "# END ASTROGRAPH";
const AGENTS_POLICY_BEGIN = "<!-- BEGIN ASTROGRAPH CODE EXPLORATION POLICY -->";
const AGENTS_POLICY_END = "<!-- END ASTROGRAPH CODE EXPLORATION POLICY -->";
const MCP_SERVER_NAME = "astrograph";
const DEFAULT_MCP_PROFILE: McpRuntimeProfile = "full";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const packageJson = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
) as {
  name: string;
  version: string;
};
const PACKAGE_NAME = packageJson.name;
const PACKAGE_VERSION = packageJson.version;
const ALL_INSTALL_IDES = ["codex", "copilot", "copilot-cli"] as const;
const INSTALL_IDE_KEYWORDS = [...ALL_INSTALL_IDES, "all"] as const;
const DEFAULT_INSTALL_IDES: RequestedIde[] = ["codex"];

type InstallIde = (typeof ALL_INSTALL_IDES)[number];
type RequestedIde = InstallIde | "all";
type InstalledObject = Record<string, unknown>;

interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
  alphaIncrement: number | null;
  raw: string;
}

interface ParsedArgs {
  ides: RequestedIde[] | null;
  repo: string;
  dryRun: boolean;
  nonInteractive: boolean;
  agentsPolicy: boolean;
  mcpProfile: McpRuntimeProfile;
  hasExplicitArgs: boolean;
  showHelp: boolean;
}

interface PackageJsonFile {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  [key: string]: unknown;
}

interface PackageDependencyResult {
  packageDependencyUpdated: boolean;
  packageDependencyReason: string;
  packageDependencyPreview?: PackageJsonFile;
}

interface SetupResult {
  ide: InstallIde;
  mcpProfile: McpRuntimeProfile;
  repoRoot: string;
  configPath: string;
  engineConfigPath: string;
  packageName: string;
  packageVersion: string;
  configPreview: string;
  engineConfigPreview: string;
  localDependencyDetected: boolean;
  packageDependencyUpdated: boolean;
  packageDependencyReason: string;
  packageDependencyPreview?: PackageJsonFile;
  agentsPolicyPath: string;
  agentsPolicyUpdated: boolean;
  agentsPolicyReason: string;
  agentsPolicyPreview?: string;
}

interface CliOptions {
  ide?: string;
  dryRun?: boolean;
  repo?: string;
  yes?: boolean;
  agents?: boolean;
  mcpProfile?: string;
  help?: boolean;
}

interface ManagedInvocation {
  command: string;
  args: string[];
}

interface ManagedConfig {
  configPath: string;
  nextContents: string;
}

interface SetupForIdeOptions {
  ide?: InstallIde;
  dryRun?: boolean;
  mcpProfile?: McpRuntimeProfile;
}

interface SetupForAllOptions {
  ides?: RequestedIde[];
  dryRun?: boolean;
  agentsPolicy?: boolean;
  mcpProfile?: McpRuntimeProfile;
}

interface AgentsPolicyResult {
  agentsPolicyPath: string;
  agentsPolicyUpdated: boolean;
  agentsPolicyReason: string;
  agentsPolicyPreview?: string;
}

function parseComparableVersion(rawValue: unknown): ParsedSemVer | null {
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
  if (
    !Number.isFinite(major)
    || !Number.isFinite(minor)
    || !Number.isFinite(patch)
  ) {
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
    alphaIncrement: alphaMatch && alphaMatch[1]
      ? Number.parseInt(alphaMatch[1], 10)
      : null,
    raw: normalized,
  };
}

function isVersionNewer(
  compareTo: ParsedSemVer | null,
  base: ParsedSemVer | null,
): boolean {
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

function resolveLatestAstrographVersion(): ParsedSemVer | null {
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

function emitUpdateSuggestion(currentVersion: string): void {
  const latest = resolveLatestAstrographVersion();
  const current = parseComparableVersion(currentVersion);

  if (!latest || !current || !isVersionNewer(latest, current)) {
    return;
  }

  const suggestion = `npm install ${PACKAGE_NAME}@latest`;
  process.stderr.write(
    `A newer Astrograph version is available: ${latest.raw} (current: ${currentVersion}).\n` +
    `To update, run: ${suggestion}\n` +
    `If you see stale behavior after update, clear local state and rebuild index:\n` +
    `  rm -rf .astrograph\n  astrograph init --yes\n`,
  );
}

function usage(): void {
  process.stderr.write(
    [
      "Usage:",
      "  npx astrograph init [--yes] [--agents] [--ide codex|copilot|copilot-cli|all|codex,copilot,...] [--mcp-profile core|standard|full] [--repo /abs/repo] [--dry-run]",
      "",
      "Defaults:",
      "  - repo: current git worktree, or current directory",
      "  - IDE: Codex",
      "  - MCP profile: full",
      "  - writes: astrograph.config.ts and managed MCP config",
      "  - optional: --agents adds a tailored agent instruction file for each IDE:",
      "      codex       → AGENTS.md",
      "      copilot     → .github/copilot-instructions.md",
      "      copilot-cli → AGENTS.md",
      "  - ensures: astrograph is set to latest in package.json when package.json exists",
      "",
      "Examples:",
      "  npx astrograph init",
      "  npx astrograph init --yes",
      "  npx astrograph init --yes --ide all",
      "  npx astrograph init --mcp-profile standard --yes --ide all",
    ].join("\n") + "\n",
  );
}

function isInstallIde(value: string): boolean {
  return value === "codex" || value === "copilot" || value === "copilot-cli";
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    return {
      ides: null,
      repo: process.cwd(),
      dryRun: false,
      nonInteractive: false,
      agentsPolicy: false,
      mcpProfile: DEFAULT_MCP_PROFILE,
      hasExplicitArgs: false,
      showHelp: true,
    };
  }

  const knownFlag = new Set<string>([
    "--yes",
    "--agents",
    "--dry-run",
    "--mcp-profile",
    "--repo",
    "--ide",
    "--help",
    "-h",
  ]);
  for (const token of argv) {
    if (!token.startsWith("-")) {
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

  const program = new Command("astrograph init")
    .allowUnknownOption(false)
    .exitOverride()
    .helpOption("-h, --help", "Show setup help.")
    .addOption(new Option("--yes", "Run setup with defaults and without prompts."))
    .addOption(new Option("--agents", "Add a tailored agent instruction file for the selected IDE."))
    .addOption(new Option("--dry-run", "Preview changes only."))
    .addOption(new Option("--repo <path>", "Repository root path for setup.").default(process.cwd()))
    .addOption(
      new Option(
        "--mcp-profile <profile>",
        "Runtime profile for managed MCP invocation (core|standard|full).",
      )
        .default(DEFAULT_MCP_PROFILE),
    )
    .addOption(new Option("--ide <ide-list>", "Comma-separated IDE list.").default(undefined));

  let options: CliOptions;
  try {
    program.parse(["node", "astrograph-init", ...argv], { from: "node" });
    options = program.opts<CliOptions>();
  } catch (error) {
    const commanderError = error as { code?: string; message?: string };
    if (commanderError.code === "commander.helpDisplayed") {
      return {
        ides: null,
        repo: process.cwd(),
        dryRun: false,
        nonInteractive: false,
        agentsPolicy: false,
        mcpProfile: DEFAULT_MCP_PROFILE,
        hasExplicitArgs: false,
        showHelp: true,
      };
    }
    throw new Error(commanderError.message ?? String(error));
  }

  if (options.help) {
    return {
      ides: null,
      repo: process.cwd(),
      dryRun: false,
      nonInteractive: false,
      agentsPolicy: false,
      mcpProfile: DEFAULT_MCP_PROFILE,
      hasExplicitArgs: false,
      showHelp: true,
    };
  }

  const parsedProfile = options.mcpProfile
    ? parseMcpProfile(options.mcpProfile)
    : DEFAULT_MCP_PROFILE;
  if (options.mcpProfile && !parsedProfile) {
    throw new Error(
      `Unsupported --mcp-profile value: ${options.mcpProfile}. Expected: core, standard, full`,
    );
  }

  const hasFlag = (name: string): boolean =>
    argv.includes(`--${name}`) || argv.some((token) => token.startsWith(`--${name}=`));

  return {
    ides: hasFlag("ide")
      ? parseIdeSelections(options.ide)
      : null,
    repo: options.repo ?? process.cwd(),
    mcpProfile: parsedProfile ?? DEFAULT_MCP_PROFILE,
    dryRun: Boolean(options.dryRun),
    nonInteractive: Boolean(options.yes),
    agentsPolicy: Boolean(options.agents),
    hasExplicitArgs:
      hasFlag("yes") ||
      hasFlag("agents") ||
      hasFlag("dry-run") ||
      hasFlag("mcp-profile") ||
      hasFlag("repo") ||
      hasFlag("ide"),
    showHelp: false,
  };
}

function parseIdeSelections(raw: string | undefined): RequestedIde[] {
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
    return [...ALL_INSTALL_IDES];
  }

  const unexpected = deduped.filter((entry): boolean => !INSTALL_IDE_KEYWORDS.includes(entry as RequestedIde));
  if (unexpected.length > 0) {
    throw new Error(
        `Unsupported ide value(s): ${unexpected.join(", ")}`,
    );
  }

  return deduped as RequestedIde[];
}

async function promptForSetupArgs(): Promise<{
  ides: RequestedIde[];
  repo: string;
  dryRun: boolean;
  agentsPolicy: boolean;
  mcpProfile: McpRuntimeProfile;
}> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive setup requires a TTY. Re-run with --yes --ide all|codex|copilot|copilot-cli [--mcp-profile core|standard|full] [--repo /abs/repo] [--dry-run]",
    );
  }

  intro("Astrograph init");

  const resolvedRepo = resolveRepoRoot(process.cwd());
  const shouldContinue = await confirm({
    message: `Set up Astrograph in ${resolvedRepo}?`,
    initialValue: true,
  });

  if (isCancel(shouldContinue) || shouldContinue === false) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  const ide = await select({
    message: "Where should Astrograph be added?",
    options: [
      { value: "codex", label: "Codex", hint: "Writes .codex/config.toml" },
      { value: "copilot", label: "GitHub Copilot", hint: "Writes .vscode/mcp.json" },
      { value: "copilot-cli", label: "GitHub Copilot CLI", hint: "Writes .mcp.json" },
      { value: "all", label: "All supported clients", hint: "Codex, Copilot, and Copilot CLI" },
    ],
    initialValue: "codex",
  });

  if (isCancel(ide) || typeof ide !== "string") {
    outro("Setup cancelled.");
    process.exit(0);
  }

  const policyFileHint = ide === "copilot"
    ? ".github/copilot-instructions.md"
    : "AGENTS.md";

  const agentsPolicy = await confirm({
    message: `Add Astrograph code exploration policy to ${policyFileHint}?`,
    initialValue: false,
  });

  if (isCancel(agentsPolicy)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  outro("Running setup.");

  return {
    ides: [ide as RequestedIde],
    repo: resolvedRepo,
    dryRun: false,
    agentsPolicy: Boolean(agentsPolicy),
    mcpProfile: DEFAULT_MCP_PROFILE,
  };
}

function parseJsonFromString(raw: string, configPath: string): InstalledObject {
  if (!raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object");
    }
    return parsed as InstalledObject;
  } catch (error) {
    throw new Error(
      `Invalid package JSON: ${path.basename(configPath)} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function dependencyFieldHasAstrograph(pkgJson: PackageJsonFile): boolean {
  return Boolean(
    pkgJson.dependencies?.[PACKAGE_NAME]
    || pkgJson.devDependencies?.[PACKAGE_NAME]
    || pkgJson.optionalDependencies?.[PACKAGE_NAME]
  );
}

function toStringRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function ensureAstrographDependencyInRepo(
  repoRoot: string,
  dryRun: boolean,
): Promise<PackageDependencyResult> {
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

  const parsed = parseJsonFromString(packageJsonRaw, packagePath) as PackageJsonFile;
  if (parsed.name === PACKAGE_NAME) {
    return {
      packageDependencyUpdated: false,
      packageDependencyReason: "target package is Astrograph itself",
    };
  }
  const hadAstrographDependency = dependencyFieldHasAstrograph(parsed);

  let didUpdate = false;
  const sections = ["dependencies", "devDependencies", "optionalDependencies"] as const;
  const namesToSync = [PACKAGE_NAME];

  for (const section of sections) {
    const value = toStringRecord(parsed[section]);
    if (Object.keys(value).length === 0) {
      continue;
    }

    for (const depName of namesToSync) {
      if (Object.hasOwn(value, depName) && value[depName] !== "latest") {
        value[depName] = "latest";
        didUpdate = true;
      }
    }
    parsed[section] = value;
  }

  if (!dependencyFieldHasAstrograph(parsed)) {
    const devDependencies = toStringRecord(parsed.devDependencies);
    parsed.devDependencies = devDependencies;
    if (Object.keys(devDependencies).length === 0) {
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
    : "added astrograph@latest";

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

function validateIdes(args: { ides: RequestedIde[] }): { ides: InstallIde[] } {
  if (!Array.isArray(args.ides) || args.ides.length === 0) {
    throw new Error(
      "Astrograph init requires at least one --ide value",
    );
  }

  if (args.ides.includes("all")) {
    return { ides: [...ALL_INSTALL_IDES] };
  }

  for (const ide of args.ides) {
    if (ide !== "all" && !isInstallIde(ide)) {
      throw new Error(
        "Astrograph init supports --ide codex, --ide copilot, --ide copilot-cli, and --ide all",
      );
    }
  }

  return { ides: args.ides as InstallIde[] };
}

function resolveRepoRoot(repoRoot: string): string {
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

function hasLocalAstrographDependency(repoRoot: string): boolean {
  try {
    const packageData = JSON.parse(
      execFileSync(
        "node",
        ["-e", "process.stdout.write(require('fs').readFileSync('package.json','utf8'))"],
        {
          cwd: repoRoot,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      ),
    ) as PackageJsonFile;
    return Boolean(
      packageData.dependencies?.[PACKAGE_NAME]
      || packageData.devDependencies?.[PACKAGE_NAME]
      || packageData.optionalDependencies?.[PACKAGE_NAME]
    );
  } catch {
    return false;
  }
}

function resolveManagedInvocation(profile: McpRuntimeProfile): ManagedInvocation {
  const args = ["-y", "--package", `${PACKAGE_NAME}@latest`, "astrograph", "mcp"];
  if (profile !== DEFAULT_MCP_PROFILE) {
    args.push("--mcp-profile", profile);
  }
  return {
    command: "npx",
    args,
  };
}

function createMinimalTsConfig(): string {
  const excludeLines = [
    "node_modules/**",
    "dist/**",
    "coverage/**",
    ".git/**",
  ].map((p) => `    "${p}",`).join("\n");
  return [
    `import { defineConfig } from "${PACKAGE_NAME}";`,
    "",
    "export default defineConfig({",
    "  performance: {",
    "    exclude: [",
    excludeLines,
    "    ],",
    "  },",
    "});",
    "",
  ].join("\n");
}

function astrographConfigBlock(profile: McpRuntimeProfile): string {
  const tools = getMcpToolsForProfile(profile);
  const enabledTools = tools.map((tool) => `"${tool}"`).join(", ");
  const toolApprovals = tools.map((tool) =>
    `[mcp_servers.astrograph.tools.${tool}]\napproval_mode = "approve"`,
  ).join("\n\n");
  const invocation = resolveManagedInvocation(profile);
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

function replaceManagedBlock(contents: string, block: string): string {
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

// AGENTS.md block — used by Codex and Copilot CLI, which both read AGENTS.md natively.
// Follows Codex "Working agreements" convention so it fits alongside other AGENTS.md sections.
function agentsPolicyLines(profile: McpRuntimeProfile): string[] {
  const enabledTools = new Set(getMcpToolsForProfile(profile));
  const lines: string[] = [];

  if (enabledTools.has("get_project_status") && enabledTools.has("index_folder")) {
    lines.push(
      "- Start with `get_project_status` for the current repository; if the index is missing or stale, run `index_folder`.",
    );
  } else if (enabledTools.has("get_project_status")) {
    lines.push("- Start with `get_project_status` for the current repository to understand index state.");
    lines.push(
      "- If the index is missing or stale and this profile does not expose `index_folder`, switch to a broader profile or refresh the index outside the client.",
    );
  }

  if (enabledTools.has("get_symbol_source") && enabledTools.has("get_file_summary")) {
    lines.push(
      "- Before reading a symbol, use `get_symbol_source`; before reading a file, use `get_file_summary`.",
    );
  } else if (enabledTools.has("get_symbol_source")) {
    lines.push("- Before reading raw source, use `get_symbol_source`.");
  } else if (enabledTools.has("get_file_summary")) {
    lines.push("- Before reading a file, use `get_file_summary`.");
  }

  const discoveryTools = [
    enabledTools.has("search_symbols") ? "`search_symbols`" : null,
    enabledTools.has("suggest_initial_queries") ? "`suggest_initial_queries`" : null,
    enabledTools.has("find_files") ? "`find_files`" : null,
    enabledTools.has("search_text") ? "`search_text`" : null,
  ].filter((tool): tool is string => tool !== null);
  if (discoveryTools.length > 0) {
    lines.push(`- Use ${discoveryTools.join(", ")} for discovery before broad raw-file search.`);
  }

  const contextTools = [
    enabledTools.has("get_context_bundle") ? "`get_context_bundle`" : null,
    enabledTools.has("get_ranked_context") ? "`get_ranked_context`" : null,
  ].filter((tool): tool is string => tool !== null);
  if (contextTools.length > 0) {
    lines.push(`- Use ${contextTools.join(" or ")} for bounded implementation context.`);
  }

  const structureTools = [
    enabledTools.has("get_file_tree") ? "`get_file_tree`" : null,
    enabledTools.has("get_file_outline") ? "`get_file_outline`" : null,
    enabledTools.has("get_repo_outline") ? "`get_repo_outline`" : null,
  ].filter((tool): tool is string => tool !== null);
  if (structureTools.length > 0) {
    lines.push(`- Use ${structureTools.join(", ")} to understand repository structure.`);
  }

  lines.push("- Use raw file reads or shell search only when Astrograph cannot answer the question.");
  return lines;
}

function agentsPolicyBlockForAgentsMd(profile: McpRuntimeProfile): string {
  return [
    AGENTS_POLICY_BEGIN,
    "## Code Exploration with Astrograph",
    "",
    "Astrograph provides local MCP tools for code intelligence. Use them before falling back to raw file reads or shell search.",
    "",
    "### Working agreements",
    "",
    ...agentsPolicyLines(profile),
    AGENTS_POLICY_END,
  ].join("\n");
}

// copilot-instructions.md block — used by GitHub Copilot (VS Code), which reads
// .github/copilot-instructions.md as persistent repository-wide instructions.
function agentsPolicyBlockForCopilotInstructions(profile: McpRuntimeProfile): string {
  return [
    AGENTS_POLICY_BEGIN,
    "## Code Exploration with Astrograph",
    "",
    "Astrograph MCP tools are configured for this repository. Use them for code intelligence before falling back to raw file reads.",
    "",
    ...agentsPolicyLines(profile).map((line) => line.replace("Use raw file reads", "Fall back to raw file access")),
    AGENTS_POLICY_END,
  ].join("\n");
}

function resolvePolicyFilePath(ide: InstallIde, repoRoot: string): string {
  if (ide === "copilot") {
    return path.join(repoRoot, ".github", "copilot-instructions.md");
  }
  // codex and copilot-cli both read AGENTS.md at the repo root
  return path.join(repoRoot, "AGENTS.md");
}

function agentsPolicyBlockForIde(ide: InstallIde, profile: McpRuntimeProfile): string {
  if (ide === "copilot") {
    return agentsPolicyBlockForCopilotInstructions(profile);
  }
  return agentsPolicyBlockForAgentsMd(profile);
}

function replaceManagedAgentsPolicy(contents: string, block: string): string {
  if (contents.includes(AGENTS_POLICY_BEGIN) && contents.includes(AGENTS_POLICY_END)) {
    return contents.replace(
      new RegExp(`${AGENTS_POLICY_BEGIN}[\\s\\S]*?${AGENTS_POLICY_END}`, "m"),
      block,
    );
  }

  const normalized = contents.trimEnd();
  return normalized.length === 0 ? `${block}\n` : `${normalized}\n\n${block}\n`;
}

async function writeAgentsPolicy(
  repoRoot: string,
  dryRun: boolean,
  enabled: boolean,
  profile: McpRuntimeProfile,
  ide: InstallIde = "codex",
): Promise<AgentsPolicyResult> {
  const agentsPolicyPath = resolvePolicyFilePath(ide, repoRoot);
  if (!enabled) {
    return {
      agentsPolicyPath,
      agentsPolicyUpdated: false,
      agentsPolicyReason: "not requested",
    };
  }

  const block = agentsPolicyBlockForIde(ide, profile);
  const currentContents = await readFile(agentsPolicyPath, "utf8").catch(() => "");
  const nextContents = replaceManagedAgentsPolicy(currentContents, block);
  if (nextContents === currentContents) {
    return {
      agentsPolicyPath,
      agentsPolicyUpdated: false,
      agentsPolicyReason: "policy already up to date",
      agentsPolicyPreview: nextContents,
    };
  }

  if (dryRun) {
    return {
      agentsPolicyPath,
      agentsPolicyUpdated: false,
      agentsPolicyReason: "would add Astrograph code exploration policy",
      agentsPolicyPreview: nextContents,
    };
  }

  await mkdir(path.dirname(agentsPolicyPath), { recursive: true });
  await writeFile(agentsPolicyPath, nextContents, "utf8");
  return {
    agentsPolicyPath,
    agentsPolicyUpdated: true,
    agentsPolicyReason: "added Astrograph code exploration policy",
    agentsPolicyPreview: nextContents,
  };
}

function parseJsonConfig(contents: string, configPath: string): InstalledObject {
  if (!contents.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(contents);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object");
    }
    return parsed as InstalledObject;
  } catch (error) {
    throw new Error(
      `Invalid JSON config file: ${path.basename(configPath)} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function replaceManagedServerInJson(
  contents: string,
  configPath: string,
  rootKey: string,
  managedServer: InstalledObject,
): string {
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

function managedConfigForCopilot(ide: InstallIde, profile: McpRuntimeProfile): InstalledObject {
  const invocation = resolveManagedInvocation(profile);
  const tools = getMcpToolsForProfile(profile);

  if (ide === "copilot-cli") {
    return {
      type: "local",
      command: invocation.command,
      args: invocation.args,
      cwd: ".",
      tools,
    };
  }

  return {
    type: "stdio",
    command: invocation.command,
    args: invocation.args,
    cwd: ".",
  };
}

function resolveManagedConfig(
  ide: InstallIde,
  repoRoot: string,
  profile: McpRuntimeProfile,
  currentContents: string,
): ManagedConfig {
  if (ide === "codex") {
    return {
      configPath: path.join(repoRoot, ".codex", "config.toml"),
      nextContents: replaceManagedBlock(currentContents, astrographConfigBlock(profile)),
    };
  }

  const configPath = ide === "copilot"
    ? path.join(repoRoot, ".vscode", "mcp.json")
    : path.join(repoRoot, ".mcp.json");
  const rootKey = ide === "copilot" ? "servers" : "mcpServers";

  return {
    configPath,
    nextContents: replaceManagedServerInJson(
      currentContents,
      configPath,
      rootKey,
      managedConfigForCopilot(ide, profile),
    ),
  };
}

export async function setupForIde(
  repoRoot: string,
  { ide = "codex", dryRun = false, mcpProfile = DEFAULT_MCP_PROFILE }: SetupForIdeOptions = {},
): Promise<SetupResult> {
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const { configPath } = resolveManagedConfig(ide, resolvedRepoRoot, mcpProfile, "");
  const engineConfigPath = path.join(resolvedRepoRoot, "astrograph.config.ts");
  const engineConfigPreview = createMinimalTsConfig();
  const currentContents = await readFile(configPath, "utf8").catch(() => "");
  const { configPath: finalConfigPath, nextContents } = resolveManagedConfig(
    ide,
    resolvedRepoRoot,
    mcpProfile,
    currentContents,
  );

  if (!dryRun) {
    await mkdir(path.dirname(finalConfigPath), { recursive: true });
    await writeFile(finalConfigPath, nextContents, "utf8");
    await writeFile(engineConfigPath, engineConfigPreview, "utf8");
  }

  return {
    ide,
    mcpProfile,
    repoRoot: resolvedRepoRoot,
    configPath: finalConfigPath,
    engineConfigPath,
    packageName: PACKAGE_NAME,
    packageVersion: PACKAGE_VERSION,
    configPreview: nextContents,
    engineConfigPreview,
    localDependencyDetected: hasLocalAstrographDependency(resolvedRepoRoot),
    packageDependencyUpdated: false,
    packageDependencyReason: "dependency already at latest",
    agentsPolicyPath: path.join(resolvedRepoRoot, "AGENTS.md"),
    agentsPolicyUpdated: false,
    agentsPolicyReason: "not requested",
  };
}

export async function setupForCodex(
  repoRoot: string,
  { dryRun = false, mcpProfile = DEFAULT_MCP_PROFILE }: SetupForIdeOptions = {},
): Promise<SetupResult> {
  return setupForIde(repoRoot, { ide: "codex", dryRun, mcpProfile });
}

export async function setupForAllIdes(
  repoRoot: string,
  {
    ides = [...DEFAULT_INSTALL_IDES],
    dryRun = false,
    agentsPolicy = false,
    mcpProfile = DEFAULT_MCP_PROFILE,
  }: SetupForAllOptions = {},
): Promise<SetupResult | SetupResult[]> {
  const normalizedIdes = validateIdes({ ides }).ides;
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const packageDependency = await ensureAstrographDependencyInRepo(
    resolvedRepoRoot,
    dryRun,
  );

  const results: SetupResult[] = [];
  for (const ide of normalizedIdes) {
    const result = await setupForIde(resolvedRepoRoot, { ide, dryRun, mcpProfile });
    const agentsPolicyResult = await writeAgentsPolicy(
      resolvedRepoRoot,
      dryRun,
      agentsPolicy,
      mcpProfile,
      ide,
    );

    results.push({
      ...result,
      packageDependencyUpdated: packageDependency.packageDependencyUpdated,
      packageDependencyReason: packageDependency.packageDependencyReason,
      packageDependencyPreview: packageDependency.packageDependencyPreview,
      agentsPolicyPath: agentsPolicyResult.agentsPolicyPath,
      agentsPolicyUpdated: agentsPolicyResult.agentsPolicyUpdated,
      agentsPolicyReason: agentsPolicyResult.agentsPolicyReason,
      agentsPolicyPreview: agentsPolicyResult.agentsPolicyPreview,
    });
  }

  return normalizedIdes.length === 1 ? results[0] : results;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.showHelp) {
    usage();
    return;
  }

  const normalizedArgs: ParsedArgs = {
    ...parsed,
    ides: parsed.ides || [...DEFAULT_INSTALL_IDES],
    repo: parsed.repo || process.cwd(),
  };

  const args = parsed.hasExplicitArgs || parsed.nonInteractive
    ? {
      ...validateIdes({ ides: normalizedArgs.ides ?? [] }),
      repo: normalizedArgs.repo,
      mcpProfile: normalizedArgs.mcpProfile,
      dryRun: normalizedArgs.dryRun,
      agentsPolicy: normalizedArgs.agentsPolicy,
    }
    : await promptForSetupArgs();

  const result = await setupForAllIdes(args.repo, {
    ides: args.ides,
    dryRun: args.dryRun,
    agentsPolicy: args.agentsPolicy,
    mcpProfile: args.mcpProfile,
  });

  emitUpdateSuggestion(PACKAGE_VERSION);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    usage();
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
