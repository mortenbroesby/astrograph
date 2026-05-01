#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const wrapperPath = path.join(packageRoot, "scripts", "ai-context-engine.mjs");

function parseArgs(argv) {
  const args = {
    repo: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for argument --${key}`);
    }

    if (key === "repo") {
      args.repo = value;
    }

    index += 1;
  }

  return args;
}

async function resolveRepoRoot(repoRoot) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const resolvedRepoRoot = await realpath(absoluteRepoRoot).catch(() => absoluteRepoRoot);

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      { cwd: resolvedRepoRoot },
    );
    const worktreeRoot = stdout.trim();
    return await realpath(worktreeRoot).catch(() => worktreeRoot || resolvedRepoRoot);
  } catch {
    return resolvedRepoRoot;
  }
}

async function readStatus(statusPath) {
  try {
    const parsed = JSON.parse(await readFile(statusPath, "utf8"));
    if (
      parsed
      && typeof parsed.host === "string"
      && Number.isInteger(parsed.port)
    ) {
      return parsed;
    }
  } catch {
    // Status is best-effort; startup waiting handles absence and invalid JSON.
  }

  return null;
}

async function isHealthy(status) {
  if (!status) {
    return false;
  }

  try {
    const response = await fetch(`http://${status.host}:${status.port}/health`, {
      headers: {
        Accept: "application/json",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForStatus(statusPath, child, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await readStatus(statusPath);
    if (await isHealthy(status)) {
      return status;
    }

    if (child.exitCode !== null) {
      throw new Error(`Astrograph observability server exited with code ${child.exitCode}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Astrograph observability server did not report healthy startup");
}

async function openBrowser(url) {
  const candidates = process.platform === "darwin"
    ? [["open", [url]]]
    : process.platform === "win32"
      ? [["cmd", ["/c", "start", "", url]]]
      : [["xdg-open", [url]]];

  const errors = [];
  for (const [command, args] of candidates) {
    try {
      await execFileAsync(command, args);
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`Could not open browser for ${url}: ${errors.join("; ")}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = await resolveRepoRoot(args.repo);
  const storageDir = path.join(repoRoot, ".astrograph");
  const statusPath = path.join(storageDir, "observability-server.json");
  await mkdir(storageDir, { recursive: true });

  const existingStatus = await readStatus(statusPath);
  let status = existingStatus;
  if (!(await isHealthy(status))) {
    const child = spawn(
      process.execPath,
      [wrapperPath, "observability", "--repo", repoRoot],
      {
        cwd: repoRoot,
        detached: true,
        stdio: "ignore",
      },
    );
    child.unref();
    status = await waitForStatus(statusPath, child);
  }

  const url = `http://${status.host}:${status.port}/`;
  await openBrowser(url);
  process.stdout.write(`${url}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
