import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const packageJsonPath = path.join(packageRoot, "package.json");
const versionModuleUrl = pathToFileURL(
  path.join(packageRoot, "src", "version.ts"),
).href;

const {
  assessAstrographVersionBump,
  parseAstrographVersion,
  parseAstrographVersionFromCommitBaseline,
} = await import(versionModuleUrl) as {
  assessAstrographVersionBump: typeof import("../version.ts").assessAstrographVersionBump;
  parseAstrographVersion: typeof import("../version.ts").parseAstrographVersion;
  parseAstrographVersionFromCommitBaseline: typeof import("../version.ts").parseAstrographVersionFromCommitBaseline;
};

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readVersionFromPackageJson(contents: string, sourceLabel: string): string {
  const parsed: { version?: unknown } = JSON.parse(contents);
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`${sourceLabel} is missing a version string.`);
  }

  return parsed.version;
}

function getPackageVersionAtRef(ref: string): string | null {
  try {
    const contents = git(["show", `${ref}:${path.relative(packageRoot, packageJsonPath)}`]);
    return readVersionFromPackageJson(contents, `${ref} package.json`);
  } catch {
    return null;
  }
}

function getWorkingPackageVersion(): string {
  return readVersionFromPackageJson(readFileSync(packageJsonPath, "utf8"), "package.json");
}

function getStagedPackageVersion(): string {
  const repoRelativePath = path.relative(
    packageRoot,
    packageJsonPath,
  );
  const contents = git(["show", `:${repoRelativePath}`]);
  return readVersionFromPackageJson(
    contents,
    "Staged package.json",
  );
}

function getStagedPaths(): string[] {
  const output = git(["diff", "--cached", "--name-only"]);
  if (output.length === 0) {
    return [];
  }

  return output.split("\n").filter(Boolean);
}

function parseOptions(): { summary: boolean; base: string | null } {
  const args = process.argv.slice(2);
  if (args.length === 0) return { summary: false, base: null };
  if (args.length === 1 && args[0] === "--summary") return { summary: true, base: null };
  if (args.length === 2 && args[0] === "--base" && args[1]) {
    return { summary: false, base: args[1] };
  }
  throw new Error(`Usage: check-version-bump.ts [--summary|--base <git-ref>]`);
}

function main(): void {
  const { summary, base } = parseOptions();
  const changedPaths = base
    ? git(["diff", "--name-only", `${base}...HEAD`]).split("\n").filter(Boolean)
    : getStagedPaths();
  const versionedPaths = changedPaths.filter((filePath) => !/\.(?:md|mdx)$/i.test(filePath));
  if (versionedPaths.length === 0) {
    if (summary) console.log("Version bump check: not applicable (documentation-only changes).");
    return;
  }

  const nextVersion = base ? getWorkingPackageVersion() : getStagedPackageVersion();
  const nextParts = parseAstrographVersion(nextVersion);

  const previousVersion = getPackageVersionAtRef(base ?? "HEAD");
  if (previousVersion === null) {
    if (summary) console.log("Version bump check: not applicable (no baseline package version).");
    return;
  }

  const previousParts = parseAstrographVersionFromCommitBaseline(previousVersion);
  const assessment = assessAstrographVersionBump(previousParts, nextParts);
  if (assessment.ok) {
    if (summary) console.log(`Version bump check: passed (${previousVersion} -> ${nextVersion}).`);
    return;
  }

  const detail = [
    "Versioned repository changes are present, but the version policy is not satisfied.",
    `Previous version: ${previousVersion}`,
    `Next version: ${nextVersion}`,
    assessment.reason,
    "Policy: use major.minor.patch-alpha.increment in package.json.",
    "Bump increment on every Astrograph commit.",
    "Never reset the alpha increment, including across patch, minor, or major bumps.",
    "Use patch for backward-compatible fixes/internal work, minor for backward-compatible features, and major for breaking changes.",
  ].join("\n");

  throw new Error(summary ? `Version bump check: failed — ${assessment.reason}` : detail);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
