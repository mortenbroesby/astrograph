import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  decideAstrographRelease,
  isReleasePublishKind,
  nextAstrographReleaseVersion,
} from "../release-policy.ts";
import type { AstrographReleaseDecision, AstrographReleaseDecisionKind } from "../release-policy.ts";
import { assessAstrographVersionBump, parseAstrographVersion } from "../version.ts";

interface ReleaseAgentOptions {
  apply: boolean;
  base: string;
}

interface ReleaseDecision {
  apply: boolean;
  baseRef: string;
  baseVersion: string;
  currentVersion: string;
  shouldRelease: boolean;
  releaseKind: AstrographReleaseDecisionKind;
  reason: string;
  releaseFiles: AstrographReleaseDecision["releaseFiles"];
  targetVersion: string;
  targetTag: string;
  tagAlreadyExists: boolean;
  versionAlreadyCurrent: boolean;
}

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const packageJsonPath = path.join(packageRoot, "package.json");
const engineContractPath = path.join(packageRoot, "tests", "engine-contract.test.ts");

function parseArgs(argv: string[]): ReleaseAgentOptions {
  const options: ReleaseAgentOptions = {
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

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitMaybe(args: readonly string[]): string {
  try {
    return git(args);
  } catch {
    return "";
  }
}

function readPackageVersion(contents: string, label: string): string {
  const parsed = JSON.parse(contents) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`${label} is missing a version string.`);
  }

  return parsed.version;
}

function readWorkingPackageVersion(): string {
  return readPackageVersion(readFileSync(packageJsonPath, "utf8"), "package.json");
}

function findLatestReleaseTag(): string {
  const tags = gitMaybe(["tag", "--merged", "HEAD", "--list", "v*.*.*", "--sort=-creatordate"]);
  return tags.split("\n").find(Boolean) ?? "";
}

function readPackageVersionAtRef(ref: string): string {
  const contents = git(["show", `${ref}:package.json`]);
  return readPackageVersion(contents, `${ref}:package.json`);
}

interface AstrographCommit {
  subject: string;
  body: string;
}

function parseCommitPayload(payload: string): { subject: string; body: string } {
  const [, subject = "", body = ""] = payload.split("\x00");
  return { subject, body };
}

function readCommitsSince(baseRef: string): AstrographCommit[] {
  const range = baseRef.length > 0 ? `${baseRef}..HEAD` : "HEAD";
  const output = gitMaybe(["log", "--format=%H%x00%s%x00%b%x1e", range]);
  if (output.length === 0) {
    return [];
  }

  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseCommitPayload(entry));
}

function readChangedFilesSince(baseRef: string): string[] {
  const args = baseRef.length > 0
    ? ["diff", "--name-only", `${baseRef}..HEAD`]
    : ["show", "--name-only", "--format=", "HEAD"];
  const output = gitMaybe(args);
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

function writePackageVersion(version: string): void {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  parsed.version = version;
  writeFileSync(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`);
}

function writeEngineContractVersion(previousVersion: string, nextVersion: string): void {
  if (!existsSync(engineContractPath)) {
    return;
  }

  const contents = readFileSync(engineContractPath, "utf8");
  const nextContents = contents.replaceAll(previousVersion, nextVersion);
  if (contents === nextContents) {
    return;
  }
  writeFileSync(engineContractPath, nextContents);
}

function writeGithubOutput(values: Record<string, string>): void {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  writeFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, { flag: "a" });
}

function printDecision(decision: ReleaseDecision): void {
  console.log(JSON.stringify(decision, null, 2));
}

function main(): void {
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
  let targetVersion = currentVersion;
  if (shouldPublish) {
    targetVersion = nextAstrographReleaseVersion(
      baseParts,
      releaseDecision.kind as Exclude<AstrographReleaseDecisionKind, "none" | "increment">,
    );
  }
  const targetTag = `v${targetVersion}`;
  const currentAssessment = assessAstrographVersionBump(baseParts, currentParts);
  const currentVersionAlreadyValid =
    shouldPublish
    && currentVersion === targetVersion
    && currentAssessment.ok;
  const tagAlreadyExists = gitMaybe(["rev-parse", "-q", "--verify", `refs/tags/${targetTag}`])
    .length > 0;

  const decision: ReleaseDecision = {
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
    release_kind: String(decision.releaseKind),
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
