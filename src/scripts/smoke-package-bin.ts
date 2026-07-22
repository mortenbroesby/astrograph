#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { packageManagerInvocation } from "../package-manager.ts";

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
  environment: NodeJS.ProcessEnv = {},
): Promise<{ stdout: string; stderr: string }> {
  const displayCommand = [command, ...args].map((value) => JSON.stringify(value)).join(" ");
  console.error(`package smoke: ${displayCommand}`);
  const invocation = command === "pnpm" || command === "npm"
    ? packageManagerInvocation(command, args)
    : { command, args: [...args] };
  try {
    const result = await execFile(invocation.command, invocation.args, {
      cwd,
      env: {
        ...process.env,
        ...environment,
        CI: "1",
      },
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const output = error as { stdout?: unknown; stderr?: unknown };
    const stdout = Buffer.isBuffer(output.stdout) ? output.stdout.toString() : String(output.stdout ?? "");
    const stderr = Buffer.isBuffer(output.stderr) ? output.stderr.toString() : String(output.stderr ?? "");
    throw new Error(
      `Package smoke command failed (${displayCommand}): ${detail}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
      { cause: error },
    );
  }
}

async function main(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-pack-"));
  const packDir = path.join(tempRoot, "pack");
  const installDir = path.join(tempRoot, "install");
  const fixtureRepo = path.join(tempRoot, "fixture-repo");
  const secondFixtureRepo = path.join(tempRoot, "fixture-repo-two");
  const globalHome = path.join(tempRoot, "global-home");
  const globalCopilotHome = path.join(tempRoot, "global-copilot-home");
  const globalCacheHome = path.join(tempRoot, "global-cache");

  try {
    await mkdir(packDir, { recursive: true });
    await mkdir(installDir, { recursive: true });
    await mkdir(globalHome, { recursive: true });
    await mkdir(globalCopilotHome, { recursive: true });
    await mkdir(path.join(fixtureRepo, "src"), { recursive: true });
    await mkdir(path.join(secondFixtureRepo, "src"), { recursive: true });

    // `init` writes an ESM config that imports `astrograph`. Model the
    // supported repository setup: the configured project owns the package,
    // rather than relying on a sibling CLI-only install.
    await writeFile(
      path.join(fixtureRepo, "package.json"),
      JSON.stringify({ name: "astrograph-smoke-fixture", private: true }, null, 2),
    );

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
    await writeFile(
      path.join(secondFixtureRepo, "src", "catalog.ts"),
      "export const catalogOnly = () => \"two\";\n",
    );

    await run("git", ["init"], fixtureRepo);
    await run("git", ["add", "."], fixtureRepo);
    await run(
      "git",
      ["-c", "user.name=Codex", "-c", "user.email=codex@example.com", "commit", "-m", "init"],
      fixtureRepo,
    );
    await run("git", ["init"], secondFixtureRepo);
    await run("git", ["add", "."], secondFixtureRepo);
    await run(
      "git",
      ["-c", "user.name=Codex", "-c", "user.email=codex@example.com", "commit", "-m", "init"],
      secondFixtureRepo,
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

    const { stdout: searchOutput } = await run(
      "pnpm",
      [
        "exec",
        "astrograph",
        "cli",
        "search-symbols",
        "--repo",
        fixtureRepo,
        "--query",
        "Greeter",
      ],
      installDir,
    );
    const searchResult = JSON.parse(searchOutput) as {
      items?: Array<{ name?: string }>;
    };
    if (!searchResult.items?.some((item) => item.name === "Greeter")) {
      throw new Error(`Expected packaged search result to include Greeter: ${searchOutput}`);
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

    await run("pnpm", ["add", path.join(packDir, tarball)], fixtureRepo);

    const globalInstall = await run(
      "pnpm",
      ["exec", "astrograph", "install", "--global", "--ide", "codex"],
      installDir,
      {
        HOME: globalHome,
        ASTROGRAPH_CACHE_HOME: globalCacheHome,
        // The global installer deliberately verifies that the `astrograph`
        // command written to Codex configuration will resolve in a later
        // session. This fixture installs the packed package locally, so model
        // that global command discovery by exposing its bin directory.
        PATH: [path.join(installDir, "node_modules", ".bin"), process.env.PATH]
          .filter((entry): entry is string => Boolean(entry))
          .join(path.delimiter),
      },
    );
    const globalInstalled = JSON.parse(globalInstall.stdout) as {
      configPreview?: string;
      engineConfigPreview?: string;
    };
    if (!globalInstalled.configPreview?.includes('[mcp_servers.astrograph]')) {
      throw new Error(`Expected packaged global install to register Codex: ${globalInstall.stdout}`);
    }
    if (!globalInstalled.engineConfigPreview?.includes('"storageLocation": "global"')) {
      throw new Error(`Expected packaged global install to opt into global storage: ${globalInstall.stdout}`);
    }

    const globalCopilotInstall = await run(
      "pnpm",
      ["exec", "astrograph", "install", "--global", "--ide", "copilot-cli"],
      installDir,
      {
        HOME: globalHome,
        COPILOT_HOME: globalCopilotHome,
        ASTROGRAPH_CACHE_HOME: globalCacheHome,
        PATH: [path.join(installDir, "node_modules", ".bin"), process.env.PATH]
          .filter((entry): entry is string => Boolean(entry))
          .join(path.delimiter),
      },
    );
    const globalCopilotInstalled = JSON.parse(globalCopilotInstall.stdout) as {
      configPath?: string;
      configPreview?: string;
      engineConfigPreview?: string;
    };
    if (globalCopilotInstalled.configPath !== path.join(globalCopilotHome, "mcp-config.json")) {
      throw new Error(`Expected packaged global install to use COPILOT_HOME: ${globalCopilotInstall.stdout}`);
    }
    if (!globalCopilotInstalled.configPreview?.includes('"astrograph"')) {
      throw new Error(`Expected packaged global install to register Copilot CLI: ${globalCopilotInstall.stdout}`);
    }
    if (!globalCopilotInstalled.engineConfigPreview?.includes('"storageLocation": "global"')) {
      throw new Error(`Expected packaged global Copilot install to opt into global storage: ${globalCopilotInstall.stdout}`);
    }
    const installedCopilotConfig = JSON.parse(
      await readFile(path.join(globalCopilotHome, "mcp-config.json"), "utf8"),
    ) as { mcpServers?: Record<string, { command?: string; args?: string[] }> };
    if (
      installedCopilotConfig.mcpServers?.astrograph?.command !== "astrograph"
      || installedCopilotConfig.mcpServers.astrograph.args?.join(" ") !== "mcp"
    ) {
      throw new Error("Expected packaged global install to persist the Copilot CLI Astrograph server");
    }

    const globalEnvironment = {
      HOME: globalHome,
      COPILOT_HOME: globalCopilotHome,
      ASTROGRAPH_CACHE_HOME: globalCacheHome,
    };
    const { stdout: diagnosticsOutput } = await run(
      "pnpm",
      ["exec", "astrograph", "--diagnostics"],
      installDir,
      globalEnvironment,
    );
    const diagnostics = JSON.parse(diagnosticsOutput) as {
      package?: { name?: string; version?: string };
      runtime?: { supported?: boolean };
      storage?: { location?: string; cacheRoot?: string };
      clients?: Array<{ ide?: string; configured?: boolean }>;
      nextStep?: string;
    };
    if (
      diagnostics.package?.name !== "astrograph"
      || typeof diagnostics.package.version !== "string"
      || diagnostics.runtime?.supported !== true
      || diagnostics.storage?.location !== "global"
      || diagnostics.storage.cacheRoot !== globalCacheHome
      || !diagnostics.clients?.some((client) => client.ide === "codex" && client.configured)
      || !diagnostics.clients?.some((client) => client.ide === "copilot-cli" && client.configured)
      || typeof diagnostics.nextStep !== "string"
    ) {
      throw new Error(`Expected packaged global diagnostics: ${diagnosticsOutput}`);
    }

    await run(
      "pnpm",
      ["exec", "astrograph", "cli", "index-folder", "--repo", fixtureRepo],
      installDir,
      globalEnvironment,
    );
    await run(
      "pnpm",
      ["exec", "astrograph", "cli", "index-folder", "--repo", secondFixtureRepo],
      installDir,
      globalEnvironment,
    );
    const { stdout: firstCacheStatus } = await run(
      "pnpm",
      ["exec", "astrograph", "cache", "status", "--repo", fixtureRepo],
      installDir,
      globalEnvironment,
    );
    const { stdout: secondCacheStatus } = await run(
      "pnpm",
      ["exec", "astrograph", "cache", "status", "--repo", secondFixtureRepo],
      installDir,
      globalEnvironment,
    );
    const firstCache = JSON.parse(firstCacheStatus) as { storageLocation?: string; storageDir?: string };
    const secondCache = JSON.parse(secondCacheStatus) as { storageLocation?: string; storageDir?: string };
    if (
      firstCache.storageLocation !== "global"
      || secondCache.storageLocation !== "global"
      || !firstCache.storageDir
      || firstCache.storageDir === secondCache.storageDir
    ) {
      throw new Error(`Expected isolated global cache directories: ${firstCacheStatus} ${secondCacheStatus}`);
    }
    const { stdout: isolatedSearch } = await run(
      "pnpm",
      ["exec", "astrograph", "cli", "search-symbols", "--repo", fixtureRepo, "--query", "catalogOnly"],
      installDir,
      globalEnvironment,
    );
    if ((JSON.parse(isolatedSearch) as { items?: unknown[] }).items?.length !== 0) {
      throw new Error(`Global cache isolation failed: ${isolatedSearch}`);
    }
    console.error("package smoke: completed successfully");
  } finally {
    // Windows can retain a short-lived handle from the final pnpm child while
    // it exits. Node's bounded retry is preferable to treating a successful
    // package smoke as failed because temporary cleanup raced that handle.
    await rm(tempRoot, {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 150,
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
