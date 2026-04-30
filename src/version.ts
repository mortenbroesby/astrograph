import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstrographVersionParts } from "./types.ts";

export type AstrographReleaseKind = "increment" | "patch" | "minor" | "major";

export interface AstrographVersionBumpAssessment {
  ok: boolean;
  kind: AstrographReleaseKind | null;
  reason: string;
}

const ASTROGRAPH_VERSION_PATTERN =
  /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)-alpha\.(?<increment>\d+)$/;

const LEGACY_VERSION_PATTERN =
  /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/;

function parseIntegerComponent(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid Astrograph ${label}: ${value}`);
  }

  return parsed;
}

export function parseAstrographVersion(version: string): AstrographVersionParts {
  const match = version.match(ASTROGRAPH_VERSION_PATTERN);
  if (!match?.groups) {
    throw new Error(
      `Invalid Astrograph version "${version}". Expected major.minor.patch-alpha.increment`,
    );
  }

  return {
    major: parseIntegerComponent(match.groups.major, "major"),
    minor: parseIntegerComponent(match.groups.minor, "minor"),
    patch: parseIntegerComponent(match.groups.patch, "patch"),
    increment: parseIntegerComponent(match.groups.increment, "increment"),
  };
}

function parseLegacyAstrographVersion(version: string): AstrographVersionParts | null {
  const match = version.match(LEGACY_VERSION_PATTERN);
  if (!match?.groups) {
    return null;
  }

  return {
    major: parseIntegerComponent(match.groups.major, "major"),
    minor: parseIntegerComponent(match.groups.minor, "minor"),
    patch: parseIntegerComponent(match.groups.patch, "patch"),
    increment: -1,
  };
}

export function parseAstrographVersionFromCommitBaseline(
  version: string,
): AstrographVersionParts {
  return parseLegacyAstrographVersion(version) ?? parseAstrographVersion(version);
}

export function formatAstrographVersion(parts: AstrographVersionParts): string {
  return `${parts.major}.${parts.minor}.${parts.patch}-alpha.${parts.increment}`;
}

export function assessAstrographVersionBump(
  previous: AstrographVersionParts,
  next: AstrographVersionParts,
): AstrographVersionBumpAssessment {
  if (
    previous.major === next.major
    && previous.minor === next.minor
    && previous.patch === next.patch
    && previous.increment === next.increment
  ) {
    return {
      ok: false,
      kind: null,
      reason: "Astrograph version did not change.",
    };
  }

  if (
    next.major < previous.major
    || next.minor < previous.minor && next.major === previous.major
    || next.patch < previous.patch
      && next.major === previous.major
      && next.minor === previous.minor
    || next.increment < previous.increment
      && next.major === previous.major
      && next.minor === previous.minor
      && next.patch === previous.patch
  ) {
    return {
      ok: false,
      kind: null,
      reason: "Astrograph version must move forward.",
    };
  }

  if (next.major > previous.major) {
    if (next.minor !== 0 || next.patch !== 0) {
      return {
        ok: false,
        kind: null,
        reason: "Major bumps must reset minor and patch to 0.",
      };
    }
    if (next.increment <= previous.increment) {
      return {
        ok: false,
        kind: null,
        reason: "Alpha increment must keep increasing across major bumps.",
      };
    }

    return { ok: true, kind: "major", reason: "Major bump accepted." };
  }

  if (next.minor > previous.minor) {
    if (next.major !== previous.major) {
      return {
        ok: false,
        kind: null,
        reason: "Minor bumps must not also change major.",
      };
    }
    if (next.patch !== 0) {
      return {
        ok: false,
        kind: null,
        reason: "Minor bumps must reset patch to 0.",
      };
    }
    if (next.increment <= previous.increment) {
      return {
        ok: false,
        kind: null,
        reason: "Alpha increment must keep increasing across minor bumps.",
      };
    }

    return { ok: true, kind: "minor", reason: "Minor bump accepted." };
  }

  if (next.patch > previous.patch) {
    if (next.major !== previous.major || next.minor !== previous.minor) {
      return {
        ok: false,
        kind: null,
        reason: "Patch bumps must not also change major or minor.",
      };
    }
    if (next.increment <= previous.increment) {
      return {
        ok: false,
        kind: null,
        reason: "Alpha increment must keep increasing across patch bumps.",
      };
    }

    return { ok: true, kind: "patch", reason: "Patch bump accepted." };
  }

  if (
    next.major === previous.major
    && next.minor === previous.minor
    && next.patch === previous.patch
    && next.increment > previous.increment
  ) {
    return { ok: true, kind: "increment", reason: "Increment bump accepted." };
  }

  return {
    ok: false,
    kind: null,
    reason:
      "Use increment for Astrograph-only iteration, patch for compatible fixes, minor for backward-compatible features, and major for breaking changes.",
  };
}

function resolvePackageJsonPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json",
  );
}

function readPackageVersion() {
  const raw = JSON.parse(
    readFileSync(resolvePackageJsonPath(), "utf8"),
  ) as { version?: unknown };
  if (typeof raw.version !== "string" || raw.version.length === 0) {
    throw new Error("Astrograph package.json is missing a version string.");
  }

  return raw.version;
}

export const ASTROGRAPH_PACKAGE_VERSION = readPackageVersion();
export const ASTROGRAPH_VERSION_PARTS =
  parseAstrographVersion(ASTROGRAPH_PACKAGE_VERSION);
