import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
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
} = await import(versionModuleUrl);

function git(args) {
  return execFileSync("git", args, {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readVersionFromPackageJson(contents, sourceLabel) {
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${sourceLabel} is not valid JSON.`);
  }

  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`${sourceLabel} is missing a version string.`);
  }

  return parsed.version;
}

function getHeadPackageVersion() {
  try {
    const contents = git(["show", `HEAD:${path.relative(packageRoot, packageJsonPath)}`]);
    return readVersionFromPackageJson(contents, "HEAD package.json");
  } catch {
    return null;
  }
}

function getStagedPackageVersion() {
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

function getStagedPaths() {
  const output = git(["diff", "--cached", "--name-only"]);
  if (output.length === 0) {
    return [];
  }

  return output.split("\n").filter(Boolean);
}

function main() {
  const stagedPaths = getStagedPaths();
  const astrographPaths = stagedPaths.filter((filePath) =>
    /^(package\.json|src\/|scripts\/|tests\/|bench\/|tsconfig|vitest\.config\.ts|stryker)/.test(filePath),
  );
  if (astrographPaths.length === 0) {
    return;
  }

  const nextVersion = getStagedPackageVersion();
  const nextParts = parseAstrographVersion(nextVersion);

  const previousVersion = getHeadPackageVersion();
  if (previousVersion === null) {
    return;
  }

  const previousParts = parseAstrographVersionFromCommitBaseline(previousVersion);
  const assessment = assessAstrographVersionBump(previousParts, nextParts);
  if (assessment.ok) {
    return;
  }

  const detail = [
    "Astrograph changes are staged, but its version policy is not satisfied.",
    `Previous version: ${previousVersion}`,
    `Next version: ${nextVersion}`,
    assessment.reason,
    "Policy: use major.minor.patch-alpha.increment in package.json.",
    "Bump increment on every Astrograph commit.",
    "Never reset the alpha increment, including across patch, minor, or major bumps.",
    "Use patch for backward-compatible fixes/internal work, minor for backward-compatible features, and major for breaking changes.",
  ].join("\n");

  throw new Error(detail);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
