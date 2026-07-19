import { describe, expect, it } from "vitest";
import {
  type AstrographReleaseDecisionKind,
  decideAstrographRelease,
  nextAstrographReleaseVersion,
  targetAstrographPublishVersion,
} from "../src/release-policy.ts";
import {
  compareAstrographVersions,
  decideAstrographReleaseTransaction,
} from "../src/release-transaction.ts";

const previous = {
  major: 0,
  minor: 1,
  patch: 0,
  increment: 60,
};

function expectPublishKind(
  kind: AstrographReleaseDecisionKind,
): asserts kind is Exclude<AstrographReleaseDecisionKind, "none"> {
  expect(kind).not.toBe("none");
}

describe("release policy", () => {
  it("does not publish docs-only changes", () => {
    const decision = decideAstrographRelease({
      commits: [{ subject: "docs: update release notes" }],
      changedFiles: ["README.md", "specs/implementation/release.md"],
    });

    expect(decision.kind).toBe("none");
  });

  it("keeps internal checks on increment without publishing", () => {
    const decision = decideAstrographRelease({
      commits: [{ subject: "test: cover release policy" }],
      changedFiles: ["tests/release-policy.test.ts"],
    });

    expect(decision.kind).toBe("increment");
  });

  it("uses patch for runtime fixes", () => {
    const decision = decideAstrographRelease({
      commits: [{ subject: "fix: repair storage diagnostics" }],
      changedFiles: ["src/storage.ts"],
    });

    expect(decision.kind).toBe("patch");
    expectPublishKind(decision.kind);
    expect(nextAstrographReleaseVersion(previous, decision.kind)).toBe(
      "0.1.1-alpha.61",
    );
  });

  it("uses minor for runtime features", () => {
    const decision = decideAstrographRelease({
      commits: [{ subject: "feat: add release planning" }],
      changedFiles: ["src/release-policy.ts"],
    });

    expect(decision.kind).toBe("minor");
    expectPublishKind(decision.kind);
    expect(nextAstrographReleaseVersion(previous, decision.kind)).toBe(
      "0.2.0-alpha.61",
    );
  });

  it("uses major for breaking runtime changes", () => {
    const decision = decideAstrographRelease({
      commits: [
        {
          subject: "feat!: replace storage API",
          body: "BREAKING CHANGE: callers must use the new API.",
        },
      ],
      changedFiles: ["src/index.ts"],
    });

    expect(decision.kind).toBe("major");
    expectPublishKind(decision.kind);
    expect(nextAstrographReleaseVersion(previous, decision.kind)).toBe(
      "1.0.0-alpha.61",
    );
  });

  it("keeps minor publish alpha increments ahead of the current package version", () => {
    const base = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 69,
    };
    const current = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 72,
    };

    expect(targetAstrographPublishVersion(base, current, "minor")).toBe(
      "0.4.0-alpha.73",
    );
  });

  it("keeps patch publish alpha increments ahead of the current package version", () => {
    const base = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 69,
    };
    const current = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 72,
    };

    expect(targetAstrographPublishVersion(base, current, "patch")).toBe(
      "0.3.1-alpha.73",
    );
  });

  it("advances an already-current publish target for every publish decision", () => {
    const base = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 69,
    };
    const current = {
      major: 0,
      minor: 4,
      patch: 0,
      increment: 73,
    };

    expect(targetAstrographPublishVersion(base, current, "minor")).toBe(
      "0.4.0-alpha.74",
    );
  });

  it("advances stale alpha when current semantic core equals the publish target", () => {
    const base = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 69,
    };
    const current = {
      major: 0,
      minor: 4,
      patch: 0,
      increment: 60,
    };

    expect(targetAstrographPublishVersion(base, current, "minor")).toBe(
      "0.4.0-alpha.70",
    );
  });

  it("keeps a current minor version ahead of a patch target stable", () => {
    const base = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 69,
    };
    const current = {
      major: 0,
      minor: 4,
      patch: 0,
      increment: 72,
    };

    expect(targetAstrographPublishVersion(base, current, "patch")).toBe(
      "0.4.0-alpha.73",
    );
  });

  it("keeps current semantic core and advances stale alpha when current semantic core is ahead", () => {
    const base = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 69,
    };
    const current = {
      major: 1,
      minor: 0,
      patch: 0,
      increment: 60,
    };

    expect(targetAstrographPublishVersion(base, current, "minor")).toBe(
      "1.0.0-alpha.70",
    );
  });

  it("keeps a current major version ahead of a minor target stable", () => {
    const base = {
      major: 0,
      minor: 3,
      patch: 0,
      increment: 69,
    };
    const current = {
      major: 1,
      minor: 0,
      patch: 0,
      increment: 72,
    };

    expect(targetAstrographPublishVersion(base, current, "minor")).toBe(
      "1.0.0-alpha.73",
    );
  });

  it("orders alpha versions by semantic core and then increment", () => {
    expect(compareAstrographVersions("0.4.0-alpha.105", "0.3.9-alpha.999")).toBeGreaterThan(0);
    expect(compareAstrographVersions("0.4.0-alpha.105", "0.4.0-alpha.106")).toBeLessThan(0);
  });

  it("accepts an ordinary candidate newer than main and npm", () => {
    expect(decideAstrographReleaseTransaction({
      candidateVersion: "0.4.0-alpha.106",
      mainVersion: "0.4.0-alpha.105",
      registry: { status: "available", version: "0.3.2-alpha.75" },
      tagAlreadyExists: false,
    })).toMatchObject({ action: "apply", versionAlreadyCurrent: false });
  });

  it("accepts an already-bumped main version without another increment", () => {
    expect(decideAstrographReleaseTransaction({
      candidateVersion: "0.4.0-alpha.106",
      mainVersion: "0.4.0-alpha.106",
      registry: { status: "available", version: "0.3.2-alpha.75" },
      tagAlreadyExists: false,
    })).toMatchObject({ action: "apply", versionAlreadyCurrent: true });
  });

  it("treats an existing matching tag as an idempotent no-op", () => {
    expect(decideAstrographReleaseTransaction({
      candidateVersion: "0.4.0-alpha.106",
      mainVersion: "0.4.0-alpha.106",
      registry: { status: "available", version: "0.3.2-alpha.75" },
      tagAlreadyExists: true,
    })).toMatchObject({ action: "no-op", versionAlreadyCurrent: true });
  });

  it.each([
    ["newer main", "0.4.0-alpha.106", "0.4.0-alpha.107", { status: "available", version: "0.3.2-alpha.75" }],
    ["equal npm", "0.4.0-alpha.106", "0.4.0-alpha.105", { status: "available", version: "0.4.0-alpha.106" }],
    ["newer npm", "0.4.0-alpha.106", "0.4.0-alpha.105", { status: "available", version: "0.4.0-alpha.107" }],
    ["unavailable npm", "0.4.0-alpha.106", "0.4.0-alpha.105", { status: "unavailable", reason: "network unavailable" }],
    ["unavailable main", "0.4.0-alpha.106", null, { status: "available", version: "0.3.2-alpha.75" }],
  ] as const)("rejects %s state", (_name, candidateVersion, mainVersion, registry) => {
    expect(decideAstrographReleaseTransaction({
      candidateVersion,
      mainVersion,
      registry,
      tagAlreadyExists: false,
    }).action).toBe("reject");
  });
});
