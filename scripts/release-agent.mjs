import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJsonPath = path.join(packageRoot, "package.json");
const engineContractPath = path.join(packageRoot, "tests", "engine-contract.test.ts");

const releasePolicyUrl = pathToFileURL(
  path.join(packageRoot, "src", "release-policy.ts"),
).href;
const versionUrl = pathToFileURL(path.join(packageRoot, "src", "version.ts")).href;

const {
  decideAstrographRelease,
  isReleasePublishKind,
  nextAstrographReleaseVersion,
} = await import(releasePolicyUrl);
const {
  assessAstrographVersionBump,
  parseAstrographVersion,
} = await import(versionUrl);

function parseArgs(argv) {
  const options = {
    apply: false,
    base: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--base") {
      options.base = argv[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--base=")) {
      options.base = arg.slice("--base=".length);
    } else {
      throw new Error(`Unknown release-agent argument: ${arg}`);
    }
  }

  return options;
}

function git(args) {
  return execFileSync("git", args, {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitMaybe(args) {
  try {
    return git(args);
  } catch {
    return "";
  }
}

function readPackageVersion(contents, label) {
  const parsed = JSON.parse(contents);
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`${label} is missing a version string.`);
  }

  return parsed.version;
}

function readWorkingPackageVersion() {
  return readPackageVersion(readFileSync(packageJsonPath, "utf8"), "package.json");
}

function findLatestReleaseTag() {
  const tags = gitMaybe(["tag", "--merged", "HEAD", "--list", "v*.*.*", "--sort=-creatordate"]);
  return tags.split("\n").find(Boolean) ?? "";
}

function readPackageVersionAtRef(ref) {
  const contents = git(["show", `${ref}:package.json`]);
  return readPackageVersion(contents, `${ref}:package.json`);
}

function readCommitsSince(baseRef) {
  const range = baseRef.length > 0 ? `${baseRef}..HEAD` : "HEAD";
  const output = gitMaybe(["log", "--format=%H%x00%s%x00%b%x1e", range]);
  if (output.length === 0) {
    return [];
  }

  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [, subject = "", body = ""] = entry.split("\x00");
      return { subject, body };
    });
}

function readChangedFilesSince(baseRef) {
  const args = baseRef.length > 0
    ? ["diff", "--name-only", `${baseRef}..HEAD`]
    : ["show", "--name-only", "--format=", "HEAD"];
  const output = gitMaybe(args);
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

function writePackageVersion(version) {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  parsed.version = version;
  writeFileSync(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`);
}

function writeEngineContractVersion(previousVersion, nextVersion) {
  if (!existsSync(engineContractPath)) {
    return;
  }

  const contents = readFileSync(engineContractPath, "utf8");
  const nextContents = contents.replaceAll(previousVersion, nextVersion);
  if (contents === nextContents) {
    throw new Error(
      `Could not update ${path.relative(packageRoot, engineContractPath)} from ${previousVersion} to ${nextVersion}.`,
    );
  }
  writeFileSync(engineContractPath, nextContents);
}

function writeGithubOutput(values) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  writeFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, { flag: "a" });
}

function printDecision(decision) {
  console.log(JSON.stringify(decision, null, 2));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseRef = options.base || findLatestReleaseTag();
  const currentVersion = readWorkingPackageVersion();
  const baseVersion = baseRef.length > 0
    ? readPackageVersionAtRef(baseRef)
    : currentVersion;
  const baseParts = parseAstrographVersion(baseVersion);
  const currentParts = parseAstrographVersion(currentVersion);
  const commits = readCommitsSince(baseRef);
  const changedFiles = readChangedFilesSince(baseRef);
  const releaseDecision = decideAstrographRelease({ commits, changedFiles });
  const shouldPublish = isReleasePublishKind(releaseDecision.kind);
  const targetVersion = shouldPublish
    ? nextAstrographReleaseVersion(baseParts, releaseDecision.kind)
    : currentVersion;
  const targetTag = `v${targetVersion}`;
  const currentAssessment = assessAstrographVersionBump(baseParts, currentParts);
  const currentVersionAlreadyValid =
    shouldPublish
    && currentVersion === targetVersion
    && currentAssessment.ok;
  const tagAlreadyExists = gitMaybe(["rev-parse", "-q", "--verify", `refs/tags/${targetTag}`])
    .length > 0;

  const decision = {
    apply: options.apply,
    baseRef,
    baseVersion,
    currentVersion,
    shouldRelease: shouldPublish && !tagAlreadyExists,
    releaseKind: releaseDecision.kind,
    reason: releaseDecision.reason,
    releaseFiles: releaseDecision.releaseFiles,
    targetVersion,
    targetTag,
    tagAlreadyExists,
    versionAlreadyCurrent: currentVersionAlreadyValid,
  };

  if (options.apply && shouldPublish && !tagAlreadyExists && !currentVersionAlreadyValid) {
    writePackageVersion(targetVersion);
    writeEngineContractVersion(currentVersion, targetVersion);
    decision.currentVersion = targetVersion;
    decision.versionAlreadyCurrent = true;
  }

  writeGithubOutput({
    should_release: decision.shouldRelease ? "true" : "false",
    release_kind: decision.releaseKind,
    target_version: decision.targetVersion,
    target_tag: decision.targetTag,
    tag_already_exists: decision.tagAlreadyExists ? "true" : "false",
  });
  printDecision(decision);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
