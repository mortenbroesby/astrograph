#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { access, mkdtemp, readdir, rm, writeFile, mkdir, readFile } from "node:fs/promises";
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

const wasmGrammarNames = [
  "typescript", "tsx", "javascript", "python", "bash", "powershell", "c_sharp", "java", "go", "rust",
  "json", "html", "css", "c", "cpp", "php", "ruby", "embedded_template", "scala",
] as const;

export interface SmokePackageOptions {
  expectedVersion: string | null;
  prebuiltPackage: boolean;
  tarballPath: string | null;
  wasmOnly: boolean;
}

export function parseSmokePackageArgs(
  argv: readonly string[],
  cwd = process.cwd(),
): SmokePackageOptions {
  let tarballPath: string | null = null;
  let expectedVersion: string | null = null;
  let prebuiltPackage = false;
  let wasmOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--prebuilt") {
      prebuiltPackage = true;
    } else if (arg === "--wasm-only") {
      wasmOnly = true;
    } else if (arg === "--expected-version") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--expected-version requires a value");
      }
      expectedVersion = value;
      index += 1;
    } else if (arg.startsWith("--expected-version=")) {
      expectedVersion = arg.slice("--expected-version=".length);
      if (!expectedVersion) throw new Error("--expected-version requires a value");
    } else if (arg === "--tarball") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--tarball requires a .tgz path");
      }
      tarballPath = path.resolve(cwd, value);
      index += 1;
    } else if (arg.startsWith("--tarball=")) {
      const value = arg.slice("--tarball=".length);
      if (!value) {
        throw new Error("--tarball requires a .tgz path");
      }
      tarballPath = path.resolve(cwd, value);
    } else {
      throw new Error(`Unknown package smoke argument: ${arg}`);
    }
  }

  if (tarballPath && path.extname(tarballPath) !== ".tgz") {
    throw new Error("--tarball requires a .tgz path");
  }

  return { expectedVersion, prebuiltPackage, tarballPath, wasmOnly };
}

export function assertPackageIdentity(
  actual: { name?: unknown; version?: unknown },
  expected: { name?: unknown; version?: unknown },
): void {
  if (
    typeof expected.name !== "string"
    || typeof expected.version !== "string"
    || actual.name !== expected.name
    || actual.version !== expected.version
  ) {
    throw new Error(
      `Package tarball identity mismatch: expected ${String(expected.name)}@${String(expected.version)}, received ${String(actual.name)}@${String(actual.version)}`,
    );
  }
}

