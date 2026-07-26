#!/usr/bin/env node

import { constants as fsConstants, accessSync, existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import {
  isCancel,
  intro,
  outro,
  spinner,
  select,
  confirm,
} from "@clack/prompts";
import { Command, Option } from "commander";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { isMainModule } from "../entrypoint.ts";
import { diagnostics } from "../index.ts";
import { MCP_TOOL_DEFINITIONS } from "../mcp-contract.ts";
import { resolveGlobalCacheRoot, resolveGlobalConfigPath } from "../config.ts";
import { runProcess } from "../lib/process.ts";
import { fetchLatestNpmVersion } from "../lib/npm-registry.ts";
import { compareGenericPackageVersions, normalizeGenericPackageVersion } from "../version.ts";
import type { StoragePathEnvironment } from "../types.ts";

const MARKER_BEGIN = "# BEGIN ASTROGRAPH";
const MARKER_END = "# END ASTROGRAPH";
const AGENTS_POLICY_BEGIN = "<!-- BEGIN ASTROGRAPH CODE EXPLORATION POLICY -->";
const AGENTS_POLICY_END = "<!-- END ASTROGRAPH CODE EXPLORATION POLICY -->";
const GIT_HOOK_BEGIN = "# BEGIN ASTROGRAPH GIT REFRESH";
const GIT_HOOK_END = "# END ASTROGRAPH GIT REFRESH";
const MCP_SERVER_NAME = "astrograph";
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
const MCP_TOOLS = MCP_TOOL_DEFINITIONS.map((tool) => tool.name);
const DEFAULT_INSTALL_IDES: RequestedIde[] = ["codex"];
const DEFAULT_GLOBAL_INSTALL_IDE = "copilot-cli" as const;
export const DEFAULT_GUIDED_INSTALL_SCOPE = "global" as const;

type InstallIde = (typeof ALL_INSTALL_IDES)[number];
type RequestedIde = InstallIde | "all";
type InstalledObject = Record<string, unknown>;

interface ParsedArgs {
  ides: RequestedIde[] | null;
  repo: string;
  dryRun: boolean;
  json: boolean;
  nonInteractive: boolean;
  agentsPolicy: boolean;
  gitHooks: boolean;
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
  gitHooks: GitHookResult[];
}

interface CliOptions {
  ide?: string;
  dryRun?: boolean;
  json?: boolean;
  repo?: string;
  yes?: boolean;
  agents?: boolean;
  gitHooks?: boolean;
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
}

interface SetupForAllOptions {
  ides?: RequestedIde[];
  dryRun?: boolean;
  agentsPolicy?: boolean;
  gitHooks?: boolean;
}

export interface GitHookResult {
  hook: "post-commit" | "post-checkout" | "post-merge";
  path: string;
  updated: boolean;
  reason: string;
  preview?: string;
}

export interface SetupGlobalClientOptions {
  dryRun?: boolean;
  environment?: StoragePathEnvironment;
  nodeVersion?: string;
  executableAvailable?: boolean;
}

export interface GlobalSetupResult {
  ide: "codex" | "copilot-cli";
  configPath: string;
  engineConfigPath: string;
  configPreview: string;
  engineConfigPreview: string;
}

export interface GlobalInstallationDiagnostics {
  schemaVersion: 1;
  package: { name: string; version: string };
  runtime: { nodeVersion: string; minimumNodeVersion: string; supported: boolean };
  defaultGlobalIde: "copilot-cli";
  storage: {
    location: "global" | "repo-local" | "not-configured";
    configPath: string;
    cacheRoot: string;
    cacheRootExists: boolean;
  };
  clients: Array<{ ide: "copilot-cli" | "codex"; configPath: string; configured: boolean }>;
  nextStep: string;
}

type SetupClient = "codex" | "copilot" | "copilot-cli";

export interface SetupReadinessResult {
  schemaVersion: 1;
  repoRoot: string;
  local: {
    clients: Array<{ ide: SetupClient; configPath: string; configured: boolean }>;
    agentGuidance: Array<{ path: string; configured: boolean }>;
    gitHooks: Array<{ hook: GitHookResult["hook"]; path: string; status: "managed" | "missing" | "other" }>;
    localDependencyDetected: boolean;
  };
  global: GlobalInstallationDiagnostics;
  index: {
    status: "ready" | "not-indexed" | "stale" | "unavailable";
    indexedFiles: number;
    retrievalHealth: "safe" | "degraded" | "unsafe" | null;
    error: string | null;
  };
  ready: boolean;
  actions: string[];
}

export function formatGlobalInstallation(
  result: GlobalSetupResult,
  options: { dryRun?: boolean } = {},
): string {
  const client = result.ide === "codex" ? "Codex" : "GitHub Copilot CLI";
  const command = `astrograph install --global --ide ${result.ide}`;
  const heading = options.dryRun
    ? "Preview complete — no files were changed."
    : "Astrograph is ready.";
  const nextStep = options.dryRun
    ? `Run \`${command}\` when you are ready to connect ${client}.`
    : `Restart ${client}, open any repository, then use Astrograph normally. Run \`index_folder\` when that repository has no index yet.`;

  return [
    heading,
    `Astrograph ${PACKAGE_VERSION} is connected to ${client}.`,
    "",
    "You get, out of the box:",
    "  • Local code search, symbols, file summaries, and task context",
    "  • One private, isolated index per repository",
    "  • No Astrograph config files added to the repositories you open",
    "",
    `Managed client config: ${result.configPath}`,
    `Astrograph storage settings: ${result.engineConfigPath}`,
    "",
    `Next: ${nextStep}`,
    `For a machine-readable result, add \`--json\`.`,
  ].join("\n");
}

export function formatRepositoryInstallation(
  result: SetupResult | SetupResult[],
  options: { dryRun?: boolean } = {},
): string {
  const results = Array.isArray(result) ? result : [result];
  const first = results[0];
  const clients = results.map((entry) => {
    if (entry.ide === "codex") return "Codex";
    if (entry.ide === "copilot") return "GitHub Copilot";
    return "GitHub Copilot CLI";
  }).join(", ");
  const heading = options.dryRun
    ? "Preview complete — no files were changed."
    : "Astrograph is ready in this repository.";
  const dependency = first.packageDependencyReason === "package.json not found"
    ? "No package.json was found, so Astrograph did not add a dependency."
    : `Package: ${first.packageDependencyReason}.`;
  const policy = first.agentsPolicyReason === "not requested"
    ? null
    : `Agent guidance: ${first.agentsPolicyReason}.`;
  const hooks = first.gitHooks.length === 0
    ? null
    : `Git refresh hooks: ${first.gitHooks.map((hook) => `${hook.hook} (${hook.reason})`).join(", ")}.`;

  return [
    heading,
    `Astrograph ${first.packageVersion} is connected to ${clients}.`,
    "",
    "You get, out of the box:",
    "  • Project-owned MCP configuration for your selected client",
    "  • A local index that stays with this repository",
    "  • Local code search, symbols, file summaries, and task context",
    "",
    `Repository: ${first.repoRoot}`,
    ...results.map((entry) => `Managed client config: ${entry.configPath}`),
    `Astrograph project config: ${first.engineConfigPath}`,
    dependency,
    ...(policy ? [policy] : []),
    ...(hooks ? [hooks] : []),
    "",
    options.dryRun
      ? "Next: run `astrograph install --yes` when you are ready to write these files."
      : "Next: restart your selected client, then run `index_folder` to create the first index.",
    "For a machine-readable result, add `--json`.",
  ].join("\n");
}

export function formatSetupReadiness(result: SetupReadinessResult): string {
  const configuredClients = result.local.clients
    .filter((client) => client.configured)
    .map((client) => client.ide);
  const managedHooks = result.local.gitHooks
    .filter((hook) => hook.status === "managed")
    .map((hook) => hook.hook);
  return [
    "Astrograph Setup Doctor",
    `Repository: ${result.repoRoot}`,
    `Local clients: ${configuredClients.length ? configuredClients.join(", ") : "none"}`,
    `Global clients: ${result.global.clients.filter((client) => client.configured).map((client) => client.ide).join(", ") || "none"}`,
    `Agent guidance: ${result.local.agentGuidance.some((entry) => entry.configured) ? "configured" : "not configured"}`,
    `Git refresh hooks: ${managedHooks.length ? managedHooks.join(", ") : "not configured"}`,
    `Index: ${result.index.status} (${result.index.indexedFiles} files; retrieval ${result.index.retrievalHealth ?? "unavailable"})`,
    `Ready: ${result.ready ? "yes" : "not yet"}`,
    ...(result.actions.length ? ["", "Next:", ...result.actions.map((action) => `  • ${action}`)] : []),
    "",
    "For machine-readable output, add `--json`.",
  ].join("\n");
}

interface AgentsPolicyResult {
  agentsPolicyPath: string;
  agentsPolicyUpdated: boolean;
  agentsPolicyReason: string;
  agentsPolicyPreview?: string;
}

async function resolveLatestAstrographVersion(): Promise<string | null> {
  try {
    const latest = await fetchLatestNpmVersion({ packageName: PACKAGE_NAME, timeoutMs: 2_500 });
    return normalizeGenericPackageVersion(latest);
  } catch {
    return null;
  }
}

async function emitUpdateSuggestion(currentVersion: string): Promise<void> {
  const latest = await resolveLatestAstrographVersion();
  const comparison = latest === null ? null : compareGenericPackageVersions(latest, currentVersion);
  if (comparison === null || comparison <= 0) {
    return;
  }

  const suggestion = `npm install ${PACKAGE_NAME}@latest`;
  process.stderr.write(
    `A newer Astrograph version is available: ${latest} (current: ${currentVersion}).\n` +
    `To update, run: ${suggestion}\n` +
      `If you see stale behavior after update, clear local state and rebuild index:\n` +
      `  Git Bash: rm -rf .astrograph\n` +
      `  PowerShell: Remove-Item -Recurse -Force .astrograph\n` +
      `  cmd.exe: rmdir /s /q .astrograph\n` +
      `  astrograph install --yes\n`,
  );
}

function usage(): void {
  process.stderr.write(
    [
      "Usage:",
      "  npx astrograph install [--yes] [--agents] [--git-hooks] [--ide codex|copilot|copilot-cli|all|codex,copilot,...] [--repo /abs/repo] [--dry-run] [--json]",
      "",
      "Defaults:",
      "  - repo: current git worktree, or current directory",
      "  - IDE: Codex",
      "  - writes: astrograph.config.json and managed MCP config",
      "  - optional: --agents adds a tailored agent instruction file for each IDE:",
      "      codex       → AGENTS.md",
      "      copilot     → .github/copilot-instructions.md",
      "      copilot-cli → AGENTS.md",
      "  - optional: --git-hooks adds non-blocking post-commit, post-checkout, and post-merge index refresh hooks when those hooks are not owned by another tool",
      "  - ensures: astrograph is set to latest in package.json when package.json exists",
      "",
      "Examples:",
      "  npx astrograph install",
      "  npx astrograph install --yes",
      "  npx astrograph install --yes --ide all",
      "  npx astrograph install --yes --json",
    ].join("\n") + "\n",
  );
}

function nodeVersionSupported(nodeVersion: string): boolean {
  const match = nodeVersion.replace(/^v/, "").match(/^(\d+)\.(\d+)\./);
  const major = Number(match?.[1] ?? 0);
  const minor = Number(match?.[2] ?? 0);
  return major > 22 || (major === 22 && minor >= 12);
}

export async function getGlobalInstallationDiagnostics(
  environment: StoragePathEnvironment = {},
): Promise<GlobalInstallationDiagnostics> {
  const engineConfigPath = resolveGlobalConfigPath(environment);
  const cacheRoot = resolveGlobalCacheRoot(environment);
  const engineConfig = await readOptionalConfig(engineConfigPath);
  let storageLocation: GlobalInstallationDiagnostics["storage"]["location"] = "not-configured";
  if (engineConfig) {
    const parsed = parseGlobalConfig(engineConfig, engineConfigPath);
    storageLocation = parsed.storageLocation === "global" ? "global" : "repo-local";
  }
  const copilotConfigPath = resolveGlobalCopilotCliConfigPath(environment);
  const codexConfigPath = resolveGlobalCodexConfigPath(environment);

  return {
    schemaVersion: 1,
    package: { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    runtime: {
      nodeVersion: process.versions.node,
      minimumNodeVersion: "22.12.0",
      supported: nodeVersionSupported(process.versions.node),
    },
    defaultGlobalIde: DEFAULT_GLOBAL_INSTALL_IDE,
    storage: {
      location: storageLocation,
      configPath: engineConfigPath,
      cacheRoot,
      cacheRootExists: existsSync(cacheRoot),
    },
    clients: [
      { ide: "copilot-cli", configPath: copilotConfigPath, configured: existsSync(copilotConfigPath) },
      { ide: "codex", configPath: codexConfigPath, configured: existsSync(codexConfigPath) },
    ],
    nextStep: storageLocation === "global" && existsSync(copilotConfigPath)
      ? "Open Copilot CLI in a repository and use Astrograph normally; run index_folder when that repository has no index."
      : "Run astrograph install --global to register Astrograph for Copilot CLI and enable isolated global cache storage.",
  };
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
      json: false,
      nonInteractive: false,
      agentsPolicy: false,
      gitHooks: false,
      hasExplicitArgs: false,
      showHelp: true,
    };
  }

  const knownFlag = new Set<string>([
    "--yes",
    "--agents",
    "--git-hooks",
    "--dry-run",
    "--json",
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

  const program = new Command("astrograph install")
    .allowUnknownOption(false)
    .exitOverride()
    .helpOption("-h, --help", "Show setup help.")
    .addOption(new Option("--yes", "Run setup with defaults and without prompts."))
    .addOption(new Option("--agents", "Add a tailored agent instruction file for the selected IDE."))
    .addOption(new Option("--git-hooks", "Install safe, non-blocking Git refresh hooks when available."))
    .addOption(new Option("--dry-run", "Preview changes only."))
    .addOption(new Option("--json", "Print the machine-readable setup result."))
    .addOption(new Option("--repo <path>", "Repository root path for setup.").default(process.cwd()))
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
        json: false,
        nonInteractive: false,
        agentsPolicy: false,
        gitHooks: false,
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
      json: false,
      nonInteractive: false,
      agentsPolicy: false,
      gitHooks: false,
      hasExplicitArgs: false,
      showHelp: true,
    };
  }

  const hasFlag = (name: string): boolean =>
    argv.includes(`--${name}`) || argv.some((token) => token.startsWith(`--${name}=`));

  return {
    ides: hasFlag("ide")
      ? parseIdeSelections(options.ide)
      : null,
    repo: options.repo ?? process.cwd(),
    dryRun: Boolean(options.dryRun),
    json: Boolean(options.json),
    nonInteractive: Boolean(options.yes),
    agentsPolicy: Boolean(options.agents),
    gitHooks: Boolean(argv.includes("--git-hooks")),
    hasExplicitArgs:
      hasFlag("yes") ||
      hasFlag("agents") ||
      hasFlag("git-hooks") ||
      hasFlag("dry-run") ||
      hasFlag("json") ||
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
  json: boolean;
  agentsPolicy: boolean;
  gitHooks: boolean;
}> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive setup requires a TTY. Re-run with --yes --ide all|codex|copilot|copilot-cli [--repo /abs/repo] [--dry-run]",
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

  const gitHooks = await confirm({
    message: "Keep the index fresh after commits, branch switches, and merges?",
    initialValue: false,
  });

  if (isCancel(gitHooks)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  return {
    ides: [ide as RequestedIde],
    repo: resolvedRepo,
    dryRun: false,
    json: false,
    agentsPolicy: Boolean(agentsPolicy),
    gitHooks: Boolean(gitHooks),
  };
}

async function runGuidedInstall(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Guided install requires a TTY. Use `astrograph install --yes` for repository setup or `astrograph install --global --ide codex|copilot-cli` for global setup.",
    );
  }

  intro("Astrograph setup");
  const scope = await select({
    message: "Where should Astrograph be available?",
    options: [
      {
        value: "global",
        label: "Every repository on this device (Recommended)",
        hint: "User-level client registration with one private cache per repository",
      },
      {
        value: "repository",
        label: "This repository",
        hint: "Project-owned MCP config and index; collaborators can review the setup",
      },
    ],
    initialValue: DEFAULT_GUIDED_INSTALL_SCOPE,
  });
  if (isCancel(scope) || typeof scope !== "string") {
    outro("Setup cancelled.");
    return;
  }

  if (scope === "repository") {
    const args = await promptForSetupArgs();
    const result = await setupForAllIdes(args.repo, {
      ides: args.ides,
      dryRun: args.dryRun,
      agentsPolicy: args.agentsPolicy,
      gitHooks: args.gitHooks,
    });
    outro(formatRepositoryInstallation(result, { dryRun: args.dryRun }));
    return;
  }

  const ide = await select({
    message: "Which global client should Astrograph connect to?",
    options: [
      { value: "codex", label: "Codex", hint: "Writes only ~/.codex/config.toml" },
      { value: "copilot-cli", label: "GitHub Copilot CLI", hint: "Writes only ~/.copilot/mcp-config.json" },
    ],
    initialValue: DEFAULT_GLOBAL_INSTALL_IDE,
  });
  if (isCancel(ide) || (ide !== "codex" && ide !== "copilot-cli")) {
    outro("Setup cancelled.");
    return;
  }
  const shouldInstall = await confirm({
    message: `Install or update Astrograph globally, then connect ${ide === "codex" ? "Codex" : "GitHub Copilot CLI"}?`,
    initialValue: true,
  });
  if (isCancel(shouldInstall) || shouldInstall === false) {
    outro("Setup cancelled. No package or client configuration was changed.");
    return;
  }

  const progress = spinner();
  progress.start("Installing Astrograph globally…");
  runProcess("npm", ["install", "--global", `${PACKAGE_NAME}@latest`], { stdio: "inherit" });
  progress.message("Connecting your selected client…");
  const result = ide === "codex"
    ? await setupGlobalForCodex({ executableAvailable: true })
    : await setupGlobalForCopilotCli({ executableAvailable: true });
  progress.stop("Global setup ready");
  outro(formatGlobalInstallation(result));
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
    return runProcess("git", ["rev-parse", "--show-toplevel"], {
      cwd: absoluteRepoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).stdout.trim();
  } catch {
    return absoluteRepoRoot;
  }
}

