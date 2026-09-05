#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import {
  isCancel,
  intro,
  outro,
  spinner,
  select,
  multiselect,
  confirm,
} from "@clack/prompts";
import { Command, Option } from "commander";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { isMainModule } from "../entrypoint.ts";
import { reconcileLocalDaemon } from "../daemon-client.ts";
import { diagnostics, indexFolder } from "../index.ts";
import { resetAstrographStorage } from "../storage.ts";
import { MCP_TOOL_DEFINITIONS } from "../mcp-contract.ts";
import { resolveGlobalCacheRoot, resolveGlobalConfigPath } from "../config.ts";
import { runProcess } from "../lib/process.ts";
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
const MCP_STARTUP_VERIFICATION_TIMEOUT_MS = 5_000;
const ISSUE_URL = "https://github.com/mortenbroesby/astrograph/issues/new";
const TROUBLESHOOTING_URL = "https://github.com/mortenbroesby/astrograph/blob/main/docs/guides/troubleshooting.md";

type InstallIde = (typeof ALL_INSTALL_IDES)[number];
type RequestedIde = InstallIde | "all";
type InstalledObject = Record<string, unknown>;

interface ParsedArgs {
  ides: RequestedIde[] | null;
  scope: "global" | "repository" | null;
  repo: string;
  dryRun: boolean;
  json: boolean;
  nonInteractive: boolean;
  agentsPolicy: boolean;
  gitHooks: boolean;
  reset: boolean;
  verbose?: boolean;
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
  backups: string[];
  stateReset: boolean;
}

interface CliOptions {
  ide?: string;
  scope?: string;
  dryRun?: boolean;
  json?: boolean;
  repo?: string;
  yes?: boolean;
  agents?: boolean;
  gitHooks?: boolean;
  reset?: boolean;
  verbose?: boolean;
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

class ResetRequiredError extends Error {
  readonly code = "RESET_REQUIRED";

