import type { AstrographVersionParts } from "./types.ts";
import { formatAstrographVersion } from "./version.ts";

export type AstrographReleaseDecisionKind =
  | "none"
  | "increment"
  | "patch"
  | "minor"
  | "major";
type AstrographPublishReleaseKind =
  Exclude<AstrographReleaseDecisionKind, "none" | "increment">;

export interface AstrographReleaseCommit {
  subject: string;
  body?: string;
}

export interface AstrographReleaseDecisionInput {
  commits: readonly AstrographReleaseCommit[];
  changedFiles: readonly string[];
}

export interface AstrographReleaseDecision {
  kind: AstrographReleaseDecisionKind;
  reason: string;
  releaseFiles: readonly string[];
}

const RUNTIME_RELEASE_PATH_PATTERN =
  /^(src\/.*|scripts\/(?:ai-context-engine|git-smart-refresh|install|release-agent)\.mjs|package\.json|pnpm-lock\.yaml|tsconfig(?:\..*)?\.json)$/;

const INTERNAL_VERSIONED_PATH_PATTERN =
  /^(scripts\/.*|tests\/.*|bench\/.*|vitest\.config\.ts)$/;

const RELEASE_ORDER: Record<AstrographReleaseDecisionKind, number> = {
  none: 0,
  increment: 1,
  patch: 2,
  minor: 3,
  major: 4,
};

function conventionalType(subject: string): string | null {
  const match = subject.match(/^(?<type>[a-z]+)(?:\([^)]+\))?(?<breaking>!)?:/i);
  return match?.groups?.type.toLowerCase() ?? null;
}

function hasBreakingMarker(commit: AstrographReleaseCommit): boolean {
  return /^(?:[a-z]+)(?:\([^)]+\))?!:/i.test(commit.subject)
    || /\bBREAKING CHANGE:/i.test(commit.body ?? "");
}

function maxPublishKind(
  current: AstrographPublishReleaseKind,
  next: AstrographPublishReleaseKind,
): AstrographPublishReleaseKind {
  return RELEASE_ORDER[next] > RELEASE_ORDER[current] ? next : current;
}

export function decideAstrographRelease(
  input: AstrographReleaseDecisionInput,
): AstrographReleaseDecision {
  const releaseFiles = input.changedFiles.filter((filePath) =>
    RUNTIME_RELEASE_PATH_PATTERN.test(filePath),
  );
  const internalVersionedFiles = input.changedFiles.filter((filePath) =>
    INTERNAL_VERSIONED_PATH_PATTERN.test(filePath),
  );

  if (releaseFiles.length === 0) {
    if (internalVersionedFiles.length > 0) {
      return {
        kind: "increment",
        reason:
          "Only internal versioned files changed; keep the alpha increment gate, but do not publish.",
        releaseFiles,
      };
    }

    return {
      kind: "none",
      reason: "No package runtime files changed.",
      releaseFiles,
    };
  }

  let kind: AstrographPublishReleaseKind = "patch";
  for (const commit of input.commits) {
    if (hasBreakingMarker(commit)) {
      kind = maxPublishKind(kind, "major");
      continue;
    }

    const type = conventionalType(commit.subject);
    if (type === "feat") {
      kind = maxPublishKind(kind, "minor");
    } else if (type === "fix" || type === "perf") {
      kind = maxPublishKind(kind, "patch");
    }
  }

  const reasonByKind: Record<Exclude<AstrographReleaseDecisionKind, "none">, string> = {
    increment: "Internal versioned files changed without package runtime changes.",
    patch: "Package runtime files changed without a feature or breaking marker.",
    minor: "A feature commit changed package runtime files.",
    major: "A breaking-change marker changed package runtime files.",
  };

  return {
    kind,
    reason: reasonByKind[kind],
    releaseFiles,
  };
}

export function nextAstrographReleaseVersion(
  previous: AstrographVersionParts,
  kind: Exclude<AstrographReleaseDecisionKind, "none">,
): string {
  const next: AstrographVersionParts = {
    ...previous,
    increment: previous.increment + 1,
  };

  if (kind === "major") {
    next.major += 1;
    next.minor = 0;
    next.patch = 0;
  } else if (kind === "minor") {
    next.minor += 1;
    next.patch = 0;
  } else if (kind === "patch") {
    next.patch += 1;
  }

  return formatAstrographVersion(next);
}

export function isReleasePublishKind(kind: AstrographReleaseDecisionKind): boolean {
  return kind === "patch" || kind === "minor" || kind === "major";
}