function hasLocalAstrographDependency(repoRoot: string): boolean {
  try {
    const packageData = JSON.parse(
      runProcess(
        "node",
        ["-e", "process.stdout.write(require('fs').readFileSync('package.json','utf8'))"],
        {
          cwd: repoRoot,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      ).stdout,
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

function resolveManagedInvocation(): ManagedInvocation {
  return {
    command: "npx",
    args: ["-y", "--package", `${PACKAGE_NAME}@latest`, "astrograph", "mcp"],
  };
}

function createMinimalJsonConfig(): string {
  return `${JSON.stringify({
    performance: {
      exclude: ["node_modules/**", "dist/**", "coverage/**", ".git/**"],
    },
  }, null, 2)}\n`;
}

function astrographConfigBlock(): string {
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

function globalAstrographConfigBlock(): string {
  const enabledTools = MCP_TOOLS.map((tool) => `"${tool}"`).join(", ");
  const toolApprovals = MCP_TOOLS.map((tool) =>
    `[mcp_servers.astrograph.tools.${tool}]\napproval_mode = "approve"`,
  ).join("\n\n");
  return `${MARKER_BEGIN}
[mcp_servers.astrograph]
command = "astrograph"
args = ["mcp"]
startup_timeout_sec = 90
enabled_tools = [${enabledTools}]

${toolApprovals}
${MARKER_END}`;
}

function resolveGlobalCodexConfigPath(
  environment: StoragePathEnvironment = {},
): string {
  const homeDir = environment.homeDir ?? os.homedir;
  return path.join(homeDir(), ".codex", "config.toml");
}

function parseGlobalConfig(contents: string, configPath: string): Record<string, unknown> {
  if (contents.trim() === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(contents);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid global Astrograph config ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function globalExecutableIsAvailable(environment: StoragePathEnvironment): boolean {
  const env = environment.env ?? process.env;
  const pathValue = env.PATH;
  if (!pathValue) return false;
  const extensions = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  return pathValue.split(path.delimiter).some((entry) =>
    extensions.some((extension) => {
      const candidate = path.join(entry, `astrograph${extension}`);
      try {
        accessSync(candidate, fsConstants.X_OK);
        return true;
      } catch {
        return false;
      }
    }),
  );
}

function assertGlobalInstallPrerequisites(
  options: SetupGlobalClientOptions,
  ide: "codex" | "copilot-cli",
): void {
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  const match = nodeVersion.match(/^(\d+)\.(\d+)\./);
  const major = Number(match?.[1] ?? 0);
  const minor = Number(match?.[2] ?? 0);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error(`Astrograph global install requires Node.js >=22.12.0; found ${nodeVersion}. Install a supported Node release and retry.`);
  }
  const executableAvailable = options.executableAvailable ?? globalExecutableIsAvailable(options.environment ?? {});
  if (!executableAvailable) {
    throw new Error(`Cannot find \`astrograph\` on PATH. Install it with \`npm install --global astrograph\`, open a new shell, then rerun \`astrograph install --global --ide ${ide}\`.`);
  }
}

async function readOptionalConfig(configPath: string): Promise<string> {
  try {
    return await readFile(configPath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return "";
    throw new Error(`Cannot read user configuration ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function setupGlobalForCodex(
  options: SetupGlobalClientOptions = {},
): Promise<GlobalSetupResult> {
  const { dryRun = false, environment = {} } = options;
  assertGlobalInstallPrerequisites({ ...options, environment }, "codex");
  const configPath = resolveGlobalCodexConfigPath(environment);
  const engineConfigPath = resolveGlobalConfigPath(environment);
  const currentCodexConfig = await readOptionalConfig(configPath);
  const currentEngineConfig = await readOptionalConfig(engineConfigPath);
  const configPreview = replaceManagedBlock(currentCodexConfig, globalAstrographConfigBlock());
  const engineConfigPreview = `${JSON.stringify({
    ...parseGlobalConfig(currentEngineConfig, engineConfigPath),
    storageLocation: "global",
  }, null, 2)}\n`;

  if (!dryRun) {
    try {
      await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
      await mkdir(path.dirname(engineConfigPath), { recursive: true, mode: 0o700 });
    } catch (error) {
      throw new Error(`Cannot create user configuration directories for global Astrograph setup (${configPath}; ${engineConfigPath}). Check ownership and permissions, then retry. ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await writeFile(engineConfigPath, engineConfigPreview, { encoding: "utf8", mode: 0o600 });
      await writeFile(configPath, configPreview, { encoding: "utf8", mode: 0o600 });
    } catch (error) {
      throw new Error(`Cannot write user configuration for global Astrograph setup (${configPath}; ${engineConfigPath}). Check ownership and permissions, then retry. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ide: "codex",
    configPath,
    engineConfigPath,
    configPreview,
    engineConfigPreview,
  };
}

function resolveGlobalCopilotCliConfigPath(
  environment: StoragePathEnvironment = {},
): string {
  const configuredHome = (environment.env ?? process.env).COPILOT_HOME;
  if (configuredHome) {
    if (!path.isAbsolute(configuredHome)) {
      throw new Error("COPILOT_HOME must be an absolute path for global Copilot CLI setup");
    }
    return path.join(configuredHome, "mcp-config.json");
  }
  const homeDir = environment.homeDir ?? os.homedir;
  return path.join(homeDir(), ".copilot", "mcp-config.json");
}

function globalCopilotCliServer(): InstalledObject {
  return {
    type: "local",
    command: "astrograph",
    args: ["mcp"],
    cwd: ".",
    env: {},
    tools: MCP_TOOLS,
  };
}

export async function setupGlobalForCopilotCli(
  options: SetupGlobalClientOptions = {},
): Promise<GlobalSetupResult> {
  const { dryRun = false, environment = {} } = options;
  assertGlobalInstallPrerequisites({ ...options, environment }, "copilot-cli");
  const configPath = resolveGlobalCopilotCliConfigPath(environment);
  const engineConfigPath = resolveGlobalConfigPath(environment);
  const currentCopilotConfig = await readOptionalConfig(configPath);
  const currentEngineConfig = await readOptionalConfig(engineConfigPath);
  const configPreview = replaceManagedServerInJson(
    currentCopilotConfig,
    configPath,
    "mcpServers",
    globalCopilotCliServer(),
  );
  const engineConfigPreview = `${JSON.stringify({
    ...parseGlobalConfig(currentEngineConfig, engineConfigPath),
    storageLocation: "global",
  }, null, 2)}\n`;

  if (!dryRun) {
    try {
      await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
      await mkdir(path.dirname(engineConfigPath), { recursive: true, mode: 0o700 });
    } catch (error) {
      throw new Error(`Cannot create user configuration directories for global Astrograph setup (${configPath}; ${engineConfigPath}). Check ownership and permissions, then retry. ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await writeFile(engineConfigPath, engineConfigPreview, { encoding: "utf8", mode: 0o600 });
      await writeFile(configPath, configPreview, { encoding: "utf8", mode: 0o600 });
    } catch (error) {
      throw new Error(`Cannot write user configuration for global Astrograph setup (${configPath}; ${engineConfigPath}). Check ownership and permissions, then retry. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ide: "copilot-cli",
    configPath,
    engineConfigPath,
    configPreview,
    engineConfigPreview,
  };
}

function replaceManagedBlock(contents: string, block: string): string {
  if (contents.includes(MARKER_BEGIN) && contents.includes(MARKER_END)) {
    return contents.replace(
      new RegExp(`${MARKER_BEGIN}[\\s\\S]*?${MARKER_END}`, "m"),
      block,
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
function agentsPolicyBlockForAgentsMd(): string {
  return [
    AGENTS_POLICY_BEGIN,
    "## Code Exploration with Astrograph",
    "",
    "Astrograph provides local MCP tools for code intelligence. Use them before falling back to raw file reads or shell search.",
    "",
    "### Working agreements",
    "",
    "- Start with `get_project_status` for the current repository; if the index is missing or stale, run `index_folder`.",
    "- Before reading a symbol, use `get_symbol_source`; before reading a file, use `get_file_outline` or `get_file_summary`.",
    "- Before searching broadly, use `search_symbols`, `find_files`, or `search_text`.",
    "- For bounded implementation context, use `get_task_context`.",
    "- Before exploring structure, use `get_file_tree` or `get_repo_outline`.",
    "- Use raw file reads or shell search only when Astrograph cannot answer the question.",
    AGENTS_POLICY_END,
  ].join("\n");
}

// copilot-instructions.md block — used by GitHub Copilot (VS Code), which reads
// .github/copilot-instructions.md as persistent repository-wide instructions.
function agentsPolicyBlockForCopilotInstructions(): string {
  return [
    AGENTS_POLICY_BEGIN,
    "## Code Exploration with Astrograph",
    "",
    "Astrograph MCP tools are configured for this repository. Use them for code intelligence before falling back to raw file reads.",
    "",
    "- Use `get_project_status` to check the index; run `index_folder` if stale.",
    "- Use `get_file_outline`, `get_file_summary`, or `get_symbol_source` before opening raw source.",
    "- Use `search_symbols`, `find_files`, or `search_text` for discovery.",
    "- Use `get_task_context` for bounded implementation context.",
    "- Use `get_file_tree` or `get_repo_outline` to understand structure.",
    "- Fall back to raw file access only when Astrograph tools cannot answer the question.",
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

function agentsPolicyBlockForIde(ide: InstallIde): string {
  if (ide === "copilot") {
    return agentsPolicyBlockForCopilotInstructions();
  }
  return agentsPolicyBlockForAgentsMd();
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

  const block = agentsPolicyBlockForIde(ide);
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

function gitRefreshHookContents(hook: GitHookResult["hook"]): string {
  const args = hook === "post-checkout"
    ? 'checkout "$1" "$2" "$3"'
    : hook === "post-commit"
      ? "commit"
      : "merge";
  return [
    "#!/bin/sh",
    GIT_HOOK_BEGIN,
    "# Runs detached so ordinary Git operations are never blocked by indexing.",
    `npx -y --package ${PACKAGE_NAME}@latest astrograph git-refresh ${args} >/dev/null 2>&1 &`,
    GIT_HOOK_END,
    "",
  ].join("\n");
}

function resolveGitHooksDirectory(repoRoot: string): string | null {
  try {
    const configuredPath = runProcess("git", ["rev-parse", "--git-path", "hooks"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).stdout.trim();
    return configuredPath ? path.resolve(repoRoot, configuredPath) : null;
  } catch {
    return null;
  }
}

export async function setupGitRefreshHooks(
  repoRoot: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<GitHookResult[]> {
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const hooksDirectory = resolveGitHooksDirectory(resolvedRepoRoot);
  const hooks: GitHookResult["hook"][] = ["post-commit", "post-checkout", "post-merge"];

  if (!hooksDirectory) {
    return hooks.map((hook) => ({
      hook,
      path: path.join(resolvedRepoRoot, ".git", "hooks", hook),
      updated: false,
      reason: "not installed because this directory is not a Git repository",
    }));
  }

  const results: GitHookResult[] = [];
  for (const hook of hooks) {
    const hookPath = path.join(hooksDirectory, hook);
    const contents = gitRefreshHookContents(hook);
    const current = await readFile(hookPath, "utf8").catch(() => null);
    if (current !== null && !current.includes(GIT_HOOK_BEGIN)) {
      results.push({
        hook,
        path: hookPath,
        updated: false,
        reason: "not installed because another tool owns this hook",
      });
      continue;
    }
    if (current === contents) {
      results.push({ hook, path: hookPath, updated: false, reason: "already installed", preview: contents });
      continue;
    }
    if (!dryRun) {
      await mkdir(hooksDirectory, { recursive: true });
      await writeFile(hookPath, contents, "utf8");
      await chmod(hookPath, 0o755);
    }
    results.push({
      hook,
      path: hookPath,
      updated: !dryRun,
      reason: dryRun ? "would install non-blocking refresh hook" : "installed non-blocking refresh hook",
      preview: contents,
    });
  }
  return results;
}

async function managedJsonServerExists(
  configPath: string,
  rootKey: "servers" | "mcpServers",
): Promise<boolean> {
  const contents = await readFile(configPath, "utf8").catch(() => "");
  if (!contents) return false;
  try {
    const parsed = parseJsonConfig(contents, configPath);
    const servers = parsed[rootKey];
    return Boolean(
      servers
      && typeof servers === "object"
      && !Array.isArray(servers)
      && MCP_SERVER_NAME in servers,
    );
  } catch {
    return false;
  }
}

export async function getSetupReadiness(
  repoRoot: string,
  options: { environment?: StoragePathEnvironment; scanFreshness?: boolean } = {},
): Promise<SetupReadinessResult> {
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const codexConfigPath = path.join(resolvedRepoRoot, ".codex", "config.toml");
  const copilotConfigPath = path.join(resolvedRepoRoot, ".vscode", "mcp.json");
  const copilotCliConfigPath = path.join(resolvedRepoRoot, ".mcp.json");
  const [codexContents, hooksDirectory, indexOutcome] = await Promise.all([
    readFile(codexConfigPath, "utf8").catch(() => ""),
    Promise.resolve(resolveGitHooksDirectory(resolvedRepoRoot)),
    diagnostics({ repoRoot: resolvedRepoRoot, scanFreshness: options.scanFreshness ?? true })
      .then((result) => ({ result, error: null }))
      .catch((error) => ({ result: null, error: error instanceof Error ? error.message : String(error) })),
  ]);
  const clients: SetupReadinessResult["local"]["clients"] = [
    { ide: "codex", configPath: codexConfigPath, configured: codexContents.includes(MARKER_BEGIN) },
    { ide: "copilot", configPath: copilotConfigPath, configured: await managedJsonServerExists(copilotConfigPath, "servers") },
    { ide: "copilot-cli", configPath: copilotCliConfigPath, configured: await managedJsonServerExists(copilotCliConfigPath, "mcpServers") },
  ];
  const agentGuidance = await Promise.all([
    path.join(resolvedRepoRoot, "AGENTS.md"),
    path.join(resolvedRepoRoot, ".github", "copilot-instructions.md"),
  ].map(async (policyPath) => ({
    path: policyPath,
    configured: (await readFile(policyPath, "utf8").catch(() => "")).includes(AGENTS_POLICY_BEGIN),
  })));
  const hooks = await Promise.all((["post-commit", "post-checkout", "post-merge"] as const).map(async (hook) => {
    const hookPath = path.join(hooksDirectory ?? path.join(resolvedRepoRoot, ".git", "hooks"), hook);
    const contents = await readFile(hookPath, "utf8").catch(() => "");
    return {
      hook,
      path: hookPath,
      status: contents.includes(GIT_HOOK_BEGIN)
        ? "managed" as const
        : contents.length > 0 ? "other" as const : "missing" as const,
    };
  }));
  const global = await getGlobalInstallationDiagnostics(options.environment);
  const index = indexOutcome.result === null
    ? { status: "unavailable" as const, indexedFiles: 0, retrievalHealth: null, error: indexOutcome.error }
    : {
      status: indexOutcome.result.indexedFiles === 0
        ? "not-indexed" as const
        : indexOutcome.result.staleStatus === "stale" ? "stale" as const : "ready" as const,
      indexedFiles: indexOutcome.result.indexedFiles,
      retrievalHealth: indexOutcome.result.retrievalHealth.status,
      error: null,
    };
  const hasClient = clients.some((client) => client.configured) || global.clients.some((client) => client.configured);
  const actions: string[] = [];
  if (!hasClient) actions.push("Run `astrograph install` to connect an MCP client.");
  if (index.status === "not-indexed") actions.push(`Run \`astrograph cli index-folder --repo ${resolvedRepoRoot}\` to create the first index.`);
  if (index.status === "stale") actions.push(`Run \`astrograph cli index-folder --repo ${resolvedRepoRoot}\` to refresh the index.`);
  if (index.status === "unavailable") actions.push(`Fix the index health error: ${index.error ?? "unknown error"}`);
  if (!agentGuidance.some((entry) => entry.configured)) actions.push("Optional: run `astrograph install --agents` to add tool-priority guidance.");
  if (hooks.some((hook) => hook.status === "missing")) actions.push("Optional: run `astrograph install --git-hooks` to refresh after Git changes.");
  if (hooks.some((hook) => hook.status === "other")) actions.push("Astrograph left another tool’s Git hook unchanged.");

  return {
    schemaVersion: 1,
    repoRoot: resolvedRepoRoot,
    local: {
      clients,
      agentGuidance,
      gitHooks: hooks,
      localDependencyDetected: hasLocalAstrographDependency(resolvedRepoRoot),
    },
    global,
    index,
    ready: hasClient && index.status === "ready" && index.retrievalHealth === "safe",
    actions,
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

function managedConfigForCopilot(ide: InstallIde): InstalledObject {
  const invocation = resolveManagedInvocation();

  if (ide === "copilot-cli") {
    return {
      type: "local",
      command: invocation.command,
      args: invocation.args,
      cwd: ".",
      tools: MCP_TOOLS,
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
  currentContents: string,
): ManagedConfig {
  if (ide === "codex") {
    return {
      configPath: path.join(repoRoot, ".codex", "config.toml"),
      nextContents: replaceManagedBlock(currentContents, astrographConfigBlock()),
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
      managedConfigForCopilot(ide),
    ),
  };
}

export async function setupForIde(
  repoRoot: string,
  { ide = "codex", dryRun = false }: SetupForIdeOptions = {},
): Promise<SetupResult> {
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const { configPath } = resolveManagedConfig(ide, resolvedRepoRoot, "");
  const engineConfigPath = path.join(resolvedRepoRoot, "astrograph.config.json");
  const engineConfigPreview = createMinimalJsonConfig();
  const currentContents = await readFile(configPath, "utf8").catch(() => "");
  const { configPath: finalConfigPath, nextContents } = resolveManagedConfig(
    ide,
    resolvedRepoRoot,
    currentContents,
  );

  if (!dryRun) {
    await mkdir(path.dirname(finalConfigPath), { recursive: true });
    await writeFile(finalConfigPath, nextContents, "utf8");
    await writeFile(engineConfigPath, engineConfigPreview, "utf8");
  }

  return {
    ide,
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
    gitHooks: [],
  };
}

export async function setupForCodex(
  repoRoot: string,
  { dryRun = false }: SetupForIdeOptions = {},
): Promise<SetupResult> {
  return setupForIde(repoRoot, { ide: "codex", dryRun });
}

export async function setupForAllIdes(
  repoRoot: string,
  {
    ides = [...DEFAULT_INSTALL_IDES],
    dryRun = false,
    agentsPolicy = false,
    gitHooks = false,
  }: SetupForAllOptions = {},
): Promise<SetupResult | SetupResult[]> {
  const normalizedIdes = validateIdes({ ides }).ides;
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const packageDependency = await ensureAstrographDependencyInRepo(
    resolvedRepoRoot,
    dryRun,
  );
  const hookResults = gitHooks
    ? await setupGitRefreshHooks(resolvedRepoRoot, { dryRun })
    : [];

  const results: SetupResult[] = [];
  for (const ide of normalizedIdes) {
    const result = await setupForIde(resolvedRepoRoot, { ide, dryRun });
    const agentsPolicyResult = await writeAgentsPolicy(
      resolvedRepoRoot,
      dryRun,
      agentsPolicy,
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
      gitHooks: hookResults,
    });
  }

  return normalizedIdes.length === 1 ? results[0] : results;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--diagnostics") {
    process.stdout.write(`${JSON.stringify(await getGlobalInstallationDiagnostics(), null, 2)}\n`);
    return;
  }
  if (argv[0] === "--doctor") {
    const allowed = new Set(["--doctor", "--repo", "--json"]);
    if (argv.some((entry) => !allowed.has(entry) && entry !== argv[argv.indexOf("--repo") + 1])) {
      throw new Error("astrograph doctor accepts only --repo /abs/repo and --json.");
    }
    const repoIndex = argv.indexOf("--repo");
    if (repoIndex >= 0 && !argv[repoIndex + 1]) {
      throw new Error("astrograph doctor requires a value after --repo.");
    }
    const result = await getSetupReadiness(repoIndex >= 0 ? argv[repoIndex + 1]! : process.cwd());
    if (argv.includes("--json")) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${formatSetupReadiness(result)}\n`);
    }
    return;
  }
  if (
    process.env.ASTROGRAPH_ENTRY_MODE === "install"
    && argv.length === 0
  ) {
    await runGuidedInstall();
    return;
  }
  if (argv.includes("--global")) {
    const allowed = new Set(["--global", "--ide", "codex", "copilot-cli", "--dry-run", "--json"]);
    if (argv.some((entry) => !allowed.has(entry))) {
      throw new Error("astrograph install --global accepts only --ide copilot-cli|codex, --dry-run, and --json.");
    }
    const ideIndex = argv.indexOf("--ide");
    const ide = ideIndex >= 0 ? argv[ideIndex + 1] : DEFAULT_GLOBAL_INSTALL_IDE;
    if (ide !== "codex" && ide !== "copilot-cli") {
      throw new Error("astrograph install --global currently supports only --ide codex or --ide copilot-cli");
    }
    const dryRun = argv.includes("--dry-run");
    const json = argv.includes("--json");
    const interactive = !json && Boolean(process.stdin.isTTY && process.stdout.isTTY);
    const progress = interactive ? spinner() : null;
    if (progress) {
      progress.start(dryRun ? `Previewing ${ide} setup…` : `Connecting Astrograph to ${ide}…`);
    }
    const result = ide === "copilot-cli"
      ? await setupGlobalForCopilotCli({ dryRun })
      : await setupGlobalForCodex({ dryRun });
    if (progress) {
      progress.stop(dryRun ? "Preview ready" : "Connection ready");
      outro(formatGlobalInstallation(result, { dryRun }));
    } else if (json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${formatGlobalInstallation(result, { dryRun })}\n`);
    }
    return;
  }

  const parsed = parseArgs(argv);

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
      dryRun: normalizedArgs.dryRun,
      json: normalizedArgs.json,
      agentsPolicy: normalizedArgs.agentsPolicy,
      gitHooks: normalizedArgs.gitHooks,
    }
    : await promptForSetupArgs();

  const interactive = !args.json && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const progress = interactive ? spinner() : null;
  if (progress) {
    progress.start(args.dryRun ? "Previewing repository setup…" : "Setting up Astrograph…");
  }
  const result = await setupForAllIdes(args.repo, {
    ides: args.ides,
    dryRun: args.dryRun,
    agentsPolicy: args.agentsPolicy,
    gitHooks: args.gitHooks,
  });

  await emitUpdateSuggestion(PACKAGE_VERSION);
  if (progress) {
    progress.stop(args.dryRun ? "Preview ready" : "Repository ready");
    outro(formatRepositoryInstallation(result, { dryRun: args.dryRun }));
  } else if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatRepositoryInstallation(result, { dryRun: args.dryRun })}\n`);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    usage();
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
