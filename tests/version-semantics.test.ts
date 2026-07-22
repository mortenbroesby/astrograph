import { describe, expect, it } from "vitest";

import { compareGenericPackageVersions } from "../src/version.ts";

describe("generic package version comparison", () => {
  it("orders numeric prerelease identifiers semantically", () => {
    expect(compareGenericPackageVersions("1.0.0-rc.10", "1.0.0-rc.2")).toBeGreaterThan(0);
  });

  it("keeps stable versions newer than their prerelease", () => {
    expect(compareGenericPackageVersions("1.0.0", "1.0.0-rc.10")).toBeGreaterThan(0);
  });

  it("rejects invalid generic versions without coercion", () => {
    expect(compareGenericPackageVersions("not-a-version", "1.0.0")).toBeNull();
  });
});
