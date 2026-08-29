#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const packageVersion = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"))
  .version as string;

function usage() {
  process.stderr.write(
  [
    `Astrograph v${packageVersion}`,
    "",
    "Usage:",
    "  astrograph cli <args...>",
    "  astrograph cli index-folder --repo /abs/repo [--storage-location repo-local|global]",
    "  astrograph cache status --repo /abs/repo",
    "  astrograph cache remove --repo /abs/repo [--yes]",
    "  astrograph cache prune --all --max-bytes <bytes> [--yes]",
    "  astrograph cache restore --repo /abs/repo --receipt /path/to/receipt.json [--yes]",
    "  astrograph cli cache-status --repo /abs/repo",
    "  astrograph cli cache-remove --repo /abs/repo [--yes]",
    "  astrograph mcp",
    "  astrograph --version",
    "  astrograph --diagnostics",
    "  astrograph report [--repo /abs/repo]",
    "  astrograph report-issue --diagnostics-consent --message <sanitized-summary>",
    "  astrograph git-refresh [manual|commit|checkout|merge|push] [args...]",
    "  astrograph install [--ide codex|copilot|copilot-cli|all|codex,copilot,...] [--repo /abs/repo] [--yes] [--scope global|repository] [--reset] [--agents] [--git-hooks] [--dry-run] [--json]",
    "  astrograph status [--repo /abs/repo] [--json]",
    "  astrograph doctor [--repo /abs/repo] [--json]",
    "  astrograph update|repair|reconfigure --yes --scope global|repository --ide codex|copilot|copilot-cli [--repo /abs/repo] [--dry-run] [--json]",
    "  astrograph uninstall --yes --scope global|repository --ide codex|copilot|copilot-cli [--repo /abs/repo] [--dry-run] [--json]",
    "  astrograph install --ide codex",
  ].join("\n") + "\n",
);
}

const [providedMode, ...args] = process.argv.slice(2);
const mode = providedMode;

if (mode === "--version" || mode === "-v") {
  process.stdout.write(`${packageVersion}\n`);
  process.exit(0);
}

const sourceTarget =
  mode === "cli" || mode === "cache" || mode === "report"
    ? path.join(packageRoot, "src", "cli.ts")
    : mode === "mcp"
      ? path.join(packageRoot, "src", "mcp.ts")
      : mode === "git-refresh"
        ? path.join(packageRoot, "src", "scripts", "git-smart-refresh.ts")
        : mode === "install" || mode === "doctor" || mode === "status" || mode === "update" || mode === "repair" || mode === "reconfigure" || mode === "uninstall" || mode === "report-issue" || mode === "--diagnostics"
          ? path.join(packageRoot, "src", "scripts", "install.ts")
          : null;
const distTarget =
  mode === "cli" || mode === "cache" || mode === "report"
    ? path.join(packageRoot, "dist", "cli.js")
    : mode === "mcp"
      ? path.join(packageRoot, "dist", "mcp.js")
      : mode === "git-refresh"
        ? path.join(packageRoot, "dist", "scripts", "git-smart-refresh.js")
        : mode === "install" || mode === "doctor" || mode === "status" || mode === "update" || mode === "repair" || mode === "reconfigure" || mode === "uninstall" || mode === "report-issue" || mode === "--diagnostics"
          ? path.join(packageRoot, "dist", "scripts", "install.js")
          : null;

if (!mode || !sourceTarget || !distTarget) {
  usage();
  process.exit(1);
}

const preferSource =
  process.env.ASTROGRAPH_USE_SOURCE === "1"
  || process.env.ASTROGRAPH_USE_SOURCE === "true";
const useBuiltTarget = existsSync(distTarget) && (!preferSource || !existsSync(sourceTarget));
const nodeArgs = mode === "mcp" ? ["--no-warnings"] : [];
const commandArgs = mode === "cache"
  ? [`cache-${args[0] ?? ""}`, ...args.slice(1)]
  : mode === "report"
    ? ["report", ...args]
  : mode === "--diagnostics"
    ? ["--diagnostics"]
  : mode === "doctor"
    ? ["--doctor", ...args]
    : mode === "status"
      ? ["--status", ...args]
      : mode === "update" || mode === "repair" || mode === "reconfigure" || mode === "uninstall"
        ? ["--lifecycle", mode, ...args]
      : mode === "report-issue"
        ? ["--report-issue", ...args]
    : args;
if (mode === "cache" && !["status", "remove", "prune", "restore"].includes(args[0] ?? "")) {
  usage();
  process.exit(1);
}
const child = spawn(
  process.execPath,
  useBuiltTarget
    ? [...nodeArgs, distTarget, ...commandArgs]
    : [...nodeArgs, "--import=tsx", sourceTarget, ...commandArgs],
  {
    stdio: "inherit",
    env: { ...process.env, ASTROGRAPH_ENTRY_MODE: mode },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
