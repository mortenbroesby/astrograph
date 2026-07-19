import { parseAstrographVersion } from "./version.ts";

export type AstrographRegistryVersionState =
  | { status: "available"; version: string }
  | { status: "unavailable"; reason: string };

export type AstrographReleaseTransactionAction = "apply" | "no-op" | "reject";

export interface AstrographReleaseTransactionInput {
  candidateVersion: string;
  mainVersion: string | null;
  registry: AstrographRegistryVersionState;
  tagAlreadyExists: boolean;
}

export interface AstrographReleaseTransactionDecision {
  action: AstrographReleaseTransactionAction;
  reason: string;
  versionAlreadyCurrent: boolean;
}

export function compareAstrographVersions(left: string, right: string): number {
  const leftParts = parseAstrographVersion(left);
  const rightParts = parseAstrographVersion(right);
  return leftParts.major - rightParts.major
    || leftParts.minor - rightParts.minor
    || leftParts.patch - rightParts.patch
    || leftParts.increment - rightParts.increment;
}

export function decideAstrographReleaseTransaction(
  input: AstrographReleaseTransactionInput,
): AstrographReleaseTransactionDecision {
  // Parse candidate even where no comparison follows, so malformed tags and
  // package metadata never become an apparently successful no-op.
  parseAstrographVersion(input.candidateVersion);

  if (input.tagAlreadyExists) {
    return {
      action: "no-op",
      reason: "The matching release tag already exists.",
      versionAlreadyCurrent: true,
    };
  }

  if (input.mainVersion === null) {
    return {
      action: "reject",
      reason: "Cannot safely apply a release because origin/main version is unavailable.",
      versionAlreadyCurrent: false,
    };
  }

  const mainComparison = compareAstrographVersions(
    input.candidateVersion,
    input.mainVersion,
  );
  if (mainComparison < 0) {
    return {
      action: "reject",
      reason: `Candidate ${input.candidateVersion} is older than main ${input.mainVersion}.`,
      versionAlreadyCurrent: false,
    };
  }

  if (input.registry.status === "unavailable") {
    return {
      action: "reject",
      reason: `Cannot safely apply a release because npm registry version is unavailable: ${input.registry.reason}`,
      versionAlreadyCurrent: false,
    };
  }

  const registryComparison = compareAstrographVersions(
    input.candidateVersion,
    input.registry.version,
  );
  if (registryComparison <= 0) {
    return {
      action: "reject",
      reason: `Candidate ${input.candidateVersion} conflicts with npm registry version ${input.registry.version}.`,
      versionAlreadyCurrent: false,
    };
  }

  const versionAlreadyCurrent = mainComparison === 0;
  return {
    action: "apply",
    reason: versionAlreadyCurrent
      ? "Candidate already exists on main and is newer than npm; create or retry its matching tag without another bump."
      : "Candidate is newer than main and npm.",
    versionAlreadyCurrent,
  };
}