  constructor(reason: string) {
    super(`${reason} Re-run with --yes --reset to replace Astrograph's registration and rebuild its state.`);
    this.name = "ResetRequiredError";
  }
}

interface SetupForIdeOptions {
  ide?: InstallIde;
  dryRun?: boolean;
  reset?: boolean;
  /** Internal coordination so an all-client reset archives state exactly once. */
  resetState?: boolean;
}

interface SetupForAllOptions {
  ides?: RequestedIde[];
  dryRun?: boolean;
  agentsPolicy?: boolean;
  gitHooks?: boolean;
  reset?: boolean;
  /** Internal installer seam so reset progress is visible without duplicating the reset. */
  onStateReset?: () => void;
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
  reset?: boolean;
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
  backups: string[];
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

export function installOptionalGlobalCli(
  runner: typeof runProcess = runProcess,
  options: { verbose?: boolean } = {},
): string | null {
  try {
    runner(
      "npm",
      [
        ...(options.verbose ? ["--loglevel", "verbose"] : []),
        "install",
        "--global",
        `${PACKAGE_NAME}@${PACKAGE_VERSION}`,
      ],
      { stdio: "inherit", timeout: 60_000 },
    );
    return null;
  } catch {
    return formatOptionalGlobalCliRecovery();
  }
}

export function formatOptionalGlobalCliRecovery(
  options: { nodeVersion?: string; packageVersion?: string } = {},
): string {
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  const packageVersion = options.packageVersion ?? PACKAGE_VERSION;
  return [
    `The optional \`astrograph\` global command could not be installed for Node.js ${nodeVersion}.`,
    "Your MCP registration is still usable because it runs Astrograph through a pinned npx package.",
    "Retry with the Node runtime you want to use:",
    `  npm install --global ${PACKAGE_NAME}@${packageVersion}`,
    "If npm succeeds but your shell cannot find `astrograph`, follow your runtime manager's documented refresh step (if any), or check `npm prefix --global` and PATH.",
  ].join("\n");
}

export function formatInstallPhase(step: number, total: number, title: string): string {
  return `Step ${step} of ${total} — ${title}`;
}

export function createSanitizedIssueUrl(
  message: string,
  context: { action?: string; ide?: string; scope?: string } = {},
): string {
  const sanitized = message
    .replace(/(?:ghp|github_pat|npm)_[A-Za-z0-9_\-]+/g, "[redacted]")
    .replace(/(?:token|password|secret|authorization)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/(?:\/Users\/[^\s:]+|\/home\/[^\s:]+|[A-Z]:\\[^\s:]+)/g, "[local-path]")
    .replace(/\s+/g, " ")
    .slice(0, 500);
  const body = [
    "<!-- Generated locally. Review before submitting. -->",
    `Astrograph: ${PACKAGE_VERSION}`,
    `Node: ${process.versions.node}`,
    `Platform: ${process.platform} ${process.arch}`,
    `Action: ${context.action ?? "install"}`,
    `Scope: ${context.scope ?? "unknown"}`,
    `Client: ${context.ide ?? "unknown"}`,
    `Failure: ${sanitized}`,
  ].join("\n");
  return `${ISSUE_URL}?${new URLSearchParams({ title: "Installer failure", body }).toString()}`;
}

export interface InstallerFailure {
  kind: "user-or-environment" | "astrograph";
  summary: string;
  nextStep: string;
}

/** Separates recoverable local setup problems from defects in Astrograph itself. */
export function classifyInstallerFailure(error: unknown): InstallerFailure {
  const message = error instanceof Error ? error.message : String(error);
  const summary = message
    .replace(/(?:ghp|github_pat|npm)_[A-Za-z0-9_\-]+/g, "[redacted]")
    .replace(/(?:token|password|secret|authorization)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/(?:\/Users\/[^\s:]+|\/home\/[^\s:]+|[A-Z]:\\\\[^\s:]+)/g, "[local-path]")
    .replace(/\s+/g, " ")
    .slice(0, 500);
  const userOrEnvironment = /(?:requires|unsupported|unknown|invalid|not found|not a git repository|TTY|permission|EACCES|ENOENT|legacy unmarked)/i.test(message);

  return userOrEnvironment
    ? {
      kind: "user-or-environment",
      summary,
      nextStep: "Review the command and local prerequisites, then run `astrograph doctor` for a read-only diagnosis.",
    }
    : {
      kind: "astrograph",
      summary,
      nextStep: "If this persists, use the pre-filled GitHub issue link below and review it before submitting.",
    };
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
  const command = `astrograph install --yes --scope global --ide ${result.ide}`;
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
    ...(result.backups.length ? [`Backups: ${result.backups.join(", ")}`] : []),
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
    ...(first.backups.length ? [`Backups: ${first.backups.join(", ")}`] : []),
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

function usage(): void {
  process.stderr.write(
    [
      "Usage:",
      "  npx astrograph install [--verbose] [--yes] [--agents] [--git-hooks] [--ide codex|copilot|copilot-cli|all|codex,copilot,...] [--repo /abs/repo] [--dry-run] [--json]",
      "",
      "Defaults:",
      "  - repo: current git worktree, or current directory",
      "  - IDE: Codex",
      "  - writes: astrograph.config.ts and managed MCP config",
      "  - optional: --agents adds a tailored agent instruction file for each IDE:",
      "      codex       → AGENTS.md",
      "      copilot     → .github/copilot-instructions.md",
      "      copilot-cli → AGENTS.md",
      "  - optional: --git-hooks adds non-blocking post-commit, post-checkout, and post-merge index refresh hooks when those hooks are not owned by another tool",
      "  - never changes package.json or installs dependencies",
      "",
      "Examples:",
      "  npx astrograph install",
      "  npx astrograph install --verbose",
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
  return (major === 20 && minor >= 19) || major > 22 || (major === 22 && minor >= 12);
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
      minimumNodeVersion: "20.19.0",
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
      { ide: "copilot-cli", configPath: copilotConfigPath, configured: await managedJsonServerExists(copilotConfigPath, "mcpServers") },
      { ide: "codex", configPath: codexConfigPath, configured: (await readOptionalConfig(codexConfigPath)).includes(MARKER_BEGIN) },
    ],
    nextStep: storageLocation === "global" && await managedJsonServerExists(copilotConfigPath, "mcpServers")
      ? "Open Copilot CLI in a repository and use Astrograph normally; run index_folder when that repository has no index."
      : "Run astrograph install --yes --scope global --ide copilot-cli to register Astrograph and enable isolated global cache storage.",
  };
}

function isInstallIde(value: string): boolean {
  return value === "codex" || value === "copilot" || value === "copilot-cli";
}

function verboseLine(enabled: boolean | undefined, message: string): void {
  if (enabled) process.stderr.write(`Astrograph: ${message}\n`);
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    return {
      ides: null,
      scope: null,
      repo: process.cwd(),
      dryRun: false,
      json: false,
      nonInteractive: false,
      agentsPolicy: false,
      gitHooks: false,
      reset: false,
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
    "--scope",
    "--reset",
    "--verbose",
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
    .addOption(new Option("--ide <ide-list>", "Comma-separated IDE list.").default(undefined))
    .addOption(new Option("--scope <scope>", "Setup scope: global or repository.").choices(["global", "repository"]))
    .addOption(new Option("--reset", "Confirm clean replacement of obsolete Astrograph setup and state."))
    .addOption(new Option("--verbose", "Show detailed npm output during guided global command installation."));

  let options: CliOptions;
  try {
    program.parse(["node", "astrograph-init", ...argv], { from: "node" });
    options = program.opts<CliOptions>();
  } catch (error) {
    const commanderError = error as { code?: string; message?: string };
    if (commanderError.code === "commander.helpDisplayed") {
      return {
        ides: null,
        scope: null,
        repo: process.cwd(),
        dryRun: false,
        json: false,
        nonInteractive: false,
        agentsPolicy: false,
        gitHooks: false,
        reset: false,
        hasExplicitArgs: false,
        showHelp: true,
      };
    }
    throw new Error(commanderError.message ?? String(error));
  }

  if (options.help) {
    return {
      ides: null,
      scope: null,
      repo: process.cwd(),
      dryRun: false,
      json: false,
      nonInteractive: false,
      agentsPolicy: false,
      gitHooks: false,
      reset: false,
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
    scope: options.scope === "global" || options.scope === "repository" ? options.scope : null,
    repo: options.repo ?? process.cwd(),
    dryRun: Boolean(options.dryRun),
    json: Boolean(options.json),
    nonInteractive: Boolean(options.yes),
    agentsPolicy: Boolean(options.agents),
    gitHooks: Boolean(argv.includes("--git-hooks")),
    reset: Boolean(argv.includes("--reset")),
    verbose: Boolean(options.verbose),
    hasExplicitArgs:
      hasFlag("yes") ||
      hasFlag("dry-run") ||
      hasFlag("json") ||
      hasFlag("repo") ||
      hasFlag("ide") ||
      hasFlag("scope") ||
      hasFlag("reset"),
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

async function promptForSetupArgs(defaults: { agentsPolicy?: boolean; gitHooks?: boolean } = {}): Promise<{
  ides: RequestedIde[];
  repo: string;
  dryRun: boolean;
  json: boolean;
  agentsPolicy: boolean;
  gitHooks: boolean;
  reset: boolean;
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

  const ides = await multiselect({
    message: "Where should Astrograph be added?",
    options: [
      { value: "codex", label: "Codex", hint: "Writes .codex/config.toml" },
      { value: "copilot", label: "GitHub Copilot", hint: "Writes .vscode/mcp.json" },
      { value: "copilot-cli", label: "GitHub Copilot CLI", hint: "Writes .mcp.json" },
    ],
    initialValues: ["codex"],
    required: true,
  });

  if (isCancel(ides) || !Array.isArray(ides) || ides.some((ide) => !isInstallIde(ide))) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  const selectedIdes = validateIdes({ ides: ides as RequestedIde[] }).ides;
  const resetReason = await findResetRequirement(resolvedRepo, selectedIdes);
  const reset = resetReason
    ? await confirm({
      message: `Astrograph needs a clean reset because ${resetReason}. It cannot migrate pre-1.0 setup. Back up changed config, replace only Astrograph's registration where safe, and rebuild Astrograph state?`,
      initialValue: false,
    })
    : false;
  if (isCancel(reset) || reset === false && resetReason) {
    outro("Setup cancelled. No files were changed.");
    process.exit(0);
  }

  const policyFileHint = ides.length === 1 && ides[0] === "copilot"
    ? ".github/copilot-instructions.md"
    : "AGENTS.md";

  const agentsPolicy = await confirm({
    message: `Add Astrograph code exploration policy to ${policyFileHint}?`,
    initialValue: defaults.agentsPolicy ?? false,
  });

  if (isCancel(agentsPolicy)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  const gitHooks = await confirm({
    message: "Keep the index fresh after commits, branch switches, and merges?",
    initialValue: defaults.gitHooks ?? false,
  });

  if (isCancel(gitHooks)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  const preview = await setupForAllIdes(resolvedRepo, {
    ides: ides as RequestedIde[],
    dryRun: true,
    agentsPolicy: Boolean(agentsPolicy),
    gitHooks: Boolean(gitHooks),
    reset: Boolean(reset),
  });
  const previewResults = Array.isArray(preview) ? preview : [preview];
  process.stdout.write(`\nReview (no files changed):\n${previewResults.map((result) => `- ${result.configPath}\n- ${result.engineConfigPath}`).join("\n")}\n`);

  const confirmWrite = await confirm({
    message: `Review complete. Write the managed ${ides.join(", ")} setup to ${resolvedRepo}?`,
    initialValue: true,
  });
  if (isCancel(confirmWrite) || confirmWrite === false) {
    outro("Setup cancelled. No files were changed.");
    process.exit(0);
  }

  return {
    ides: ides as RequestedIde[],
    repo: resolvedRepo,
    dryRun: false,
    json: false,
    agentsPolicy: Boolean(agentsPolicy),
    gitHooks: Boolean(gitHooks),
    reset: Boolean(reset),
  };
}

async function findResetRequirement(repoRoot: string, ides: InstallIde[]): Promise<string | null> {
  for (const ide of ides) {
    const { configPath } = resolveManagedConfig(ide, repoRoot, "");
    const currentContents = await readFile(configPath, "utf8").catch(() => "");
    try {
      resolveManagedConfig(ide, repoRoot, currentContents, false);
    } catch (error) {
      const resetReason = resetRequirementFromError(error);
      if (resetReason) return resetReason;
      throw error;
    }
  }
  return null;
}

function resetRequirementFromError(error: unknown): string | null {
  return error instanceof ResetRequiredError ? error.message : null;
}

async function findGlobalResetRequirement(ide: "codex" | "copilot-cli"): Promise<string | null> {
  try {
    if (ide === "codex") {
      await setupGlobalForCodex({ dryRun: true });
    } else {
      await setupGlobalForCopilotCli({ dryRun: true });
    }
    return null;
  } catch (error) {
    const resetReason = resetRequirementFromError(error);
    if (resetReason) return resetReason;
    throw error;
  }
}

async function runGuidedInstall(options: { verbose?: boolean; agentsPolicy?: boolean; gitHooks?: boolean } = {}): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Guided install requires a TTY. Use `astrograph install --yes --scope repository --ide codex` for repository setup or `astrograph install --yes --scope global --ide codex|copilot-cli` for global setup.",
    );
  }

  intro("Astrograph setup");
  verboseLine(options.verbose, "Inspecting the current setup…");
  const readiness = await getSetupReadiness(process.cwd(), { scanFreshness: false });
  const configuredClients = [
    ...readiness.local.clients
      .filter((client) => client.configured)
      .map((client) => ({ scope: "repository" as const, ide: client.ide as InstallIde, label: `${client.ide} in this repository` })),
    ...readiness.global.clients
      .filter((client) => client.configured)
      .map((client) => ({ scope: "global" as const, ide: client.ide as "codex" | "copilot-cli", label: `${client.ide} for this device` })),
  ];
  if (configuredClients.length > 0) {
    const action = await select({
      message: formatSetupReadiness(readiness),
      options: [
        { value: "index", label: "Refresh this repository's index" },
        { value: "update", label: "Reapply the installed registration" },
        { value: "repair", label: "Repair the installed registration" },
        { value: "setup", label: "Review or change setup" },
        { value: "uninstall", label: "Remove one Astrograph registration" },
        { value: "exit", label: "Exit" },
      ],
      initialValue: readiness.ready ? "exit" : "setup",
    });
    if (isCancel(action) || action === "exit") {
      outro("No changes made.");
      return;
    }
    if (action === "index") {
      await indexFolder({ repoRoot: readiness.repoRoot });
      outro("Index refreshed.");
      return;
    }
    if (action === "update" || action === "repair" || action === "uninstall") {
      const target = await select({
        message: "Which managed registration should change?",
        options: configuredClients.map((client) => ({
          value: `${client.scope}:${client.ide}`,
          label: client.label,
        })),
      });
      if (isCancel(target) || typeof target !== "string") {
        outro("No changes made.");
        return;
      }
      const [targetScope, targetIde] = target.split(":") as ["global" | "repository", InstallIde];
      const confirmed = await confirm({
        message: action === "uninstall"
          ? `Remove only Astrograph's ${targetIde} registration? Index and cache data will stay untouched.`
          : `${action[0]!.toUpperCase()}${action.slice(1)} Astrograph's ${targetIde} registration?`,
        initialValue: false,
      });
      if (isCancel(confirmed) || confirmed === false) {
        outro("No changes made.");
        return;
      }
      if (action === "uninstall") {
        const result = await uninstallManagedRegistration(readiness.repoRoot, {
          scope: targetScope,
          ide: targetIde,
        });
        outro(result.changed ? "Registration removed. Index and cache data were left untouched." : "No managed registration was found.");
        return;
      }
      const resetReason = targetScope === "global"
        ? await findGlobalResetRequirement(targetIde as "codex" | "copilot-cli")
        : await findResetRequirement(readiness.repoRoot, [targetIde]);
      const reset = resetReason
        ? await confirm({
          message: `Astrograph needs a clean reset because ${resetReason}. It cannot migrate pre-1.0 setup. Replace Astrograph-owned configuration/state now?`,
          initialValue: false,
        })
        : false;
      if (isCancel(reset) || reset === false && resetReason) {
        outro("No changes made.");
        return;
      }
      const result = targetScope === "global"
        ? targetIde === "codex" ? await setupGlobalForCodex({ reset: Boolean(reset) }) : await setupGlobalForCopilotCli({ reset: Boolean(reset) })
        : await setupForAllIdes(readiness.repoRoot, { ides: [targetIde], reset: Boolean(reset) });
      outro(targetScope === "global"
        ? formatGlobalInstallation(result as GlobalSetupResult)
        : formatRepositoryInstallation(result as SetupResult | SetupResult[]));
      return;
    }
  }
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
    const args = await promptForSetupArgs(options);
    verboseLine(options.verbose, `Preparing repository setup for ${args.ides.join(", ")}…`);
    const result = await setupForAllIdes(args.repo, {
      ides: args.ides,
      dryRun: args.dryRun,
      agentsPolicy: args.agentsPolicy,
      gitHooks: args.gitHooks,
      reset: args.reset,
    });
    const shouldIndex = await confirm({ message: "Create the initial index now?", initialValue: true });
    if (isCancel(shouldIndex)) {
      outro("Setup complete. The index was not created.");
      return;
    }
    if (shouldIndex) await indexFolder({ repoRoot: args.repo });
    outro(formatRepositoryInstallation(result, { dryRun: args.dryRun }));
    return;
  }

  const ides = await multiselect({
    message: "Which global clients should Astrograph connect to?",
    options: [
      { value: "codex", label: "Codex", hint: "Writes only ~/.codex/config.toml" },
      { value: "copilot-cli", label: "GitHub Copilot CLI", hint: "Writes only ~/.copilot/mcp-config.json" },
    ],
    initialValues: [DEFAULT_GLOBAL_INSTALL_IDE],
    required: true,
  });
  if (isCancel(ides) || !Array.isArray(ides) || ides.some((ide) => ide !== "codex" && ide !== "copilot-cli")) {
    outro("Setup cancelled.");
    return;
  }
  const shouldInstallGlobalCli = await confirm({
    message: "Also install the optional `astrograph` command globally with npm? This may need npm prefix/PATH attention if you use another package manager.",
    initialValue: false,
  });
  if (isCancel(shouldInstallGlobalCli)) {
    outro("Setup cancelled. No client configuration was changed.");
    return;
  }

  const globalPreviews = [] as GlobalSetupResult[];
  const resetIdes = new Set<"codex" | "copilot-cli">();
  verboseLine(options.verbose, `Previewing global setup for ${ides.join(", ")}…`);
  for (const ide of ides) {
    try {
      globalPreviews.push(ide === "codex"
        ? await setupGlobalForCodex({ dryRun: true })
        : await setupGlobalForCopilotCli({ dryRun: true }));
    } catch (error) {
      const resetReason = resetRequirementFromError(error);
      if (!resetReason) throw error;
      const confirmedReset = await confirm({
        message: `Astrograph needs a clean reset because ${resetReason}. It cannot migrate pre-1.0 setup. Replace Astrograph-owned configuration/state now?`,
        initialValue: false,
      });
      if (isCancel(confirmedReset) || confirmedReset === false) {
        outro("Setup cancelled. No client configuration was changed.");
        return;
      }
      resetIdes.add(ide);
      globalPreviews.push(ide === "codex"
        ? await setupGlobalForCodex({ dryRun: true, reset: true })
        : await setupGlobalForCopilotCli({ dryRun: true, reset: true }));
    }
  }
  process.stdout.write(`\nReview (no files changed):\n${globalPreviews.map((result) => `- ${result.configPath}\n- ${result.engineConfigPath}`).join("\n")}\n`);

  const confirmWrite = await confirm({
    message: `Review complete. Write the managed ${ides.join(", ")} registration?`,
    initialValue: true,
  });
  if (isCancel(confirmWrite) || confirmWrite === false) {
    outro("Setup cancelled. No client configuration was changed.");
    return;
  }

  const totalPhases = shouldInstallGlobalCli ? 4 : 3;
  process.stdout.write(`\n${formatInstallPhase(1, totalPhases, "Validating your selected setup")}\n`);
  const progress = spinner();
  progress.start("Connecting your selected client…");
  let optionalCliWarning = "";
  if (shouldInstallGlobalCli) {
    progress.stop("Preparing optional global command installation…");
    process.stdout.write(`${formatInstallPhase(2, totalPhases, "Installing the optional Astrograph command")}\n`);
    const npmCommand = [
      "npm",
      ...(options.verbose ? ["--loglevel", "verbose"] : []),
      "install",
      "--global",
      `${PACKAGE_NAME}@${PACKAGE_VERSION}`,
    ].join(" ");
    process.stdout.write([
      "",
      "Optional global command installation",
      `  Command: ${npmCommand}`,
      `  Node: ${process.version}`,
      "  This only adds the `astrograph` shell command; your MCP registration is configured next even if this step fails.",
      "  It stops after one minute instead of waiting indefinitely.",
      options.verbose
        ? "  Detailed npm output follows."
        : "  Re-run with `npx --yes astrograph install --verbose` to see detailed npm output.",
      "",
    ].join("\n"));
    optionalCliWarning = installOptionalGlobalCli(undefined, options) ?? "";
    process.stdout.write(`${formatInstallPhase(3, totalPhases, "Updating Astrograph configuration")}\n`);
    progress.start("Writing the managed client registration…");
  } else {
    process.stdout.write(`${formatInstallPhase(2, totalPhases, "Updating Astrograph configuration")}\n`);
  }
  const results = [] as GlobalSetupResult[];
  verboseLine(options.verbose, `Writing global registrations for ${ides.join(", ")}…`);
  for (const ide of ides) {
    results.push(ide === "codex"
      ? await setupGlobalForCodex({ reset: resetIdes.has(ide) })
      : await setupGlobalForCopilotCli({ reset: resetIdes.has(ide) }));
  }
  const output = results.map((result) => formatGlobalInstallation(result)).join("\n\n");
  progress.stop("Global setup ready");
  process.stdout.write(`${formatInstallPhase(totalPhases, totalPhases, "Verifying the registration")}\n`);
  const shouldIndex = await confirm({ message: "Also create an index for this repository now?", initialValue: false });
  if (isCancel(shouldIndex)) {
    outro([output, optionalCliWarning].filter(Boolean).join("\n\n"));
    return;
  }
  if (shouldIndex) await indexFolder({ repoRoot: resolveRepoRoot(process.cwd()) });
  outro([output, optionalCliWarning].filter(Boolean).join("\n\n"));
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

async function ensureAstrographDependencyInRepo(
  repoRoot: string,
  _dryRun: boolean,
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
  return {
    packageDependencyUpdated: false,
    packageDependencyReason: dependencyFieldHasAstrograph(parsed)
      ? "existing Astrograph dependency left unchanged"
      : "package dependency not changed",
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
    args: ["-y", "--package", `${PACKAGE_NAME}@${PACKAGE_VERSION}`, "astrograph", "mcp"],
  };
}

function createMinimalTsConfig(): string {
  return [
    "export default {",
    '  storageLocation: "repo-local",',
    "  performance: {",
    '    exclude: ["node_modules/**", "dist/**", "coverage/**", ".git/**"],',
    "  },",
    '} satisfies import("astrograph").RepoEngineConfig;',
    "",
  ].join("\n");
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
  const invocation = resolveManagedInvocation();
  const args = invocation.args.map((arg) => `"${arg}"`).join(", ");
  return `${MARKER_BEGIN}
[mcp_servers.astrograph]
command = "${invocation.command}"
args = [${args}]
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

function assertGlobalInstallPrerequisites(
  options: SetupGlobalClientOptions,
): void {
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  if (!nodeVersionSupported(nodeVersion)) {
    throw new Error(`Astrograph global install requires Node.js 20.19+ or >=22.12.0; found ${nodeVersion}. Install a supported Node release and retry.`);
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

async function backupExistingConfig(configPath: string, contents: string): Promise<string | null> {
  if (!contents) return null;
  const backupDirectory = path.join(path.dirname(configPath), ".astrograph-backups");
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath = path.join(backupDirectory, `${path.basename(configPath)}.${timestamp}.${randomUUID()}.bak`);
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await writeFile(backupPath, contents, { encoding: "utf8", mode: 0o600 });
  return backupPath;
}

async function backupChangedConfigs(entries: Array<{ path: string; current: string; next: string }>): Promise<string[]> {
  const backups: string[] = [];
  for (const entry of entries) {
    if (entry.current === entry.next) continue;
    const backup = await backupExistingConfig(entry.path, entry.current);
    if (backup) backups.push(backup);
  }
  return backups;
}

interface ManagedConfigWrite {
  path: string;
  current: string;
  next: string;
  mode?: number;
}

async function writeManagedConfigs(entries: ManagedConfigWrite[], verify?: () => Promise<void>): Promise<string[]> {
  const changedEntries = entries.filter((entry) => entry.current !== entry.next);
  await reconcileLocalDaemon();
  const backups = await backupChangedConfigs(changedEntries);
  const written: ManagedConfigWrite[] = [];
  try {
    for (const entry of changedEntries) {
      await writeFile(entry.path, entry.next, entry.mode === undefined
        ? "utf8"
        : { encoding: "utf8", mode: entry.mode });
      written.push(entry);
    }
    await verify?.();
    return backups;
  } catch (error) {
    await Promise.all(written.reverse().map(async (entry) => {
      if (entry.current) {
        await writeFile(entry.path, entry.current, entry.mode === undefined
          ? "utf8"
          : { encoding: "utf8", mode: entry.mode });
      } else {
        await rm(entry.path, { force: true });
      }
    }));
    throw error;
  }
}

async function verifyManagedRegistration(configPath: string, ide: "codex" | "copilot" | "copilot-cli"): Promise<void> {
  const contents = await readFile(configPath, "utf8");
  if (ide === "codex") {
    assertTomlStructurallyValid(contents, configPath);
    if (!contents.includes(MARKER_BEGIN) || !contents.includes(MARKER_END)) {
      throw new Error(`Managed Codex registration verification failed for ${configPath}`);
    }
    return;
  }
  const parsed = parseJsonConfig(contents, configPath);
  const servers = parsed[ide === "copilot" ? "servers" : "mcpServers"];
  if (!servers || typeof servers !== "object" || Array.isArray(servers) || !(MCP_SERVER_NAME in servers)) {
    throw new Error(`Managed ${ide} registration verification failed for ${configPath}`);
  }
}

/**
 * Detect the structural TOML failures that make it unsafe to append a managed
 * block. This deliberately is not a permissive legacy parser: an uncertain
 * file is reset only after the caller has explicitly confirmed replacement.
 */
function assertTomlStructurallyValid(contents: string, configPath: string): void {
  let quote: '"' | "'" | null = null;
  let escaped = false;
  const delimiters: string[] = [];
  for (const character of contents) {
    if (quote) {
      if (quote === '"' && escaped) {
        escaped = false;
      } else if (quote === '"' && character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[" || character === "{") {
      delimiters.push(character);
    } else if (character === "]" || character === "}") {
      const opening = delimiters.pop();
      if ((character === "]" && opening !== "[") || (character === "}" && opening !== "{")) {
        throw new Error(`Invalid Codex config ${path.basename(configPath)}: unmatched ${character}. See ${TROUBLESHOOTING_URL}`);
      }
    }
  }
  if (quote || delimiters.length > 0) {
    throw new Error(`Invalid Codex config ${path.basename(configPath)}: unterminated string or value. See ${TROUBLESHOOTING_URL}`);
  }
}

async function verifyLocalMcpStartup(): Promise<void> {
  const builtEntry = path.join(packageRoot, "dist", "mcp.js");
  const sourceEntry = path.join(packageRoot, "src", "mcp.ts");
  const child = spawn(
    process.execPath,
    existsSync(builtEntry)
      ? ["--no-warnings", builtEntry]
      : ["--no-warnings", "--import=tsx", sourceEntry],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const result = await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Astrograph MCP startup verification timed out after ${MCP_STARTUP_VERIFICATION_TIMEOUT_MS / 1_000} seconds`)),
      MCP_STARTUP_VERIFICATION_TIMEOUT_MS,
    );
    const finish = (error?: Error) => {
      clearTimeout(timer);
      child.kill();
      error ? reject(error) : resolve();
    };
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      for (const line of stdout.split("\n")) {
        try {
          const message = JSON.parse(line) as { id?: number; result?: unknown };
          if (message.id === 1 && message.result) finish();
        } catch {
          // Wait for a complete JSON-RPC line.
        }
      }
    });
    child.once("error", (error) => finish(new Error(`Astrograph MCP startup verification failed: ${error.message}`)));
    child.once("exit", (code) => {
      if (code !== null) finish(new Error(`Astrograph MCP exited during startup verification (code ${code})`));
    });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "astrograph-installer", version: PACKAGE_VERSION } },
    })}\n`);
  });
  await result;
}

let localMcpStartupVerifier: () => Promise<void> = verifyLocalMcpStartup;

/** Test seam for proving managed writes roll back when the local server cannot start. */
export function setLocalMcpStartupVerifierForTest(verifier: (() => Promise<void>) | null): void {
  localMcpStartupVerifier = verifier ?? verifyLocalMcpStartup;
}

export async function setupGlobalForCodex(
  options: SetupGlobalClientOptions = {},
): Promise<GlobalSetupResult> {
  const { dryRun = false, reset = false, environment = {} } = options;
  assertGlobalInstallPrerequisites({ ...options, environment });
  const configPath = resolveGlobalCodexConfigPath(environment);
  const engineConfigPath = resolveGlobalConfigPath(environment);
  const currentCodexConfig = await readOptionalConfig(configPath);
  const currentEngineConfig = await readOptionalConfig(engineConfigPath);
  const configPreview = replaceManagedBlock(currentCodexConfig, globalAstrographConfigBlock(), reset);
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
      const backups = await writeManagedConfigs([
        { path: engineConfigPath, current: currentEngineConfig, next: engineConfigPreview, mode: 0o600 },
        { path: configPath, current: currentCodexConfig, next: configPreview, mode: 0o600 },
      ], async () => {
        parseGlobalConfig(await readFile(engineConfigPath, "utf8"), engineConfigPath);
        await verifyManagedRegistration(configPath, "codex");
        await localMcpStartupVerifier();
      });
      return {
        ide: "codex",
        configPath,
        engineConfigPath,
        configPreview,
        engineConfigPreview,
        backups,
      };
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
    backups: [],
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
  const invocation = resolveManagedInvocation();
  return {
    type: "local",
    command: invocation.command,
    args: invocation.args,
    cwd: ".",
    env: {},
    tools: MCP_TOOLS,
  };
}

export async function setupGlobalForCopilotCli(
  options: SetupGlobalClientOptions = {},
): Promise<GlobalSetupResult> {
  const { dryRun = false, reset = false, environment = {} } = options;
  assertGlobalInstallPrerequisites({ ...options, environment });
  const configPath = resolveGlobalCopilotCliConfigPath(environment);
  const engineConfigPath = resolveGlobalConfigPath(environment);
  const currentCopilotConfig = await readOptionalConfig(configPath);
  const currentEngineConfig = await readOptionalConfig(engineConfigPath);
  const configPreview = replaceManagedServerInJson(
    currentCopilotConfig,
    configPath,
    "mcpServers",
    globalCopilotCliServer(),
    reset,
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
      const backups = await writeManagedConfigs([
        { path: engineConfigPath, current: currentEngineConfig, next: engineConfigPreview, mode: 0o600 },
        { path: configPath, current: currentCopilotConfig, next: configPreview, mode: 0o600 },
      ], async () => {
        parseGlobalConfig(await readFile(engineConfigPath, "utf8"), engineConfigPath);
        await verifyManagedRegistration(configPath, "copilot-cli");
        await localMcpStartupVerifier();
      });
      return {
        ide: "copilot-cli",
        configPath,
        engineConfigPath,
        configPreview,
        engineConfigPreview,
        backups,
      };
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
    backups: [],
  };
}

function replaceManagedBlock(contents: string, block: string, reset = false): string {
  try {
    assertTomlStructurallyValid(contents, "config.toml");
  } catch (error) {
    if (!reset) throw new ResetRequiredError(error instanceof Error ? error.message : String(error));
    return `${block}\n`;
  }
  if (contents.includes(MARKER_BEGIN) && contents.includes(MARKER_END)) {
    const currentBlock = contents.match(new RegExp(`${MARKER_BEGIN}[\\s\\S]*?${MARKER_END}`, "m"))?.[0] ?? "";
    if (!currentBlock.includes(`${PACKAGE_NAME}@${PACKAGE_VERSION}`) && !reset) {
      throw new ResetRequiredError("Astrograph setup version does not match this package. It is not migrated.");
    }
    return contents.replace(
      new RegExp(`${MARKER_BEGIN}[\\s\\S]*?${MARKER_END}`, "m"),
      block,
    );
  }

  const legacyBlockPattern =
    /^\[mcp_servers\.astrograph\][\s\S]*?(?=^\[(?!mcp_servers\.astrograph\b).+\]|\Z)/m;

  if (legacyBlockPattern.test(contents)) {
    if (!reset) {
      throw new ResetRequiredError("Found obsolete unmarked Astrograph setup. It is not migrated.");
    }
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
    "- Start with `get_project_status` for the current repository. If the index is missing, stale, or unavailable, run `index_folder`, wait for it to finish, then retry the Astrograph request.",
    "- Before reading a symbol, use `get_symbol_source`; before reading a file, use `get_file_outline` or `get_file_summary`.",
    "- Before searching broadly, use `search_symbols`, `find_files`, or `search_text`.",
    "- For bounded implementation context, use `get_task_context`.",
    "- Before exploring structure, use `get_file_tree` or `get_repo_outline`.",
    "- Do not fall back to raw file reads or shell search merely because an index is absent. Use them only after indexing and the retry fail, and state why.",
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
    "- Use `get_project_status` to check the index. If it is missing, stale, or unavailable, run `index_folder`, wait for it to finish, then retry the Astrograph request.",
    "- Use `get_file_outline`, `get_file_summary`, or `get_symbol_source` before opening raw source.",
    "- Use `search_symbols`, `find_files`, or `search_text` for discovery.",
    "- Use `get_task_context` for bounded implementation context.",
    "- Use `get_file_tree` or `get_repo_outline` to understand structure.",
    "- Do not fall back to raw file access merely because an index is absent. Use it only after indexing and the retry fail, and state why.",
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
    `npx -y --package ${PACKAGE_NAME}@${PACKAGE_VERSION} astrograph git-refresh ${args} >/dev/null 2>&1 &`,
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
    diagnostics({
      repoRoot: resolvedRepoRoot,
      scanFreshness: options.scanFreshness ?? true,
      readOnly: options.scanFreshness === false,
    })
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
  reset = false,
): string {
  let parsed: InstalledObject;
  try {
    parsed = parseJsonConfig(contents, configPath);
  } catch (error) {
    if (!reset) throw new ResetRequiredError(error instanceof Error ? error.message : String(error));
    return JSON.stringify({
      [rootKey]: { [MCP_SERVER_NAME]: managedServer },
    }, null, 2) + "\n";
  }
  const existing = parsed[rootKey];

  if (existing != null && (typeof existing !== "object" || Array.isArray(existing))) {
    if (!reset) throw new ResetRequiredError(`Invalid ${rootKey} entry in ${path.basename(configPath)}.`);
    return JSON.stringify({
      ...parsed,
      [rootKey]: { [MCP_SERVER_NAME]: managedServer },
    }, null, 2) + "\n";
  }

  const nextServers = {
    ...(existing == null || typeof existing !== "object" ? {} : existing),
    [MCP_SERVER_NAME]: managedServer,
  };
  const currentServer = existing && typeof existing === "object" && !Array.isArray(existing)
    ? (existing as InstalledObject)[MCP_SERVER_NAME]
    : undefined;
  if (currentServer && !JSON.stringify(currentServer).includes(`${PACKAGE_NAME}@${PACKAGE_VERSION}`) && !reset) {
    throw new ResetRequiredError("Astrograph setup version does not match this package. It is not migrated.");
  }

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
  reset = false,
): ManagedConfig {
  if (ide === "codex") {
    return {
      configPath: path.join(repoRoot, ".codex", "config.toml"),
      nextContents: replaceManagedBlock(currentContents, astrographConfigBlock(), reset),
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
      reset,
    ),
  };
}

function removeManagedBlock(contents: string): string {
  if (!contents.includes(MARKER_BEGIN) || !contents.includes(MARKER_END)) return contents;
  return contents
    .replace(new RegExp(`\\n?${MARKER_BEGIN}[\\s\\S]*?${MARKER_END}\\n?`, "m"), "")
    .replace(/^\\n+/, "");
}

function removeManagedServerInJson(
  contents: string,
  configPath: string,
  rootKey: "servers" | "mcpServers",
): string {
  const parsed = parseJsonConfig(contents, configPath);
  const existing = parsed[rootKey];
  if (existing == null || typeof existing !== "object" || Array.isArray(existing)) return contents;
  const servers = { ...(existing as InstalledObject) };
  if (!(MCP_SERVER_NAME in servers)) return contents;
  delete servers[MCP_SERVER_NAME];
  return JSON.stringify({ ...parsed, [rootKey]: servers }, null, 2) + "\n";
}

export async function uninstallManagedRegistration(
  repoRoot: string,
  options: { scope: "global" | "repository"; ide: "codex" | "copilot" | "copilot-cli"; dryRun?: boolean; environment?: StoragePathEnvironment },
): Promise<{ scope: "global" | "repository"; ide: string; configPath: string; changed: boolean; preview: string; backups: string[] }> {
  const { scope, ide, dryRun = false, environment = {} } = options;
  if (scope === "global" && ide === "copilot") {
    throw new Error("Global uninstall supports only Codex or Copilot CLI.");
  }
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const configPath = scope === "global"
    ? ide === "codex" ? resolveGlobalCodexConfigPath(environment) : resolveGlobalCopilotCliConfigPath(environment)
    : ide === "codex" ? path.join(resolvedRepoRoot, ".codex", "config.toml")
    : ide === "copilot" ? path.join(resolvedRepoRoot, ".vscode", "mcp.json")
    : path.join(resolvedRepoRoot, ".mcp.json");
  const current = await readOptionalConfig(configPath);
  const preview = ide === "codex"
    ? removeManagedBlock(current)
    : removeManagedServerInJson(current, configPath, ide === "copilot" ? "servers" : "mcpServers");
  const changed = preview !== current;
  const backups = !dryRun && changed
    ? await writeManagedConfigs([{ path: configPath, current, next: preview, mode: scope === "global" ? 0o600 : undefined }])
    : [];
  return { scope, ide, configPath, changed, preview, backups };
}

export async function setupForIde(
  repoRoot: string,
  { ide = "codex", dryRun = false, reset = false, resetState = true }: SetupForIdeOptions = {},
): Promise<SetupResult> {
  const resolvedRepoRoot = resolveRepoRoot(repoRoot);
  const { configPath } = resolveManagedConfig(ide, resolvedRepoRoot, "");
  const engineConfigPath = path.join(resolvedRepoRoot, "astrograph.config.ts");
  const engineConfigPreview = createMinimalTsConfig();
  const currentContents = await readFile(configPath, "utf8").catch(() => "");
  const currentEngineConfig = await readFile(engineConfigPath, "utf8").catch(() => "");
  const { configPath: finalConfigPath, nextContents } = resolveManagedConfig(
    ide,
    resolvedRepoRoot,
    currentContents,
    reset,
  );

  if (!dryRun) {
    await mkdir(path.dirname(finalConfigPath), { recursive: true });
    const backups = await writeManagedConfigs([
      { path: finalConfigPath, current: currentContents, next: nextContents },
      { path: engineConfigPath, current: currentEngineConfig, next: engineConfigPreview },
    ], async () => {
      await verifyManagedRegistration(finalConfigPath, ide);
      await localMcpStartupVerifier();
      const verifiedEngine = await readFile(engineConfigPath, "utf8");
      if (verifiedEngine !== engineConfigPreview) throw new Error(`Astrograph config verification failed for ${engineConfigPath}`);
    });
    const stateReset = reset && resetState ? (await resetAstrographStorage(resolvedRepoRoot)).changed : false;
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
      packageDependencyReason: "package dependency not changed",
      agentsPolicyPath: path.join(resolvedRepoRoot, "AGENTS.md"),
      agentsPolicyUpdated: false,
      agentsPolicyReason: "not requested",
      gitHooks: [],
      backups,
      stateReset,
    };
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
    packageDependencyReason: "package dependency not changed",
    agentsPolicyPath: path.join(resolvedRepoRoot, "AGENTS.md"),
    agentsPolicyUpdated: false,
    agentsPolicyReason: "not requested",
    gitHooks: [],
    backups: [],
    stateReset: false,
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
    reset = false,
    onStateReset,
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
    const result = await setupForIde(resolvedRepoRoot, { ide, dryRun, reset, resetState: false });
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

  if (reset && !dryRun && results.length > 0) {
    onStateReset?.();
    const stateReset = await resetAstrographStorage(resolvedRepoRoot);
    results[0] = { ...results[0]!, stateReset: stateReset.changed };
  }

  return normalizedIdes.length === 1 ? results[0] : results;
}

async function runLifecycle(action: "update" | "repair" | "reconfigure" | "uninstall", argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);
  if (parsed.showHelp || !parsed.nonInteractive || !parsed.scope || !parsed.ides?.length) {
    throw new Error(`${action} requires --yes --scope global|repository --ide codex|copilot|copilot-cli.`);
  }
  if (parsed.scope === "global" && (parsed.ides.length !== 1 || parsed.ides[0] === "copilot")) {
    throw new Error("Global lifecycle actions support exactly one --ide value: codex or copilot-cli.");
  }
  const repo = parsed.repo || process.cwd();
  if (action === "uninstall") {
    if (parsed.ides.length !== 1) throw new Error("uninstall supports exactly one --ide value.");
    const result = await uninstallManagedRegistration(repo, {
      scope: parsed.scope,
      ide: parsed.ides[0] as "codex" | "copilot" | "copilot-cli",
      dryRun: parsed.dryRun,
    });
    const message = result.changed
      ? `${parsed.dryRun ? "Would remove" : "Removed"} the Astrograph ${result.ide} registration. Index and cache data were left untouched.`
      : `No Astrograph ${result.ide} registration was found; index and cache data were left untouched.`;
    process.stdout.write(parsed.json ? `${JSON.stringify(result, null, 2)}\n` : `${message}\n`);
    return;
  }
  const result = parsed.scope === "global"
    ? parsed.ides[0] === "codex"
      ? await setupGlobalForCodex({ dryRun: parsed.dryRun, reset: parsed.reset })
      : await setupGlobalForCopilotCli({ dryRun: parsed.dryRun, reset: parsed.reset })
    : await setupForAllIdes(repo, {
      ides: parsed.ides,
      dryRun: parsed.dryRun,
      agentsPolicy: parsed.agentsPolicy,
      gitHooks: parsed.gitHooks,
      reset: parsed.reset,
    });
  process.stdout.write(parsed.json
    ? `${JSON.stringify({ action, result }, null, 2)}\n`
    : `${action[0]!.toUpperCase()}${action.slice(1)} complete. ${parsed.scope === "global" ? formatGlobalInstallation(result as GlobalSetupResult, { dryRun: parsed.dryRun }) : formatRepositoryInstallation(result as SetupResult | SetupResult[], { dryRun: parsed.dryRun })}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] === "--report-issue") {
    if (!argv.includes("--diagnostics-consent")) {
      throw new Error("Issue reporting requires explicit --diagnostics-consent. Astrograph never opens a browser or creates an issue automatically.");
    }
    const messageIndex = argv.indexOf("--message");
    const message = messageIndex >= 0 ? argv[messageIndex + 1] : "Unexpected installer failure";
    if (!message) throw new Error("--report-issue requires a value after --message.");
    if (classifyInstallerFailure(message).kind !== "astrograph") {
      throw new Error("This looks like a local setup problem, not an Astrograph installer failure. Follow the suggested recovery step or run `astrograph doctor` instead.");
    }
    process.stdout.write(`${createSanitizedIssueUrl(message)}\n`);
    return;
  }
  if (argv[0] === "--lifecycle") {
    const action = argv[1];
    if (action !== "update" && action !== "repair" && action !== "reconfigure" && action !== "uninstall") {
      throw new Error("Unknown lifecycle action.");
    }
    await runLifecycle(action, argv.slice(2));
    return;
  }
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
  if (argv[0] === "--status") {
    const allowed = new Set(["--status", "--repo", "--json"]);
    if (argv.some((entry) => !allowed.has(entry) && entry !== argv[argv.indexOf("--repo") + 1])) {
      throw new Error("astrograph status accepts only --repo /abs/repo and --json.");
    }
    const repoIndex = argv.indexOf("--repo");
    if (repoIndex >= 0 && !argv[repoIndex + 1]) {
      throw new Error("astrograph status requires a value after --repo.");
    }
    const result = await getSetupReadiness(repoIndex >= 0 ? argv[repoIndex + 1]! : process.cwd(), {
      scanFreshness: false,
    });
    if (argv.includes("--json")) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${formatSetupReadiness(result)}\n`);
    }
    return;
  }
  if (process.env.ASTROGRAPH_ENTRY_MODE === "install" && argv.every((arg) => ["--verbose", "--agents", "--git-hooks"].includes(arg))) {
    await runGuidedInstall({
      verbose: argv.includes("--verbose"),
      agentsPolicy: argv.includes("--agents"),
      gitHooks: argv.includes("--git-hooks"),
    });
    return;
  }
  if (argv.includes("--global")) {
    throw new Error("The pre-1.0 `--global` setup alias has been removed. Use `astrograph install --yes --scope global --ide codex|copilot-cli`.");
  }

  const parsed = parseArgs(argv);

  if (parsed.showHelp) {
    usage();
    return;
  }

  if (parsed.nonInteractive && (!parsed.scope || !parsed.ides?.length)) {
    throw new Error("Non-interactive setup requires --yes --scope global|repository --ide codex|copilot|copilot-cli.");
  }
  if (parsed.reset && !parsed.nonInteractive) {
    throw new Error("--reset requires --yes. Interactive reset is available from the guided installer.");
  }

  if (parsed.nonInteractive && parsed.scope === "global") {
    if (parsed.ides?.length !== 1 || (parsed.ides[0] !== "codex" && parsed.ides[0] !== "copilot-cli")) {
      throw new Error("Global setup supports exactly one --ide value: codex or copilot-cli.");
    }
    const result = parsed.ides[0] === "codex"
      ? await setupGlobalForCodex({ dryRun: parsed.dryRun, reset: parsed.reset })
      : await setupGlobalForCopilotCli({ dryRun: parsed.dryRun, reset: parsed.reset });
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${formatGlobalInstallation(result, { dryRun: parsed.dryRun })}\n`);
    }
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
      reset: normalizedArgs.reset,
    }
    : await promptForSetupArgs({
      agentsPolicy: parsed.agentsPolicy,
      gitHooks: parsed.gitHooks,
    });

  const interactive = !args.json && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const progress = interactive ? spinner() : null;
  const totalPhases = args.dryRun ? 2 : args.reset ? 4 : 3;
  if (progress) {
    process.stdout.write(`\n${formatInstallPhase(1, totalPhases, args.dryRun ? "Validating the setup preview" : "Validating your selected setup")}\n`);
    progress.start(args.dryRun ? "Previewing repository setup…" : "Checking the selected setup…");
    if (!args.dryRun) {
      progress.stop("Setup validated");
      process.stdout.write(`${formatInstallPhase(2, totalPhases, "Updating Astrograph configuration")}\n`);
      progress.start("Writing and verifying the managed registration…");
    }
  }
  verboseLine(parsed.verbose, `${args.dryRun ? "Previewing" : "Writing"} repository setup for ${args.ides.join(", ")}…`);
  const result = await setupForAllIdes(args.repo, {
    ides: args.ides,
    dryRun: args.dryRun,
    agentsPolicy: args.agentsPolicy,
    gitHooks: args.gitHooks,
    reset: args.reset,
    onStateReset: progress
      ? () => {
        progress.stop("Registration updated");
        process.stdout.write(`${formatInstallPhase(3, totalPhases, "Rebuilding Astrograph state")}\n`);
        progress.start("Removing obsolete Astrograph-owned state…");
      }
      : undefined,
  });
  verboseLine(parsed.verbose, `${args.dryRun ? "Preview" : "Setup"} complete for ${args.ides.join(", ")}.`);

  if (progress) {
    progress.stop(args.dryRun ? "Preview ready" : args.reset ? "Astrograph state rebuilt" : "Registration verified");
    process.stdout.write(`${formatInstallPhase(totalPhases, totalPhases, args.dryRun ? "Finishing the preview" : "Finishing setup")}\n`);
    outro(formatRepositoryInstallation(result, { dryRun: args.dryRun }));
  } else if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatRepositoryInstallation(result, { dryRun: args.dryRun })}\n`);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    const failure = classifyInstallerFailure(error);
    usage();
    process.stderr.write(`${failure.kind === "astrograph" ? "Astrograph installer failure" : "Setup could not be completed"}: ${failure.summary}\n`);
    process.stderr.write(`${failure.nextStep}\n`);
    if (failure.kind === "astrograph") {
      process.stderr.write(`Pre-filled GitHub issue: ${createSanitizedIssueUrl(failure.summary)}\n`);
    }
    process.exit(1);
  });
}
