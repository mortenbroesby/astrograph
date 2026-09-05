import { describe, expect, it } from "vitest";

import {
  assertArtifactVersionAvailable,
  releaseArtifactPaths,
  releaseArtifactVersion,
  snapshotVersion,
} from "../src/scripts/release-artifact.ts";

describe("snapshot release artifacts", () => {
  it("generates one deterministic snapshot version from run and commit identity", () => {
    expect(snapshotVersion("0.12.2-alpha.224", "12345", "ABCDEF0123456789"))
      .toBe("0.12.2-alpha.224.snapshot.12345.gabcdef012345");
  });

  it.each(["0", "run-1"])("rejects invalid run id %s", (runId) => {
    expect(() => snapshotVersion("0.12.2-alpha.224", runId, "abcdef0")).toThrow("positive integer");
  });

  it.each(["not-a-sha", "abc123"])("rejects invalid commit %s", (sha) => {
    expect(() => snapshotVersion("0.12.2-alpha.224", "1", sha)).toThrow("hexadecimal SHA");
  });

  it("uses isolated stable output paths", () => {
    expect(releaseArtifactPaths("/tmp/astrograph-release")).toEqual({
      artifactDir: "/tmp/astrograph-release/artifacts",
      metadataPath: "/tmp/astrograph-release/metadata.json",
      stagingDir: "/tmp/astrograph-release/staging",
    });
  });

  it("fails closed when the snapshot version already exists", () => {
    expect(() => assertArtifactVersionAvailable(true, "0.12.2-alpha.224.snapshot.1.gabcdef0"))
      .toThrow("already exists on npm");
  });

  it("uses the exact package version for production artifacts", () => {
    expect(releaseArtifactVersion("0.13.0-alpha.225", "0.13.0-alpha.225", null, "abcdef0"))
      .toBe("0.13.0-alpha.225");
  });

  it("rejects a production version that differs from package.json", () => {
    expect(() => releaseArtifactVersion(
      "0.13.0-alpha.225",
      "0.13.0-alpha.226",
      null,
      "abcdef0",
    )).toThrow("does not match package.json");
  });
});