async function run(
  command: string,
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv = {},
  timeout = 60_000,
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
      timeout,
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
  const { expectedVersion, prebuiltPackage, tarballPath: suppliedTarballPath, wasmOnly } =
    parseSmokePackageArgs(process.argv.slice(2));
  const packageManifest = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  ) as { name?: string; packageManager?: string; version?: string };
  if (suppliedTarballPath) {
    await access(suppliedTarballPath).catch(() => {
      throw new Error(`Package tarball does not exist: ${suppliedTarballPath}`);
    });
  }
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-pack-"));
  const packDir = path.join(tempRoot, "pack");
  const installDir = path.join(tempRoot, "install");
  const fixtureRepo = path.join(tempRoot, "fixture-repo");
  const secondFixtureRepo = path.join(tempRoot, "fixture-repo-two");
  const globalHome = path.join(tempRoot, "global-home");
  const globalCopilotHome = path.join(tempRoot, "global-copilot-home");
  const globalCacheHome = path.join(tempRoot, "global-cache");
  const npmGlobalPrefix = path.join(tempRoot, "npm-global");
  const npmCache = path.join(tempRoot, "npm-cache");

  try {
    await mkdir(packDir, { recursive: true });
    await mkdir(installDir, { recursive: true });
    await mkdir(globalHome, { recursive: true });
    await mkdir(globalCopilotHome, { recursive: true });
    await mkdir(npmGlobalPrefix, { recursive: true });
    await mkdir(npmCache, { recursive: true });
    await mkdir(path.join(fixtureRepo, "src"), { recursive: true });
    await mkdir(path.join(secondFixtureRepo, "src"), { recursive: true });

    // `install` writes an ESM config that imports `astrograph`. Model the
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
        packageManager: packageManifest.packageManager,
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

    let tarballPath = suppliedTarballPath;
    if (!tarballPath) {
      await run(
        "pnpm",
        ["pack", "--pack-destination", packDir],
        packageRoot,
        prebuiltPackage ? { npm_config_ignore_scripts: "true" } : {},
      );
      const tarballs = (await readdir(packDir)).filter((entry) => entry.endsWith(".tgz"));
      if (tarballs.length !== 1) {
        throw new Error(`Expected pnpm pack to produce exactly one tarball, received ${tarballs.length}`);
      }
      tarballPath = path.join(packDir, tarballs[0]!);
    }

    const npmGlobalInstall = await run(
      "npm",
      ["install", "--global", "--prefix", npmGlobalPrefix, "--cache", npmCache, tarballPath],
      installDir,
      {},
      300_000,
    );
    // Resolver and engine warnings mean users may not get a usable install.
    // Third-party deprecation notices are maintained upstream and do not change
    // the packed package's installability; they should be removed by dependency
    // upgrades rather than making this consumer smoke permanently flaky.
    if (/npm warn (ERESOLVE|EBADENGINE)\b/iu.test(npmGlobalInstall.stderr)) {
      throw new Error(`Unexpected npm global-install integrity warning: ${npmGlobalInstall.stderr}`);
    }
    const { stdout: globalNodeModules } = await run(
      "npm",
      ["root", "--global", "--prefix", npmGlobalPrefix],
      installDir,
    );
    const installedManifest = JSON.parse(
      await readFile(path.join(globalNodeModules.trim(), "astrograph", "package.json"), "utf8"),
    ) as { name?: unknown; version?: unknown };
    const expectedPackageVersion = expectedVersion ?? packageManifest.version;
    assertPackageIdentity(installedManifest, {
      name: packageManifest.name,
      version: expectedPackageVersion,
    });
    const globalBin = process.platform === "win32"
      ? path.join(npmGlobalPrefix, "node_modules", ".bin", "astrograph.cmd")
      : path.join(npmGlobalPrefix, "bin", "astrograph");
    const { stdout: globalVersion } = await run(globalBin, ["--version"], installDir);
    if (!expectedPackageVersion || globalVersion.trim() !== expectedPackageVersion) {
      throw new Error(`Unexpected globally installed package version: ${globalVersion}`);
    }
    await run(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        [
          'import { access } from "node:fs/promises";',
          'import { createRequire } from "node:module";',
          'import { getWasmPath } from "tree-sitter-wasm";',
          "const require = createRequire(import.meta.url);",
          `await Promise.all([require.resolve("web-tree-sitter/tree-sitter.wasm"), ...${JSON.stringify(wasmGrammarNames)}.map(getWasmPath)].map((asset) => access(asset)));`,
          'for (const packageName of ["tree-sitter", "@astrograph/tree-sitter"]) {',
          '  try { require.resolve(packageName); throw new Error(`Unexpected native Tree-sitter package: ${packageName}`); }',
          '  catch (error) { if (!(error instanceof Error) || error.code !== "MODULE_NOT_FOUND") throw error; }',
          "}",
        ].join("\n"),
      ],
      path.join(globalNodeModules.trim(), "astrograph"),
    );
    if (wasmOnly) {
      console.error("package smoke: WASM asset coverage completed successfully");
      return;
    }
    await run("pnpm", ["add", tarballPath], installDir, {}, 180_000);
    await run("pnpm", ["add", "-D", "@types/node"], installDir, {}, 180_000);
    await writeFile(
      path.join(installDir, "package-types.ts"),
      [
        'import { defineConfig, resolveEnginePaths, type EngineConfig } from "astrograph";',
        "",
        "declare const config: EngineConfig;",
        "resolveEnginePaths(config.repoRoot);",
        'defineConfig({ storageLocation: "global" });',
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(installDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
          strict: true,
          noEmit: true,
        },
        include: ["package-types.ts"],
      }, null, 2),
    );
    await run(
      process.execPath,
      [path.join(packageRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
      installDir,
      {},
      180_000,
    );
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
    if (summary.indexedFiles !== 2 || summary.indexedSymbols < 4) {
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
        "install",
        "--yes",
        "--scope",
        "repository",
        "--ide",
        "codex,copilot-cli",
        "--agents",
        "--git-hooks",
        "--verbose",
        "--json",
        "--repo",
        fixtureRepo,
      ],
      installDir,
    );

    const installed = JSON.parse(installResult.stdout) as Array<{
      ide?: string;
      configPreview?: string;
      engineConfigPath?: string;
      agentsPolicyPath?: string;
      agentsPolicyPreview?: string;
      gitHooks?: Array<{ reason?: string }>;
    }>;
    if (!installResult.stderr.includes("Astrograph: Writing repository setup for codex, copilot-cli…")) {
      throw new Error(`Expected astrograph install --verbose to report its active setup phase: ${installResult.stderr}`);
    }
    if (!Array.isArray(installed) || !installed.some((result) => result.ide === "codex" && result.configPreview?.includes("[mcp_servers.astrograph]"))) {
      throw new Error(`Expected astrograph install to write a Codex MCP block: ${installResult.stdout}`);
    }
    if (!installed.every((result) => result.engineConfigPath?.endsWith("astrograph.config.ts"))) {
      throw new Error(`Expected astrograph install to report astrograph.config.ts: ${installResult.stdout}`);
    }
    if (!installed.some((result) => result.ide === "copilot-cli")) {
      throw new Error(`Expected astrograph install to support Codex and Copilot CLI together: ${installResult.stdout}`);
    }
    if (!installed.every((result) => result.agentsPolicyPath?.endsWith("AGENTS.md"))) {
      throw new Error(`Expected astrograph install to report AGENTS.md policy path: ${installResult.stdout}`);
    }
    if (!installed.every((result) => result.agentsPolicyPreview?.includes("## Code Exploration with Astrograph"))) {
      throw new Error(`Expected astrograph install --agents to write code exploration policy: ${installResult.stdout}`);
    }
    if (!installed.every((result) => result.gitHooks?.length === 3)) {
      throw new Error(`Expected astrograph install --git-hooks to install all refresh hooks: ${installResult.stdout}`);
    }

    const repeatedInstall = await run(
      "pnpm",
      ["exec", "astrograph", "install", "--yes", "--scope", "repository", "--ide", "codex,copilot-cli", "--agents", "--git-hooks", "--json", "--repo", fixtureRepo],
      installDir,
    );
    const repeated = JSON.parse(repeatedInstall.stdout) as Array<{ gitHooks?: Array<{ reason?: string }> }>;
    if (!repeated.every((result) => result.gitHooks?.every((hook) => hook.reason === "already installed"))) {
      throw new Error(`Expected a repeated packaged install to preserve existing hooks: ${repeatedInstall.stdout}`);
    }

    const rerun = await run(
      "pnpm",
      ["exec", "astrograph", "repair", "--yes", "--scope", "repository", "--ide", "codex", "--repo", fixtureRepo, "--json"],
      installDir,
    );
    if (JSON.parse(rerun.stdout).action !== "repair") {
      throw new Error(`Expected packaged repair to be explicit and idempotent: ${rerun.stdout}`);
    }

    const { stdout: doctorOutput } = await run(
      "pnpm",
      ["exec", "astrograph", "doctor", "--repo", fixtureRepo, "--json"],
      installDir,
    );
    const doctor = JSON.parse(doctorOutput) as {
      local?: { clients?: Array<{ ide?: string; configured?: boolean }> };
    };
    if (!doctor.local?.clients?.some((client) => client.ide === "codex" && client.configured)
      || !doctor.local?.clients?.some((client) => client.ide === "copilot-cli" && client.configured)) {
      throw new Error(`Expected astrograph doctor to verify the selected setup: ${doctorOutput}`);
    }

    await run("pnpm", ["add", tarballPath], fixtureRepo, {}, 180_000);
    const { stdout: typedConfigOutput } = await run(
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
    const typedConfigSummary = JSON.parse(typedConfigOutput);
    if (typedConfigSummary.staleStatus !== "fresh") {
      throw new Error(`Unexpected typed-config package result: ${typedConfigOutput}`);
    }

    const globalInstall = await run(
      "pnpm",
      ["exec", "astrograph", "install", "--yes", "--scope", "global", "--ide", "codex", "--json"],
      installDir,
      {
        HOME: globalHome,
        ASTROGRAPH_CACHE_HOME: globalCacheHome,
        PATH: [path.join(installDir, "node_modules", ".bin"), process.env.PATH]
          .filter((entry): entry is string => Boolean(entry))
          .join(path.delimiter),
      },
      240_000,
    );
    const globalInstalled = JSON.parse(globalInstall.stdout) as {
      configPreview?: string;
      engineConfigPreview?: string;
      runtime?: { packageVersion?: string; packageSpecifier?: string; nodePath?: string; entrypoint?: string };
    };
    if (!globalInstalled.configPreview?.includes('[mcp_servers.astrograph]')) {
      throw new Error(`Expected packaged global install to register Codex: ${globalInstall.stdout}`);
    }
    if (!globalInstalled.engineConfigPreview?.includes('"storageLocation": "global"')) {
      throw new Error(`Expected packaged global install to opt into global storage: ${globalInstall.stdout}`);
    }
    if (
      globalInstalled.runtime?.packageSpecifier !== "astrograph@latest"
      || !globalInstalled.runtime.packageVersion
      || !globalInstalled.runtime.nodePath
      || !path.isAbsolute(globalInstalled.runtime.nodePath)
      || !globalInstalled.runtime.entrypoint
      || !path.isAbsolute(globalInstalled.runtime.entrypoint)
      || !globalInstalled.configPreview.includes(globalInstalled.runtime.nodePath)
      || !globalInstalled.configPreview.includes(globalInstalled.runtime.entrypoint)
    ) {
      throw new Error(`Expected packaged global install to select one absolute registry runtime: ${globalInstall.stdout}`);
    }

    const globalCopilotInstall = await run(
      "pnpm",
      ["exec", "astrograph", "install", "--yes", "--scope", "global", "--ide", "copilot-cli", "--json"],
      installDir,
      {
        HOME: globalHome,
        COPILOT_HOME: globalCopilotHome,
        ASTROGRAPH_CACHE_HOME: globalCacheHome,
        PATH: [path.join(installDir, "node_modules", ".bin"), process.env.PATH]
          .filter((entry): entry is string => Boolean(entry))
          .join(path.delimiter),
      },
      240_000,
    );
    const globalCopilotInstalled = JSON.parse(globalCopilotInstall.stdout) as {
      configPath?: string;
      configPreview?: string;
      engineConfigPreview?: string;
      runtime?: { packageVersion?: string; nodePath?: string; entrypoint?: string };
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
    const installedCopilotServer = installedCopilotConfig.mcpServers?.astrograph;
    if (
      globalCopilotInstalled.runtime?.packageVersion !== globalInstalled.runtime.packageVersion
      || installedCopilotServer?.command !== globalCopilotInstalled.runtime.nodePath
      || installedCopilotServer?.args?.join("\0")
        !== ["--no-warnings", globalCopilotInstalled.runtime.entrypoint, "mcp"].join("\0")
    ) {
      throw new Error("Expected packaged global install to persist the same absolute runtime for Copilot CLI");
    }
    await access(path.join(secondFixtureRepo, ".codex", "config.toml"))
      .then(() => { throw new Error("Global setup must not write repository configuration without an index opt-in"); })
      .catch((error) => {
        if (error instanceof Error && error.message.includes("Global setup must")) throw error;
      });

    const { stdout: issueUrl } = await run(
      "pnpm",
      ["exec", "astrograph", "report-issue", "--diagnostics-consent", "--message", "token=ghp_ABCdef123 /Users/example/project"],
      installDir,
    );
    if (!issueUrl.includes("issues/new") || !issueUrl.includes("%5Bredacted%5D") || issueUrl.includes("ghp_ABCdef123")) {
      throw new Error(`Expected packaged issue URL to redact local diagnostics: ${issueUrl}`);
    }

    const globalEnvironment = {
      HOME: globalHome,
      COPILOT_HOME: globalCopilotHome,
      ASTROGRAPH_CACHE_HOME: globalCacheHome,
    };
    const expectedGlobalCacheRoot = process.platform === "darwin"
      ? path.join(globalHome, ".astrograph", "cache")
      : path.join(globalCacheHome, "astrograph");
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
      || diagnostics.storage.cacheRoot !== expectedGlobalCacheRoot
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
      firstCache.storageLocation !== "repo-local"
      || secondCache.storageLocation !== "global"
      || !firstCache.storageDir
      || firstCache.storageDir === secondCache.storageDir
    ) {
      throw new Error(`Expected repository storage to override the global default and keep stores isolated: ${firstCacheStatus} ${secondCacheStatus}`);
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

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
