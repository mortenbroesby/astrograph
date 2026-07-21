#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

function usage() {
  process.stderr.write(
  [
    "Usage:",
    "  astrograph cli <args...>",
    "  astrograph cli index-folder --repo /abs/repo [--storage-location repo-local|global]",
    "  astrograph cache status --repo /abs/repo",
    "  astrograph cache remove --repo /abs/repo [--yes]",
    "  astrograph cache prune --all --max-bytes <bytes> [--yes]",
    "  astrograph cli cache-status --repo /abs/repo",
    "  astrograph cli cache-remove --repo /abs/repo [--yes]",
    "  astrograph mcp",
    "  astrograph git-refresh [manual|commit|checkout|merge|push] [args...]",
    "  astrograph init [--ide codex|copilot|copilot-cli|all|codex,copilot,...] [--repo /abs/repo] [--yes] [--dry-run]",
    "  astrograph install --global [--ide codex|copilot-cli] [--dry-run]",
    "  astrograph init --ide codex",
  ].join("\n") + "\n",
);
}

const [mode, ...args] = process.argv.slice(2);

const sourceTarget =
  mode === "cli" || mode === "cache"
    ? path.join(packageRoot, "src", "cli.ts")
    : mode === "mcp"
      ? path.join(packageRoot, "src", "mcp.ts")
      : mode === "git-refresh"
        ? path.join(packageRoot, "src", "scripts", "git-smart-refresh.ts")
        : mode === "init" || mode === "install"
          ? path.join(packageRoot, "src", "scripts", "install.ts")
          : null;
const distTarget =
  mode === "cli" || mode === "cache"
    ? path.join(packageRoot, "dist", "cli.js")
    : mode === "mcp"
      ? path.join(packageRoot, "dist", "mcp.js")
      : mode === "git-refresh"
        ? path.join(packageRoot, "dist", "scripts", "git-smart-refresh.js")
        : mode === "init" || mode === "install"
          ? path.join(packageRoot, "dist", "scripts", "install.js")
          : null;

if (!sourceTarget || !distTarget) {
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
  : args;
if (mode === "cache" && !["status", "remove", "prune"].includes(args[0] ?? "")) {
  usage();
  process.exit(1);
}
const child = spawn(
  process.execPath,
  useBuiltTarget
    ? [...nodeArgs, distTarget, ...commandArgs]
    : [...nodeArgs, "--experimental-strip-types", sourceTarget, ...commandArgs],
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
