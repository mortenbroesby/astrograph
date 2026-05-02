#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

async function run(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFile(command, [...args], {
    cwd,
    env: {
      ...process.env,
      CI: "1",
    },
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

async function main(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-pack-"));
  const packDir = path.join(tempRoot, "pack");
  const installDir = path.join(tempRoot, "install");
  const fixtureRepo = path.join(tempRoot, "fixture-repo");

  try {
    await mkdir(packDir, { recursive: true });
    await mkdir(installDir, { recursive: true });
    await mkdir(path.join(fixtureRepo, "src"), { recursive: true });

    await writeFile(
      path.join(installDir, "package.json"),
      JSON.stringify({
        name: "astrograph-package-smoke",
        private: true,
      }, null, 2),
    );

    await writeFile(
      path.join(fixtureRepo, "src", "greeter.ts"),
      [
        "export class Greeter {",
        "  greet(name: string) {",
        '    return `Hello ${name}`;',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    await run("git", ["init"], fixtureRepo);
    await run("git", ["add", "."], fixtureRepo);
    await run(
      "git",
      ["-c", "user.name=Codex", "-c", "user.email=codex@example.com", "commit", "-m", "init"],
      fixtureRepo,
    );

    await run("pnpm", ["pack", "--pack-destination", packDir], packageRoot);
    const tarballs = (await readdir(packDir)).filter((entry) => entry.endsWith(".tgz"));
    const tarball = tarballs[0];

    if (!tarball) {
      throw new Error("Expected pnpm pack to produce a tarball");
    }

    await run("pnpm", ["add", path.join(packDir, tarball)], installDir);
    const { stdout } = await run(
      "pnpm",
      [
        "exec",
        "astrograph",
        "cli",
        "index-folder",
        "--repo",
        fixtureRepo,
      ],
      installDir,
    );

    const summary = JSON.parse(stdout);
    if (summary.indexedFiles !== 1 || summary.indexedSymbols < 2) {
      throw new Error(`Unexpected packaged bin result: ${stdout}`);
    }

    const installResult = await run(
      "pnpm",
      [
        "exec",
        "astrograph",
        "init",
        "--yes",
        "--agents",
        "--repo",
        fixtureRepo,
      ],
      installDir,
    );

    const installed = JSON.parse(installResult.stdout);
    if (!String(installed.configPreview).includes("[mcp_servers.astrograph]")) {
      throw new Error(`Expected astrograph init to write a Codex MCP block: ${installResult.stdout}`);
    }
    if (!String(installed.engineConfigPath).endsWith("astrograph.config.ts")) {
      throw new Error(`Expected astrograph init to report astrograph.config.ts: ${installResult.stdout}`);
    }
    if (installed.mode !== undefined || installed.ide !== "codex") {
      throw new Error(`Expected astrograph init defaults to use codex without a profile mode: ${installResult.stdout}`);
    }
    if (!String(installed.agentsPolicyPath).endsWith("AGENTS.md")) {
      throw new Error(`Expected astrograph init to report AGENTS.md policy path: ${installResult.stdout}`);
    }
    if (!String(installed.agentsPolicyPreview).includes("## Code Exploration with Astrograph")) {
      throw new Error(`Expected astrograph init --agents to write code exploration policy: ${installResult.stdout}`);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
