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
      "  astrograph mcp",
      "  astrograph observability <args...>",
      "  astrograph install --ide codex",
    ].join("\n") + "\n",
  );
}

const [mode, ...args] = process.argv.slice(2);

const sourceTarget =
  mode === "cli"
    ? path.join(packageRoot, "src", "cli.ts")
    : mode === "mcp"
      ? path.join(packageRoot, "src", "mcp.ts")
      : mode === "observability"
        ? path.join(packageRoot, "scripts", "observability-server.mjs")
      : mode === "install"
        ? path.join(packageRoot, "scripts", "install.mjs")
      : null;
const distTarget =
  mode === "cli"
    ? path.join(packageRoot, "dist", "cli.js")
    : mode === "mcp"
      ? path.join(packageRoot, "dist", "mcp.js")
      : mode === "observability"
        ? path.join(packageRoot, "scripts", "observability-server.mjs")
      : mode === "install"
        ? path.join(packageRoot, "scripts", "install.mjs")
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
const executable = mode === "observability" ? "bun" : process.execPath;
const child = spawn(
  executable,
  mode === "observability"
    ? [sourceTarget, ...args]
    : useBuiltTarget
      ? [...nodeArgs, distTarget, ...args]
      : [...nodeArgs, "--experimental-strip-types", sourceTarget, ...args],
  {
    stdio: "inherit",
    env: mode === "observability"
      ? {
          ...process.env,
          AI_CONTEXT_ENGINE_NODE_BIN: process.execPath,
        }
      : process.env,
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
  if (mode === "observability" && error && "code" in error && error.code === "ENOENT") {
    process.stderr.write("bun is required for astrograph observability mode.\n");
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exit(1);
});
