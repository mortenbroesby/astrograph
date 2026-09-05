import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { npmPackageVersionExists } from "../lib/npm-registry.ts";
import { runProcess } from "../lib/process.ts";
import { parseAstrographVersion } from "../version.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface ReleaseArtifactPaths {
  artifactDir: string;
  metadataPath: string;
  stagingDir: string;
}

interface ReleaseArtifactOptions {
  commitSha: string;
  outputDir: string;
  runId: string;
}

export function snapshotVersion(baseVersion: string, runId: string, commitSha: string): string {
  parseAstrographVersion(baseVersion);
  if (!/^[1-9]\d*$/u.test(runId)) {
    throw new Error(`Snapshot run id must be a positive integer: ${runId}`);
  }
  if (!/^[0-9a-f]{7,64}$/iu.test(commitSha)) {
    throw new Error(`Snapshot commit must be a 7-64 character hexadecimal SHA: ${commitSha}`);
  }
  return `${baseVersion}.snapshot.${runId}.g${commitSha.toLowerCase().slice(0, 12)}`;
}

export function releaseArtifactPaths(outputDir: string): ReleaseArtifactPaths {
  const root = path.resolve(outputDir);
  return {
    artifactDir: path.join(root, "artifacts"),
    metadataPath: path.join(root, "metadata.json"),
    stagingDir: path.join(root, "staging"),
  };
}

export function assertSnapshotVersionAvailable(exists: boolean, version: string): void {
  if (exists) throw new Error(`Snapshot version already exists on npm: astrograph@${version}`);
}

function parseArgs(argv: readonly string[]): ReleaseArtifactOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) throw new Error(`Unknown release-artifact argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    values.set(key, value);
    index += 1;
  }

  const outputDir = values.get("--output-dir");
  const runId = values.get("--run-id") ?? process.env.GITHUB_RUN_ID;
  const commitSha = values.get("--sha") ?? process.env.GITHUB_SHA;
  if (!outputDir || !runId || !commitSha) {
    throw new Error("Usage: release-artifact --output-dir <path> [--run-id <id>] [--sha <commit>]");
  }
  return { commitSha, outputDir, runId };
}

function writeGithubOutput(values: Record<string, string>): void {
  if (!process.env.GITHUB_OUTPUT) return;
  writeFileSync(
    process.env.GITHUB_OUTPUT,
    `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
    { flag: "a" },
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as {
    name?: unknown;
    version?: unknown;
  };
  if (manifest.name !== "astrograph" || typeof manifest.version !== "string") {
    throw new Error("package.json must identify a versioned astrograph package");
  }

  const version = snapshotVersion(manifest.version, options.runId, options.commitSha);
  assertSnapshotVersionAvailable(await npmPackageVersionExists({
    packageName: manifest.name,
    version,
    timeoutMs: 15_000,
  }), version);

  const paths = releaseArtifactPaths(options.outputDir);
  mkdirSync(path.dirname(paths.stagingDir), { recursive: true });
  mkdirSync(paths.stagingDir, { recursive: false });
  mkdirSync(paths.artifactDir, { recursive: false });
  for (const relativePath of [
    "README.md",
    "LICENSE",
    "assets",
    "src",
    "tsconfig.json",
    "tsconfig.base.json",
    "tsdown.config.ts",
  ]) {
    const destination = path.join(paths.stagingDir, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(path.join(packageRoot, relativePath), destination, { recursive: true });
  }
  writeFileSync(
    path.join(paths.stagingDir, "package.json"),
    `${JSON.stringify({ ...manifest, version }, null, 2)}\n`,
  );
  symlinkSync(
    path.join(packageRoot, "node_modules"),
    path.join(paths.stagingDir, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );

  runProcess("pnpm", ["run", "build"], { cwd: paths.stagingDir, stdio: "inherit" });
  runProcess("npm", ["pack", "--ignore-scripts", "--pack-destination", paths.artifactDir], {
    cwd: paths.stagingDir,
    stdio: "inherit",
  });
  const tarballs = readdirSync(paths.artifactDir).filter((entry) => entry.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one release tarball, received ${tarballs.length}`);
  }

  const tarballPath = path.join(paths.artifactDir, tarballs[0]!);
  const sha256 = createHash("sha256").update(readFileSync(tarballPath)).digest("hex");
  const metadata = {
    commitSha: options.commitSha.toLowerCase(),
    packageName: manifest.name,
    runId: options.runId,
    sha256,
    tarballPath,
    version,
  };
  writeFileSync(paths.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  writeGithubOutput({
    metadata_path: paths.metadataPath,
    package_version: version,
    sha256,
    tarball_path: tarballPath,
  });
  console.log(JSON.stringify(metadata, null, 2));
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
